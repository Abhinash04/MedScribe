package com.medscribe.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.medscribe.overlay.DictationOverlayBridge
import com.medscribe.specs.NativeAudioCueSpec
import java.io.File

const val AUDIO_CUE_NAME = "AudioCue"

class AudioCueModule(reactContext: ReactApplicationContext) :
  NativeAudioCueSpec(reactContext), LifecycleEventListener {

  private companion object {
    const val TAG = "AudioCueModule"
    const val PREFS = "medscribe_audio"
    const val KEY_MUTED = "streams_muted"
    const val PROMPT_PREFIX = "medscribe_prompt"
    const val CUE_VOLUME = 70
    const val CUE_MS = 140
    val CANDIDATE_STREAMS = listOf(
      AudioManager.STREAM_MUSIC to "music",
      AudioManager.STREAM_SYSTEM to "system",
      AudioManager.STREAM_NOTIFICATION to "notification",
    )
  }

  private val appContext = reactContext
  private val audio =
    reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val prefs =
    reactContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private val handler = Handler(Looper.getMainLooper())
  private val lock = Any()
  private val mutedStreams = mutableListOf<Int>()
  private var watchdog: Runnable? = null
  private val speechLock = Any()
  private var player: MediaPlayer? = null
  private var playerFile: File? = null
  private var speechPromise: Promise? = null

  init {
    reactContext.addLifecycleEventListener(this)
    if (prefs.getBoolean(KEY_MUTED, false)) {
      CANDIDATE_STREAMS.forEach { (stream, _) -> unmuteStream(stream) }
      prefs.edit().putBoolean(KEY_MUTED, false).commit()
    }
    try {
      appContext.cacheDir
        ?.listFiles { file -> file.name.startsWith(PROMPT_PREFIX) }
        ?.forEach { it.delete() }
    } catch (error: Exception) {
      Log.w(TAG, "could not purge stale prompt audio", error)
    }
  }

  override fun playCue(kind: String, promise: Promise) {
    try {
      val (tone, durationMs) = when (kind) {
        "resume" -> ToneGenerator.TONE_PROP_BEEP to CUE_MS
        "stop" -> ToneGenerator.TONE_PROP_BEEP2 to CUE_MS
        else -> ToneGenerator.TONE_PROP_ACK to CUE_MS
      }
      val generator = ToneGenerator(AudioManager.STREAM_MUSIC, CUE_VOLUME)
      generator.startTone(tone, durationMs)
      handler.postDelayed({
        try {
          generator.release()
        } catch (error: Exception) {
          Log.w(TAG, "tone release failed", error)
        }
      }, (durationMs + 120).toLong())

      promise.resolve(true)
    } catch (error: Exception) {
      Log.w(TAG, "playCue failed", error)
      promise.resolve(false)
    }
  }

  override fun playSpeech(audioBase64: String, promise: Promise) {
    restoreInternal()
    stopSpeechInternal(resolveAs = false)

    val staged = try {
      val bytes = Base64.decode(audioBase64, Base64.DEFAULT)
      if (bytes.isEmpty()) {
        promise.resolve(false)
        return
      }
      File.createTempFile(PROMPT_PREFIX, ".wav", appContext.cacheDir).apply {
        writeBytes(bytes)
      }
    } catch (error: Exception) {
      Log.w(TAG, "cannot stage prompt audio", error)
      promise.resolve(false)
      return
    }

    val media = MediaPlayer()
    synchronized(speechLock) {
      player = media
      playerFile = staged
    }

    try {
      media.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ASSISTANT)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build(),
      )
      media.setDataSource(staged.absolutePath)
      media.setOnCompletionListener { stopSpeechInternal(resolveAs = true) }
      media.setOnErrorListener { _, what, extra ->
        Log.w(TAG, "prompt playback error what=" + what + " extra=" + extra)
        stopSpeechInternal(resolveAs = false)
        true
      }
      media.prepare()

      synchronized(speechLock) { speechPromise = promise }
      media.start()
    } catch (error: Exception) {
      Log.w(TAG, "cannot play prompt audio", error)
      synchronized(speechLock) { speechPromise = null }
      stopSpeechInternal(resolveAs = false)
      promise.resolve(false)
    }
  }

  override fun stopSpeech(promise: Promise) {
    stopSpeechInternal(resolveAs = false)
    promise.resolve(true)
  }

  private fun stopSpeechInternal(resolveAs: Boolean) {
    val taken = synchronized(speechLock) {
      val snapshot = Triple(player, playerFile, speechPromise)
      player = null
      playerFile = null
      speechPromise = null
      snapshot
    }

    val media = taken.first
    val file = taken.second
    val pending = taken.third

    if (media != null) {
      try {
        if (media.isPlaying) {
          media.stop()
        }
      } catch (error: Exception) {
        Log.w(TAG, "prompt stop failed", error)
      }
      try {
        media.release()
      } catch (error: Exception) {
        Log.w(TAG, "prompt release failed", error)
      }
    }

    try {
      file?.delete()
    } catch (error: Exception) {
      Log.w(TAG, "prompt file delete failed", error)
    }

    pending?.resolve(resolveAs)
  }

  override fun suppressSystemTones(watchdogMs: Double, promise: Promise) {
    stopSpeechInternal(resolveAs = false)
    try {
      val applied = synchronized(lock) {
        cancelWatchdogLocked()

        if (mutedStreams.isEmpty()) {
          prefs.edit().putBoolean(KEY_MUTED, true).commit()
        }

        val labels = mutableListOf<String>()
        CANDIDATE_STREAMS.forEach { (stream, label) ->
          if (mutedStreams.contains(stream) || muteStreamLocked(stream)) {
            labels.add(label)
          }
        }

        if (labels.isEmpty()) {
          prefs.edit().putBoolean(KEY_MUTED, false).commit()
        } else {
          armWatchdogLocked(watchdogMs.toLong())
        }

        labels
      }

      promise.resolve(applied.joinToString(","))
    } catch (error: Exception) {
      restoreInternal()
      promise.reject("E_AUDIO_SUPPRESS", error.message, error)
    }
  }

  override fun restoreSystemTones(promise: Promise) {
    restoreInternal()
    promise.resolve(true)
  }

  private fun muteStreamLocked(stream: Int): Boolean =
    try {
      audio.adjustStreamVolume(stream, AudioManager.ADJUST_MUTE, 0)
      mutedStreams.add(stream)
      true
    } catch (error: Exception) {
      Log.w(TAG, "cannot mute stream $stream", error)
      false
    }

  private fun unmuteStream(stream: Int) {
    try {
      audio.adjustStreamVolume(stream, AudioManager.ADJUST_UNMUTE, 0)
    } catch (error: Exception) {
      Log.w(TAG, "cannot unmute stream $stream", error)
    }
  }

  private fun restoreInternal() {
    synchronized(lock) {
      cancelWatchdogLocked()
      mutedStreams.toList().forEach { unmuteStream(it) }
      mutedStreams.clear()
      prefs.edit().putBoolean(KEY_MUTED, false).commit()
    }
  }

  private fun armWatchdogLocked(delayMs: Long) {
    val runnable = Runnable {
      synchronized(lock) { watchdog = null }
      Log.w(TAG, "watchdog fired — restoring streams")
      restoreInternal()
    }
    watchdog = runnable
    handler.postDelayed(runnable, if (delayMs > 0) delayMs else 120_000L)
  }

  private fun cancelWatchdogLocked() {
    watchdog?.let { handler.removeCallbacks(it) }
    watchdog = null
  }

  override fun onHostResume() = Unit

  override fun onHostPause() {
    if (DictationOverlayBridge.dictationActive) {
      return
    }
    stopSpeechInternal(resolveAs = false)
    restoreInternal()
  }

  override fun onHostDestroy() {
    stopSpeechInternal(resolveAs = false)
    restoreInternal()
  }

  override fun invalidate() {
    stopSpeechInternal(resolveAs = false)
    restoreInternal()
    appContext.removeLifecycleEventListener(this)
    super.invalidate()
  }
}