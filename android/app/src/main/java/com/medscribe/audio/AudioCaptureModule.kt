package com.medscribe.audio

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioRecordingConfiguration
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.medscribe.specs.NativeAudioCaptureSpec
import java.io.File
import java.io.RandomAccessFile
import kotlin.concurrent.thread
import kotlin.math.abs
import kotlin.math.sqrt

const val AUDIO_CAPTURE_NAME = "AudioCapture"

/**
 * Phase 1 spike: PCM capture that runs while the system SpeechRecognizer holds
 * the microphone, so concurrent capture can be measured on a real device.
 *
 * Reports per-second RMS and read-gap statistics rather than a bare byte count:
 * Android returns buffers of zeros to a losing concurrent capturer, so "bytes
 * arrived" is not evidence that audio arrived.
 */
class AudioCaptureModule(reactContext: ReactApplicationContext) :
  NativeAudioCaptureSpec(reactContext) {

  private companion object {
    const val TAG = "AudioCaptureModule"
    const val CAPTURE_DIR = "spike"
    const val SILENCE_RMS = 120.0
    const val GAP_THRESHOLD_MS = 400L
    const val JOIN_TIMEOUT_MS = 2000L
    const val CONFIG_POLL_MS = 1000L

    fun sourceOf(name: String): Int = when (name) {
      "voiceRecognition" -> MediaRecorder.AudioSource.VOICE_RECOGNITION
      "voiceCommunication" -> MediaRecorder.AudioSource.VOICE_COMMUNICATION
      "camcorder" -> MediaRecorder.AudioSource.CAMCORDER
      else -> MediaRecorder.AudioSource.MIC
    }
  }

  private val appContext = reactContext
  private val lock = Any()

  private var recorder: AudioRecord? = null
  private var worker: Thread? = null
  @Volatile private var capturing = false

  private var outputFile: File? = null
  private var startedAtMs = 0L
  private var totalBytes = 0L
  private var peakAmplitude = 0
  private var sumRms = 0.0
  private var rmsWindows = 0
  private var silentWindows = 0
  private var readErrors = 0
  private var longestGapMs = 0L
  private var gapCount = 0
  private var sampleRate = 0
  private var audioSource = MediaRecorder.AudioSource.MIC
  private var audioSourceName = "mic"
  private var audioSessionId = 0
  private val timeline = mutableListOf<WritableMap>()

  private val audioManager =
    reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val configHandler = Handler(Looper.getMainLooper())
  private var configPoller: Runnable? = null
  private var silencedSamples = 0
  private var configSamples = 0
  private var maxConcurrentClients = 0
  private val readErrorCodes = mutableListOf<WritableMap>()

  override fun isCaptureSupported(promise: Promise) {
    val granted = ContextCompat.checkSelfPermission(
      appContext,
      Manifest.permission.RECORD_AUDIO,
    ) == PackageManager.PERMISSION_GRANTED
    promise.resolve(granted)
  }

  override fun startCapture(sampleRateHz: Double, source: String, promise: Promise) {
    synchronized(lock) {
      if (capturing) {
        promise.reject("E_ALREADY_CAPTURING", "Capture already running")
        return
      }

      if (ContextCompat.checkSelfPermission(
          appContext,
          Manifest.permission.RECORD_AUDIO,
        ) != PackageManager.PERMISSION_GRANTED
      ) {
        promise.reject("E_PERMISSION", "RECORD_AUDIO not granted")
        return
      }

      val rate = sampleRateHz.toInt().let { if (it > 0) it else 16000 }
      val minBuffer = AudioRecord.getMinBufferSize(
        rate,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
      )
      if (minBuffer <= 0) {
        promise.reject("E_BUFFER", "Unsupported sample rate $rate")
        return
      }

      val bufferBytes = minBuffer * 4
      audioSourceName = source
      audioSource = sourceOf(source)

      val record = try {
        AudioRecord(
          audioSource,
          rate,
          AudioFormat.CHANNEL_IN_MONO,
          AudioFormat.ENCODING_PCM_16BIT,
          bufferBytes,
        )
      } catch (error: Exception) {
        promise.reject("E_INIT", error.message, error)
        return
      }

      if (record.state != AudioRecord.STATE_INITIALIZED) {
        record.release()
        promise.reject("E_INIT", "AudioRecord failed to initialize")
        return
      }

      val directory = File(appContext.getExternalFilesDir(null), CAPTURE_DIR)
      if (!directory.exists() && !directory.mkdirs()) {
        record.release()
        promise.reject("E_DIR", "Could not create capture folder")
        return
      }
      val file = File(directory, "spike-${System.currentTimeMillis()}.wav")

      resetStats(rate, file)

      try {
        record.startRecording()
      } catch (error: Exception) {
        record.release()
        promise.reject("E_START", error.message, error)
        return
      }

      if (record.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
        record.release()
        promise.reject("E_START", "AudioRecord did not enter RECORDING state")
        return
      }

      audioSessionId = record.audioSessionId
      recorder = record
      capturing = true
      startedAtMs = System.currentTimeMillis()

      worker = thread(name = "medscribe-capture") { captureLoop(record, file, rate, bufferBytes) }
      startConfigPolling()

      val result = Arguments.createMap().apply {
        putString("path", file.absolutePath)
        putString("source", audioSourceName)
        putInt("sampleRate", rate)
        putInt("bufferBytes", bufferBytes)
        putDouble("startedAt", startedAtMs.toDouble())
      }
      promise.resolve(result)
    }
  }

  override fun stopCapture(promise: Promise) {
    val record: AudioRecord?
    val thread: Thread?
    synchronized(lock) {
      if (!capturing) {
        promise.reject("E_NOT_CAPTURING", "Capture is not running")
        return
      }
      capturing = false
      record = recorder
      thread = worker
      recorder = null
      worker = null
    }

    stopConfigPolling()

    try {
      record?.stop()
    } catch (error: Exception) {
      Log.w(TAG, "stop failed", error)
    }

    // Join BEFORE releasing: the worker can still be inside read(), and the
    // WAV header is written from totalBytes, which it is still incrementing.
    thread?.join(JOIN_TIMEOUT_MS)
    if (thread?.isAlive == true) {
      Log.w(TAG, "capture thread did not stop within ${JOIN_TIMEOUT_MS}ms")
    }
    record?.release()

    val file = outputFile
    if (file != null) {
      writeWavHeader(file, sampleRate, synchronized(this) { totalBytes })
    }

    promise.resolve(buildStats())
  }

  override fun getStats(promise: Promise) {
    promise.resolve(buildStats())
  }

  private fun resetStats(rate: Int, file: File) {
    outputFile = file
    sampleRate = rate
    totalBytes = 0
    peakAmplitude = 0
    sumRms = 0.0
    rmsWindows = 0
    silentWindows = 0
    readErrors = 0
    longestGapMs = 0
    gapCount = 0
    silencedSamples = 0
    configSamples = 0
    maxConcurrentClients = 0
    timeline.clear()
    readErrorCodes.clear()
  }

  /**
   * The platform's own answer to "is our capture being silenced?" — on API 29+
   * a losing concurrent capturer is handed zeroed buffers rather than an error,
   * so this is the only non-inferential way to tell contention from a bug.
   */
  private fun startConfigPolling() {
    stopConfigPolling()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return
    }
    val runnable = object : Runnable {
      override fun run() {
        sampleRecordingConfigs()
        if (capturing) {
          configHandler.postDelayed(this, CONFIG_POLL_MS)
        }
      }
    }
    configPoller = runnable
    configHandler.post(runnable)
  }

  private fun stopConfigPolling() {
    configPoller?.let { configHandler.removeCallbacks(it) }
    configPoller = null
  }

  private fun sampleRecordingConfigs() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return
    }
    val configs: List<AudioRecordingConfiguration> = try {
      audioManager.activeRecordingConfigurations
    } catch (error: Exception) {
      Log.w(TAG, "recording configs unavailable", error)
      return
    }

    // Session id, not just source: another client can hold the same source,
    // and only the session tells us which configuration is ours.
    val ours = configs.filter {
      it.clientAudioSessionId == audioSessionId || (audioSessionId == 0 && it.clientAudioSource == audioSource)
    }
    val silenced = ours.any { it.isClientSilenced }

    synchronized(this) {
      configSamples += 1
      if (silenced) {
        silencedSamples += 1
      }
      if (configs.size > maxConcurrentClients) {
        maxConcurrentClients = configs.size
      }
    }

    val sources = configs.joinToString(",") { config ->
      "${config.clientAudioSource}${if (config.isClientSilenced) "(silenced)" else ""}"
    }
    Log.i(TAG, "configs=${configs.size} sources=[$sources] oursSilenced=$silenced")
  }

  private fun captureLoop(record: AudioRecord, file: File, rate: Int, bufferBytes: Int) {
    val buffer = ShortArray(bufferBytes / 2)
    val bytesPerWindow = rate * 2
    var windowBytes = 0L
    var windowSumSquares = 0.0
    var windowSamples = 0L
    var windowPeak = 0
    var lastReadAt = System.currentTimeMillis()

    try {
      RandomAccessFile(file, "rw").use { out ->
        out.setLength(0)
        out.write(ByteArray(44))

        while (capturing) {
          val read = record.read(buffer, 0, buffer.size)
          val now = System.currentTimeMillis()

          if (read <= 0) {
            synchronized(this) { readErrors += 1 }
            val reason = when (read) {
              AudioRecord.ERROR_INVALID_OPERATION -> "ERROR_INVALID_OPERATION"
              AudioRecord.ERROR_BAD_VALUE -> "ERROR_BAD_VALUE"
              AudioRecord.ERROR_DEAD_OBJECT -> "ERROR_DEAD_OBJECT"
              AudioRecord.ERROR -> "ERROR"
              0 -> "ZERO_BYTES"
              else -> "UNKNOWN"
            }
            Log.w(TAG, "read returned $read ($reason) at ${now - startedAtMs}ms, capturing=$capturing")
            synchronized(this) {
              if (readErrorCodes.size < 40) {
                readErrorCodes.add(
                  Arguments.createMap().apply {
                    putInt("code", read)
                    putString("reason", reason)
                    putDouble("atMs", (now - startedAtMs).toDouble())
                    putBoolean("whileCapturing", capturing)
                  },
                )
              }
            }
            continue
          }

          val gap = now - lastReadAt
          if (gap > GAP_THRESHOLD_MS) {
            synchronized(this) {
              gapCount += 1
              if (gap > longestGapMs) {
                longestGapMs = gap
              }
            }
          }
          lastReadAt = now

          val bytes = ByteArray(read * 2)
          for (index in 0 until read) {
            val sample = buffer[index]
            val value = sample.toInt()
            bytes[index * 2] = (value and 0xFF).toByte()
            bytes[index * 2 + 1] = ((value shr 8) and 0xFF).toByte()

            val magnitude = abs(value)
            if (magnitude > windowPeak) {
              windowPeak = magnitude
            }
            windowSumSquares += (value * value).toDouble()
            windowSamples += 1
          }
          out.write(bytes)

          synchronized(this) { totalBytes += bytes.size }
          windowBytes += bytes.size

          if (windowBytes >= bytesPerWindow && windowSamples > 0) {
            val rms = sqrt(windowSumSquares / windowSamples)
            recordWindow(now, rms, windowPeak)
            windowBytes = 0
            windowSumSquares = 0.0
            windowSamples = 0
            windowPeak = 0
          }
        }
      }
    } catch (error: Exception) {
      Log.w(TAG, "capture loop failed", error)
      readErrors += 1
    }
  }

  @Synchronized
  private fun recordWindow(now: Long, rms: Double, peak: Int) {
    sumRms += rms
    rmsWindows += 1
    if (rms < SILENCE_RMS) {
      silentWindows += 1
    }
    if (peak > peakAmplitude) {
      peakAmplitude = peak
    }

    Log.i(TAG, "second=${rmsWindows} rms=${"%.1f".format(rms)} peak=$peak bytes=$totalBytes")

    if (timeline.size < 300) {
      timeline.add(
        Arguments.createMap().apply {
          putInt("second", rmsWindows)
          putDouble("atMs", (now - startedAtMs).toDouble())
          putDouble("rms", rms)
          putInt("peak", peak)
        },
      )
    }
  }

  private fun buildStats(): WritableMap = synchronized(this) {
    val durationMs = if (startedAtMs == 0L) 0L else System.currentTimeMillis() - startedAtMs
    val averageRms = if (rmsWindows > 0) sumRms / rmsWindows else 0.0
    val silentRatio = if (rmsWindows > 0) silentWindows.toDouble() / rmsWindows else 1.0

    val samples = Arguments.createArray()
    synchronized(this) {
      timeline.forEach { samples.pushMap(it.copy()) }
    }

    return Arguments.createMap().apply {
      putString("path", outputFile?.absolutePath ?: "")
      putDouble("bytes", totalBytes.toDouble())
      putDouble("durationMs", durationMs.toDouble())
      putInt("sampleRate", sampleRate)
      putDouble("averageRms", averageRms)
      putInt("peakAmplitude", peakAmplitude)
      putDouble("silentRatio", silentRatio)
      putInt("rmsWindows", rmsWindows)
      putInt("silentWindows", silentWindows)
      putInt("readErrors", readErrors)
      putString("source", audioSourceName)
      putInt("configSamples", configSamples)
      putInt("silencedSamples", silencedSamples)
      putInt("maxConcurrentClients", maxConcurrentClients)
      putInt("gapCount", gapCount)
      putDouble("longestGapMs", longestGapMs.toDouble())
      putArray("timeline", samples)
      putArray(
        "readErrorDetail",
        Arguments.createArray().apply {
          synchronized(this@AudioCaptureModule) {
            readErrorCodes.forEach { pushMap(it.copy()) }
          }
        },
      )
    }
  }

  private fun writeWavHeader(file: File, rate: Int, dataBytes: Long) {
    try {
      RandomAccessFile(file, "rw").use { out ->
        val byteRate = rate * 2
        val riffSize = 36 + dataBytes
        out.seek(0)
        out.writeBytes("RIFF")
        out.write(intLe(riffSize.toInt()))
        out.writeBytes("WAVE")
        out.writeBytes("fmt ")
        out.write(intLe(16))
        out.write(shortLe(1))
        out.write(shortLe(1))
        out.write(intLe(rate))
        out.write(intLe(byteRate))
        out.write(shortLe(2))
        out.write(shortLe(16))
        out.writeBytes("data")
        out.write(intLe(dataBytes.toInt()))
      }
    } catch (error: Exception) {
      Log.w(TAG, "wav header failed", error)
    }
  }

  private fun intLe(value: Int) = byteArrayOf(
    (value and 0xFF).toByte(),
    ((value shr 8) and 0xFF).toByte(),
    ((value shr 16) and 0xFF).toByte(),
    ((value shr 24) and 0xFF).toByte(),
  )

  private fun shortLe(value: Int) = byteArrayOf(
    (value and 0xFF).toByte(),
    ((value shr 8) and 0xFF).toByte(),
  )

  override fun invalidate() {
    stopConfigPolling()
    if (capturing) {
      capturing = false
      try {
        recorder?.stop()
      } catch (error: Exception) {
        Log.w(TAG, "invalidate stop failed", error)
      }
      // The worker owns the RandomAccessFile; joining lets its `use` block
      // close the file before the recorder goes away underneath it.
      worker?.join(JOIN_TIMEOUT_MS)
      worker = null
      recorder?.release()
      recorder = null
    }
    super.invalidate()
  }
}

private fun WritableMap.copy(): WritableMap =
  Arguments.createMap().apply { merge(this@copy) }
