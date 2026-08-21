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
import android.util.Base64
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
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

class SharedMicModule(reactContext: ReactApplicationContext) :
  NativeSharedMicSpec(reactContext) {

  private companion object {
    const val TAG = "SharedMicModule"
    const val CONSULTATION_DIR = "consultations"
    const val QUEUE_FRAMES = 32
    const val SILENCE_RMS = 120.0
    const val WAV_HEADER_BYTES = 44
    const val BLOCK_ALIGN = 2
    const val MAX_CHUNK_BYTES = 50L * 32000L + WAV_HEADER_BYTES
    const val JOIN_TIMEOUT_MS = 2000L
    const val RESTART_DELAY_MS = 250L
    const val MAX_CONSECUTIVE_ERRORS = 5
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
  private val frames = ArrayBlockingQueue<ByteArray>(QUEUE_FRAMES)
  @Volatile private var pipeOut: OutputStream? = null
  @Volatile private var droppedFrames = 0
  private var pipeRead: ParcelFileDescriptor? = null
  @Volatile private var segmented = true
  @Volatile private var consecutiveErrors = 0
  @Volatile private var sessionEnd: CountDownLatch? = null
  @Volatile private var recognitionLanguage = "en-IN"
  @Volatile private var sessionFinished = false

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
      recognitionLanguage = language
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
    synchronized(lock) {
      if (!running || paused) {
        promise.resolve(false)
        return
      }
      paused = true
      try {
        recorder?.stop()
      } catch (error: Exception) {
        Log.w(TAG, "pause stop failed", error)
      }
      Log.i(TAG, "paused")
      promise.resolve(true)
    }
  }

  override fun resume(promise: Promise) {
    val language: String
    synchronized(lock) {
      if (!running || !paused) {
        promise.resolve(false)
        return
      }
      try {
        recorder?.startRecording()
      } catch (error: Exception) {
        promise.reject("E_RESUME", error.message, error)
        return
      }
      paused = false
      language = recognitionLanguage
      Log.i(TAG, "resumed")
    }

    main.post {
      if (running && !paused && sessionEnd == null && !listening) {
        Log.i(TAG, "restarting recognition after resume")
        startRecognition(language)
      }
    }
    promise.resolve(true)
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
    val settled = CountDownLatch(1)
    sessionEnd = settled
    closeWriteEnd()

    val finished = if (sessionFinished) {
      true
    } else {
      try {
        settled.await(SESSION_END_TIMEOUT_MS, TimeUnit.MILLISECONDS)
      } catch (error: InterruptedException) {
        false
      }
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

  override fun invalidate() {
    releaseWithoutPromise()
    super.invalidate()
  }

  private fun releaseWithoutPromise() {
    val record: AudioRecord?
    val readerThread: Thread?
    val pumpThread: Thread?

    synchronized(lock) {
      if (!running) {
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
      Log.w(TAG, "invalidate stop failed", error)
    }

    readerThread?.join(JOIN_TIMEOUT_MS)
    pumpThread?.join(JOIN_TIMEOUT_MS)
    record?.release()
    closeWriteEnd()
    main.post { destroyRecognizer() }
    closeReadEnd()

    outputFile?.let { writeWavHeader(it, sampleRate, synchronized(this) { totalBytes }) }
  }

  override fun getState(promise: Promise) {
    promise.resolve(buildState())
  }
  private fun consultationFile(path: String): File? {
    val directory = File(appContext.filesDir, CONSULTATION_DIR).canonicalFile
    val file = File(path).canonicalFile
    return if (file.parentFile == directory) file else null
  }

  override fun readCaptureBase64(path: String, maxBytes: Double, promise: Promise) {
    val file = consultationFile(path)
    if (file == null) {
      promise.reject("E_PATH", "Not a consultation recording")
      return
    }
    if (!file.exists()) {
      promise.reject("E_NO_FILE", "No recording for this consultation")
      return
    }

    val limit = maxBytes.toLong()
    if (limit > 0 && file.length() > limit) {
      promise.reject("E_TOO_LARGE", "Recording is ${file.length()} bytes, limit is $limit")
      return
    }

    try {
      promise.resolve(Base64.encodeToString(file.readBytes(), Base64.NO_WRAP))
    } catch (error: OutOfMemoryError) {
      promise.reject("E_TOO_LARGE", "Not enough memory to encode the recording")
    } catch (error: Exception) {
      promise.reject("E_READ", error.message, error)
    }
  }
  override fun readCaptureChunkBase64(path: String, start: Double, end: Double, promise: Promise) {
    val file = consultationFile(path)
    if (file == null) {
      promise.reject("E_PATH", "Not a consultation recording")
      return
    }
    if (!file.exists()) {
      promise.reject("E_NO_FILE", "No recording for this consultation")
      return
    }

    val from = start.toLong()
    val to = end.toLong()
    val length = file.length()
    if (from < WAV_HEADER_BYTES || to > length || to - from < BLOCK_ALIGN) {
      promise.reject("E_RANGE", "Range $from..$to is not inside a ${length}-byte recording")
      return
    }
    if (to - from > MAX_CHUNK_BYTES) {
      promise.reject("E_TOO_LARGE", "Chunk of ${to - from} bytes exceeds $MAX_CHUNK_BYTES")
      return
    }

    val dataBytes = (to - from).toInt()
    try {
      val chunk = ByteArray(WAV_HEADER_BYTES + dataBytes)
      RandomAccessFile(file, "r").use { input ->
        input.seek(from)
        input.readFully(chunk, WAV_HEADER_BYTES, dataBytes)
      }
      wavHeaderInto(chunk, sampleRateOf(file), dataBytes)
      promise.resolve(Base64.encodeToString(chunk, Base64.NO_WRAP))
    } catch (error: OutOfMemoryError) {
      promise.reject("E_TOO_LARGE", "Not enough memory to encode this chunk")
    } catch (error: Exception) {
      promise.reject("E_READ", error.message, error)
    }
  }

  override fun snapChunkBoundaries(
    path: String,
    boundaries: ReadableArray,
    windowBytes: Double,
    promise: Promise,
  ) {
    val file = consultationFile(path)
    if (file == null || !file.exists() || boundaries.size() < 2) {
      promise.reject("E_PATH", "Not a readable consultation recording")
      return
    }

    val length = file.length()
    val window = windowBytes.toLong().coerceAtLeast(0L)
    val snapped = Arguments.createArray()

    try {
      RandomAccessFile(file, "r").use { input ->
        var previous = 0L
        for (index in 0 until boundaries.size()) {
          val target = boundaries.getDouble(index).toLong()
          val fixed = index == 0 || index == boundaries.size() - 1
          val at =
            if (fixed || window == 0L) {
              target
            } else {
              quietestOffset(input, target, window, previous, length)
            }
          val safe = at.coerceIn(previous, length).let { it - (it % BLOCK_ALIGN) }
          snapped.pushDouble(safe.toDouble())
          previous = safe
        }
      }
      promise.resolve(snapped)
    } catch (error: Exception) {
      promise.reject("E_READ", error.message, error)
    }
  }
  private fun quietestOffset(
    input: RandomAccessFile,
    target: Long,
    window: Long,
    floor: Long,
    length: Long,
  ): Long {
    val step = (sampleRate * BLOCK_ALIGN) / 50
    val from = (target - window).coerceAtLeast(floor.coerceAtLeast(WAV_HEADER_BYTES.toLong()))
    val to = (target + window).coerceAtMost(length)
    if (to - from < step * 2) {
      return target
    }

    val buffer = ByteArray(step)
    var best = target
    var bestRms = Double.MAX_VALUE
    var offset = from - (from % BLOCK_ALIGN)

    while (offset + step <= to) {
      input.seek(offset)
      input.readFully(buffer)
      val rms = rmsOf(buffer)
      if (rms < bestRms || (rms == bestRms && abs(offset - target) < abs(best - target))) {
        bestRms = rms
        best = offset
      }
      if (rms < SILENCE_RMS) {
        return offset
      }
      offset += step
    }
    return best
  }

  private fun rmsOf(bytes: ByteArray): Double {
    var sum = 0.0
    var index = 0
    while (index + 1 < bytes.size) {
      val sample = ((bytes[index + 1].toInt() shl 8) or (bytes[index].toInt() and 0xFF)).toShort()
      sum += sample.toDouble() * sample.toDouble()
      index += 2
    }
    val samples = bytes.size / 2
    return if (samples > 0) sqrt(sum / samples) else 0.0
  }

  private fun sampleRateOf(file: File): Int {
    return try {
      RandomAccessFile(file, "r").use { input ->
        val header = ByteArray(WAV_HEADER_BYTES)
        input.readFully(header)
        val rate = (header[24].toInt() and 0xFF) or
          ((header[25].toInt() and 0xFF) shl 8) or
          ((header[26].toInt() and 0xFF) shl 16) or
          ((header[27].toInt() and 0xFF) shl 24)
        if (rate > 0) rate else sampleRate
      }
    } catch (error: Exception) {
      sampleRate
    }
  }

  override fun deleteCapture(path: String, promise: Promise) {
    val file = consultationFile(path)
    if (file == null) {
      promise.reject("E_PATH", "Not a consultation recording")
      return
    }
    promise.resolve(if (file.exists()) file.delete() else false)
  }

  override fun purgeCaptures(olderThanMs: Double, promise: Promise) {
    val directory = File(appContext.filesDir, CONSULTATION_DIR)
    val cutoff = System.currentTimeMillis() - olderThanMs.toLong()
    var removed = 0

    directory.listFiles()?.forEach { file ->
      if (file.isFile && file.lastModified() < cutoff && file.delete()) {
        removed += 1
      }
    }

    promise.resolve(removed)
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
    sessionFinished = false
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
        Log.d(TAG, "pipe write ended: ${error.message}")
      }
    }
  }

  private fun closeWriteEnd() {
    try {
      pipeOut?.close()
    } catch (error: Exception) {
      Log.d(TAG, "pipe write close: ${error.message}")
    }
    pipeOut = null
  }

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
      if (segmented) {
        putExtra(RecognizerIntent.EXTRA_SEGMENTED_SESSION, RecognizerIntent.EXTRA_AUDIO_SOURCE)
      }
    }

    sessionFinished = false

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

        sessionEnd?.countDown()

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
        if (!segmented) {
          scheduleRestart(language)
        } else if (!finishSessionOrRestart(language)) {
          Log.i(TAG, "results arrived early; recognition restarted")
        }
      }

      override fun onSegmentResults(segmentResults: Bundle) {
        Log.i(TAG, "onSegmentResults")
        appendResult(segmentResults)
      }

      override fun onEndOfSegmentedSession() {
        Log.i(TAG, "segmented session ended")
        listening = false
        finishSessionOrRestart(language)
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

  private fun finishSessionOrRestart(language: String): Boolean {
    val latch = sessionEnd
    if (latch != null) {
      latch.countDown()
      return true
    }
    if (!running || paused) {
      sessionFinished = true
      return true
    }
    main.postDelayed({
      if (running && !paused && sessionEnd == null && !listening) {
        startRecognition(language)
      }
    }, RESTART_DELAY_MS)
    return false
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

  private fun scheduleRestart(language: String) {
    if (!running) {
      return
    }
    synchronized(this) { restarts += 1 }
    main.postDelayed({
      if (running && !paused && sessionEnd == null) {
        startRecognition(language)
      }
    }, RESTART_DELAY_MS)
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
      val header = ByteArray(WAV_HEADER_BYTES)
      wavHeaderInto(header, rate, dataBytes.toInt())
      RandomAccessFile(file, "rw").use { out ->
        out.seek(0)
        out.write(header)
      }
    } catch (error: Exception) {
      Log.w(TAG, "wav header failed", error)
    }
  }

  private fun wavHeaderInto(target: ByteArray, rate: Int, dataBytes: Int) {
    var at = 0
    fun put(bytes: ByteArray) {
      bytes.copyInto(target, at)
      at += bytes.size
    }

    put("RIFF".toByteArray(Charsets.US_ASCII))
    put(intLe(36 + dataBytes))
    put("WAVE".toByteArray(Charsets.US_ASCII))
    put("fmt ".toByteArray(Charsets.US_ASCII))
    put(intLe(16))
    put(shortLe(1))
    put(shortLe(1))
    put(intLe(rate))
    put(intLe(rate * BLOCK_ALIGN))
    put(shortLe(BLOCK_ALIGN))
    put(shortLe(16))
    put("data".toByteArray(Charsets.US_ASCII))
    put(intLe(dataBytes))
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
