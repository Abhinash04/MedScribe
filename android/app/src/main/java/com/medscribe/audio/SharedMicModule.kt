package com.medscribe.audio

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.medscribe.specs.NativeSharedMicSpec
import java.io.File
import java.io.OutputStream
import java.io.RandomAccessFile
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
import kotlin.math.abs
import kotlin.math.sqrt

const val SHARED_MIC_NAME = "SharedMic"

/**
 * One microphone, two consumers.
 *
 * Running SpeechRecognizer and AudioRecord side by side does not work: the
 * device spike measured the recognizer returning NO_MATCH on every utterance
 * across all four audio sources, because our AudioRecord wins the microphone
 * outright. The platform's answer is EXTRA_AUDIO_SOURCE (API 31+), which lets
 * the recognizer read from a file descriptor we supply instead of opening the
 * microphone itself. So this module owns the only AudioRecord and fans the same
 * PCM out to a WAV file and to the recognizer through a pipe.
 *
 * State is polled rather than pushed. The measurement needs counters and a
 * transcript, not an event stream, and polling keeps this module free of
 * emitter plumbing until the architecture has been proven on a real device.
 */
class SharedMicModule(reactContext: ReactApplicationContext) :
  NativeSharedMicSpec(reactContext) {

  private companion object {
    const val TAG = "SharedMicModule"
    const val CONSULTATION_DIR = "consultations"
    const val QUEUE_FRAMES = 32
    const val SILENCE_RMS = 120.0
    const val JOIN_TIMEOUT_MS = 2000L
    const val RESTART_DELAY_MS = 250L

    /**
     * One bad configuration produced 116 identical errors in 30 seconds and an
     * unreadable log. Five is enough to distinguish a transient failure from a
     * configuration the device will never accept.
     */
    const val MAX_CONSECUTIVE_ERRORS = 5

    /** How long stop() waits for the service to finalise after EOF. */
    const val SESSION_END_TIMEOUT_MS = 10000L
  }

  private val appContext = reactContext
  private val main = Handler(Looper.getMainLooper())
  private val lock = Any()

  private var recorder: AudioRecord? = null
  private var reader: Thread? = null
  private var pump: Thread? = null
  @Volatile private var running = false
  @Volatile private var paused = false

  private var recognizer: SpeechRecognizer? = null
  private var outputFile: File? = null
  private var sampleRate = 16000

  /**
   * Frames waiting for the recognizer. Bounded and drop-oldest: a stalled
   * reader must never block the thread that is also writing the WAV, or the
   * recording itself would be damaged by a slow recognition service.
   */
  private val frames = ArrayBlockingQueue<ByteArray>(QUEUE_FRAMES)
  @Volatile private var pipeOut: OutputStream? = null
  @Volatile private var droppedFrames = 0

  /**
   * "The caller of the recognizer is responsible for closing the audio" — so
   * this is held for the life of the session and closed in stop(), not the
   * moment after startListening().
   */
  private var pipeRead: ParcelFileDescriptor? = null
  @Volatile private var segmented = true
  @Volatile private var consecutiveErrors = 0

  /** Released by the callback that finalises a session, awaited by stop(). */
  @Volatile private var sessionEnd: CountDownLatch? = null

  private var totalBytes = 0L
  private var peakAmplitude = 0
  private var sumRms = 0.0
  private var lastRms = 0.0
  private var rmsWindows = 0
  private var silentWindows = 0

  private val finals = StringBuilder()
  @Volatile private var partial = ""
  @Volatile private var listening = false
  private var finalCount = 0
  private var partialCount = 0
  private var firstPartialAtMs = 0L
  private var startedAtMs = 0L
  private var restarts = 0
  private var beginCount = 0
  private var readyCount = 0
  private val errorCounts = mutableMapOf<Int, Int>()

  override fun isSupported(promise: Promise) {
    val supported =
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
        SpeechRecognizer.isRecognitionAvailable(appContext)
    promise.resolve(supported)
  }

  override fun start(
    sampleRateHz: Double,
    name: String,
    language: String,
    useSegmented: Boolean,
    promise: Promise,
  ) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      promise.reject("E_UNSUPPORTED", "EXTRA_AUDIO_SOURCE needs Android 12 or newer")
      return
    }
    if (ContextCompat.checkSelfPermission(appContext, Manifest.permission.RECORD_AUDIO)
      != PackageManager.PERMISSION_GRANTED
    ) {
      promise.reject("E_PERMISSION", "RECORD_AUDIO not granted")
      return
    }

    synchronized(lock) {
      if (running) {
        promise.reject("E_ALREADY_RUNNING", "Shared mic is already running")
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
      val bufferBytes = minBuffer * 2

      val record = try {
        AudioRecord(
          MediaRecorder.AudioSource.VOICE_RECOGNITION,
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

      val directory = File(appContext.filesDir, CONSULTATION_DIR)
      if (!directory.exists() && !directory.mkdirs()) {
        record.release()
        promise.reject("E_DIR", "Could not create capture folder")
        return
      }
      val safeName = name.replace(Regex("[^A-Za-z0-9_-]"), "").ifEmpty { "consultation" }
      val file = File(directory, "$safeName.wav")

      resetState(rate, file)
      segmented = useSegmented
      consecutiveErrors = 0

      try {
        record.startRecording()
      } catch (error: Exception) {
        record.release()
        promise.reject("E_START", error.message, error)
        return
      }

      recorder = record
      running = true
      paused = false

      reader = thread(name = "medscribe-shared-reader") {
        readLoop(record, file, rate, bufferBytes)
      }
      pump = thread(name = "medscribe-shared-pump") { pumpLoop() }

      main.post { startRecognition(language) }

      promise.resolve(
        Arguments.createMap().apply {
          putString("path", file.absolutePath)
          putInt("sampleRate", rate)
          putInt("bufferBytes", bufferBytes)
        },
      )
    }
  }

  override fun pause(promise: Promise) {
    paused = true
    promise.resolve(running)
  }

  override fun resume(promise: Promise) {
    paused = false
    promise.resolve(running)
  }

  override fun stop(promise: Promise) {
    val record: AudioRecord?
    val readerThread: Thread?
    val pumpThread: Thread?

    synchronized(lock) {
      if (!running) {
        promise.reject("E_NOT_RUNNING", "Shared mic is not running")
        return
      }
      running = false
      record = recorder
      readerThread = reader
      pumpThread = pump
      recorder = null
      reader = null
      pump = null
    }

    try {
      record?.stop()
    } catch (error: Exception) {
      Log.w(TAG, "stop failed", error)
    }

    readerThread?.join(JOIN_TIMEOUT_MS)
    pumpThread?.join(JOIN_TIMEOUT_MS)
    record?.release()

    // A segmented session "will end when and only when the audio is closed",
    // so closing the write end IS the request to finalise. Destroying the
    // recognizer first — which is what this used to do — threw the results
    // away microseconds before they arrived.
    val settled = CountDownLatch(1)
    sessionEnd = settled
    closeWriteEnd()

    val finished = try {
      settled.await(SESSION_END_TIMEOUT_MS, TimeUnit.MILLISECONDS)
    } catch (error: InterruptedException) {
      false
    }
    sessionEnd = null

    Log.i(
      TAG,
      "session ${if (finished) "finalised" else "TIMED OUT"} after EOF · " +
        "segments=${synchronized(this) { finalCount }}",
    )

    main.post { destroyRecognizer() }
    closeReadEnd()

    outputFile?.let { writeWavHeader(it, sampleRate, synchronized(this) { totalBytes }) }

    promise.resolve(buildState())
  }

  override fun getState(promise: Promise) {
    promise.resolve(buildState())
  }

  private fun resetState(rate: Int, file: File) {
    sampleRate = rate
    outputFile = file
    totalBytes = 0
    peakAmplitude = 0
    sumRms = 0.0
    lastRms = 0.0
    rmsWindows = 0
    silentWindows = 0
    droppedFrames = 0
    finals.setLength(0)
    partial = ""
    finalCount = 0
    partialCount = 0
    firstPartialAtMs = 0
    startedAtMs = System.currentTimeMillis()
    restarts = 0
    beginCount = 0
    readyCount = 0
    errorCounts.clear()
    frames.clear()
  }

  private fun buildState(): WritableMap = synchronized(this) {
    val silentRatio = if (rmsWindows > 0) silentWindows.toDouble() / rmsWindows else 1.0
    val averageRms = if (rmsWindows > 0) sumRms / rmsWindows else 0.0

    Arguments.createMap().apply {
      putString("path", outputFile?.absolutePath ?: "")
      putBoolean("running", running)
      putBoolean("listening", listening)
      putString("text", finals.toString().trim())
      putString("partial", partial)
      putInt("finals", finalCount)
      putInt("partials", partialCount)
      putDouble("firstPartialAtMs", firstPartialAtMs.toDouble())
      putBoolean("segmented", segmented)
      putInt("restarts", restarts)
      putInt("begin", beginCount)
      putInt("ready", readyCount)
      putDouble("bytes", totalBytes.toDouble())
      putInt("peakAmplitude", peakAmplitude)
      putDouble("averageRms", averageRms)
      putDouble("lastRms", lastRms)
      putDouble("silentRatio", silentRatio)
      putInt("droppedFrames", droppedFrames)
      putMap(
        "errorsByCode",
        Arguments.createMap().apply {
          errorCounts.forEach { (code, count) -> putInt(code.toString(), count) }
        },
      )
    }
  }

  // ── Audio ────────────────────────────────────────────────────────────────

  private fun readLoop(record: AudioRecord, file: File, rate: Int, bufferBytes: Int) {
    val buffer = ShortArray(bufferBytes / 2)
    val bytesPerWindow = rate * 2
    var windowBytes = 0L
    var windowSumSquares = 0.0
    var windowSamples = 0L
    var windowPeak = 0

    try {
      RandomAccessFile(file, "rw").use { out ->
        out.setLength(0)
        out.write(ByteArray(44))

        while (running) {
          if (paused) {
            Thread.sleep(100)
            continue
          }

          val read = record.read(buffer, 0, buffer.size)
          if (read <= 0) {
            continue
          }

          val bytes = ByteArray(read * 2)
          for (index in 0 until read) {
            val value = buffer[index].toInt()
            bytes[index * 2] = (value and 0xFF).toByte()
            bytes[index * 2 + 1] = ((value shr 8) and 0xFF).toByte()

            val magnitude = abs(value)
            if (magnitude > windowPeak) {
              windowPeak = magnitude
            }
            windowSumSquares += (value * value).toDouble()
            windowSamples += 1
          }

          // The WAV is written first and unconditionally: the recording is the
          // record of the consultation, and a slow recognition service must
          // never be able to damage it.
          out.write(bytes)
          synchronized(this) { totalBytes += bytes.size }

          if (!frames.offer(bytes)) {
            frames.poll()
            frames.offer(bytes)
            droppedFrames += 1
          }

          windowBytes += bytes.size
          if (windowBytes >= bytesPerWindow && windowSamples > 0) {
            val rms = sqrt(windowSumSquares / windowSamples)
            synchronized(this) {
              // The most recent window, so the waveform has something live to
              // draw. sumRms/rmsWindows is a session average and never moves.
              lastRms = rms
              sumRms += rms
              rmsWindows += 1
              if (rms < SILENCE_RMS) {
                silentWindows += 1
              }
              if (windowPeak > peakAmplitude) {
                peakAmplitude = windowPeak
              }
            }
            windowBytes = 0
            windowSumSquares = 0.0
            windowSamples = 0
            windowPeak = 0
          }
        }
      }
    } catch (error: Exception) {
      Log.w(TAG, "read loop failed", error)
    }
  }

  private fun pumpLoop() {
    while (running) {
      val frame = try {
        frames.poll(200, TimeUnit.MILLISECONDS)
      } catch (error: InterruptedException) {
        null
      } ?: continue

      val stream = pipeOut ?: continue
      try {
        stream.write(frame)
        stream.flush()
      } catch (error: Exception) {
        // The recognizer closed its end between utterances. The next one opens
        // a fresh pipe; the recording is unaffected.
        Log.d(TAG, "pipe write ended: ${error.message}")
      }
    }
  }

  /** The EOF a segmented session waits for. */
  private fun closeWriteEnd() {
    try {
      pipeOut?.close()
    } catch (error: Exception) {
      Log.d(TAG, "pipe write close: ${error.message}")
    }
    pipeOut = null
  }

  /** Ours to close — the docs put that responsibility on the caller. */
  private fun closeReadEnd() {
    try {
      pipeRead?.close()
    } catch (error: Exception) {
      Log.d(TAG, "pipe read close: ${error.message}")
    }
    pipeRead = null
  }

  private fun closePipe() {
    closeWriteEnd()
    closeReadEnd()
  }

  // ── Recognition ──────────────────────────────────────────────────────────

  private fun startRecognition(language: String) {
    if (!running) {
      return
    }

    destroyRecognizer()
    closePipe()

    val pipe = try {
      ParcelFileDescriptor.createPipe()
    } catch (error: Exception) {
      Log.w(TAG, "createPipe failed", error)
      return
    }
    pipeRead = pipe[0]
    pipeOut = ParcelFileDescriptor.AutoCloseOutputStream(pipe[1])

    val instance = SpeechRecognizer.createSpeechRecognizer(appContext)
    recognizer = instance

    val intent = android.content.Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, appContext.packageName)
      putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE, pipe[0])
      putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT, 1)
      putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
      putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE, sampleRate)
      // One session for the whole dictation: it "will end when and only when
      // the audio is closed", which is what stop() does. Without this the
      // recognizer ends per utterance and every restart needs a new pipe.
      if (segmented) {
        putExtra(RecognizerIntent.EXTRA_SEGMENTED_SESSION, RecognizerIntent.EXTRA_AUDIO_SOURCE)
      }
    }

    Log.i(TAG, "startListening segmented=$segmented rate=$sampleRate lang=$language")

    instance.setRecognitionListener(object : RecognitionListener {
      override fun onReadyForSpeech(params: Bundle?) {
        listening = true
        synchronized(this@SharedMicModule) {
          readyCount += 1
          consecutiveErrors = 0
        }
      }

      override fun onBeginningOfSpeech() {
        synchronized(this@SharedMicModule) { beginCount += 1 }
      }

      override fun onRmsChanged(rmsdB: Float) = Unit

      override fun onBufferReceived(buffer: ByteArray?) = Unit

      override fun onEndOfSpeech() {
        listening = false
      }

      override fun onError(error: Int) {
        listening = false
        synchronized(this@SharedMicModule) {
          errorCounts[error] = (errorCounts[error] ?: 0) + 1
          consecutiveErrors += 1
        }
        Log.w(TAG, "onError $error segmented=$segmented consecutive=$consecutiveErrors")

        // An error after EOF still settles the session, or stop() would wait
        // the full timeout for a callback that is never coming.
        sessionEnd?.countDown()

        // A configuration the device refuses fails instantly and identically.
        // Try the classic single-utterance shape once before giving up, so one
        // run tells us which mode this handset honours.
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          if (segmented) {
            Log.w(TAG, "segmented mode rejected; falling back to single-utterance")
            segmented = false
            synchronized(this@SharedMicModule) { consecutiveErrors = 0 }
            scheduleRestart(language)
          } else {
            Log.e(TAG, "recognition unavailable on this device; stopping restarts")
          }
          return
        }

        scheduleRestart(language)
      }

      override fun onResults(results: Bundle?) {
        appendResult(results)
        listening = false
        // A segmented session ends only when the audio closes, so a result is
        // not a reason to restart it.
        if (segmented) {
          sessionEnd?.countDown()
        } else {
          scheduleRestart(language)
        }
      }

      override fun onSegmentResults(segmentResults: Bundle) {
        Log.i(TAG, "onSegmentResults")
        appendResult(segmentResults)
      }

      override fun onEndOfSegmentedSession() {
        Log.i(TAG, "segmented session ended")
        listening = false
        sessionEnd?.countDown()
      }

      override fun onPartialResults(partialResults: Bundle?) {
        val text = partialResults
          ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
          ?.firstOrNull()
          .orEmpty()
        if (text.isBlank()) {
          return
        }
        partial = text
        // Whether partials stream during a segmented session decides whether
        // the doctor sees text while speaking, so the first one is timed.
        synchronized(this@SharedMicModule) {
          partialCount += 1
          if (firstPartialAtMs == 0L) {
            firstPartialAtMs = System.currentTimeMillis() - startedAtMs
            Log.i(TAG, "first partial after ${firstPartialAtMs}ms")
          }
        }
      }

      override fun onEvent(eventType: Int, params: Bundle?) = Unit
    })

    try {
      instance.startListening(intent)
    } catch (error: Exception) {
      Log.w(TAG, "startListening failed", error)
    }
  }

  private fun appendResult(bundle: Bundle?) {
    val text = bundle
      ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
      ?.firstOrNull()
      .orEmpty()
    if (text.isBlank()) {
      return
    }
    synchronized(this) {
      if (finals.isNotEmpty()) {
        finals.append(' ')
      }
      finals.append(text)
      finalCount += 1
    }
    partial = ""
  }

  /**
   * Recognition is single-utterance, so continuous dictation means restarting.
   * Each restart needs a fresh pipe — the previous read end is consumed once
   * the service finishes with it.
   */
  private fun scheduleRestart(language: String) {
    if (!running) {
      return
    }
    synchronized(this) { restarts += 1 }
    main.postDelayed({ startRecognition(language) }, RESTART_DELAY_MS)
  }

  private fun destroyRecognizer() {
    try {
      recognizer?.destroy()
    } catch (error: Exception) {
      Log.d(TAG, "recognizer destroy: ${error.message}")
    }
    recognizer = null
    listening = false
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
}
