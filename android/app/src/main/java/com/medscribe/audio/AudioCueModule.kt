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
import com.medscribe.specs.NativeAudioCueSpec
import java.io.File

const val AUDIO_CUE_NAME = "AudioCue"

/**
 * Dictation audio feedback: one short cue of our own, and suppression of the
 * system recognizer's per-utterance tones.
 *
 * The start/end tones heard between sentences are played by the Android
 * RecognitionService, not by this app, so they cannot be turned off through
 * SpeechRecognizer. Requesting audio focus does not silence them either — audio
 * focus asks other apps to yield, it does not mute a system service. Muting the
 * carrying streams for the duration of the session is the only mechanism that
 * works, which makes "restore, always" the module's central obligation.
 *
 * Five independent restore paths, because leaving a doctor's phone muted is a
 * far worse failure than a stray beep:
 *   1. JavaScript calls restoreSystemTones() on pause, stop, error and unmount.
 *   2. onHostPause / onHostDestroy / invalidate — covers a JS crash or reload.
 *   3. A watchdog Runnable restores unconditionally after watchdogMs.
 *   4. A SharedPreferences flag, committed before the first mute, is checked on
 *      the next launch — covers process death mid-session.
 *   5. AudioService itself drops per-client mute requests when the process dies.
 *      Treated as a bonus, never relied upon.
 */
class AudioCueModule(reactContext: ReactApplicationContext) :
  NativeAudioCueSpec(reactContext), LifecycleEventListener {

  private companion object {
    const val TAG = "AudioCueModule"
    const val PREFS = "medscribe_audio"
    const val KEY_MUTED = "streams_muted"
    const val CUE_VOLUME = 70
    const val CUE_MS = 140

    /**
     * Ordered by likelihood of carrying the recognizer tone. The ring group
     * additionally needs Do-Not-Disturb access on API 23+ and throws
     * SecurityException without it; asking a doctor for DND access to silence a
     * beep is not a trade worth making, so each stream is attempted
     * independently and a refusal is logged, never escalated.
     */
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

  /**
   * Guards `mutedStreams` and `watchdog`. They are reached from three threads:
   * the TurboModule call thread, the main thread (the watchdog Runnable and the
   * lifecycle callbacks), and whichever thread `invalidate()` runs on. Without
   * serialization a restore can interleave with a suppression and clear the list
   * while a stream is still muted — which is the one failure this module exists
   * to prevent.
   */
  private val lock = Any()
  private val mutedStreams = mutableListOf<Int>()
  private var watchdog: Runnable? = null

  /** Guards `player` and `playerFile`, reached from the same three threads. */
  private val speechLock = Any()
  private var player: MediaPlayer? = null
  private var playerFile: File? = null
  private var speechPromise: Promise? = null

  init {
    reactContext.addLifecycleEventListener(this)
    // The previous process died while muted. Nothing else will undo it.
    if (prefs.getBoolean(KEY_MUTED, false)) {
      CANDIDATE_STREAMS.forEach { (stream, _) -> unmuteStream(stream) }
      prefs.edit().putBoolean(KEY_MUTED, false).commit()
    }
  }

  // ------------------------------------------------------------------ cues

  override fun playCue(kind: String, promise: Promise) {
    try {
      val (tone, durationMs) = when (kind) {
        "resume" -> ToneGenerator.TONE_PROP_BEEP to CUE_MS
        "stop" -> ToneGenerator.TONE_PROP_BEEP2 to CUE_MS
        else -> ToneGenerator.TONE_PROP_ACK to CUE_MS
      }

      // A ToneGenerator holds a hardware track, so it is created per cue and
      // released on the same handler rather than kept alive for the session.
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
      // A missing or busy audio path must never break a dictation session.
      Log.w(TAG, "playCue failed", error)
      promise.resolve(false)
    }
  }

  // ---------------------------------------------------------------- speech

  /**
   * Plays the spoken missing-field prompt.
   *
   * Two obligations beyond "call MediaPlayer":
   *
   * 1. Restore the streams first. A dictation mutes STREAM_MUSIC, and this
   *    prompt plays on STREAM_MUSIC. Speaking into that mute is silence, and
   *    the caller has no way to know it happened. Because the mute and the
   *    playback live in one class, the ordering is enforced here rather than
   *    trusted to a caller.
   * 2. Delete the staged file on every exit. MediaPlayer cannot read a byte
   *    array, so the audio is written to cacheDir; a prompt is patient-adjacent
   *    data and must not outlive its playback.
   *
   * Resolves rather than rejects on failure. A prompt that cannot be spoken is
   * an enhancement that did not happen, never a broken consultation - the
   * written warning has already told the doctor everything.
   */
  override fun playSpeech(audioBase64: String, promise: Promise) {
    // A prompt is inaudible while the dictation mute is still in force.
    restoreInternal()
    stopSpeechInternal(resolveAs = false)

    val staged = try {
      val bytes = Base64.decode(audioBase64, Base64.DEFAULT)
      if (bytes.isEmpty()) {
        promise.resolve(false)
        return
      }
      File.createTempFile("medscribe_prompt", ".wav", appContext.cacheDir).apply {
        writeBytes(bytes)
      }
    } catch (error: Exception) {
      Log.w(TAG, "cannot stage prompt audio", error)
      promise.resolve(false)
      return
    }

    try {
      val media = MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANT)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build(),
        )
        setDataSource(staged.absolutePath)
        setOnCompletionListener { stopSpeechInternal(resolveAs = true) }
        setOnErrorListener { _, what, extra ->
          Log.w(TAG, "prompt playback error what=" + what + " extra=" + extra)
          stopSpeechInternal(resolveAs = false)
          true
        }
        prepare()
      }

      synchronized(speechLock) {
        player = media
        playerFile = staged
        speechPromise = promise
      }

      media.start()
    } catch (error: Exception) {
      Log.w(TAG, "cannot play prompt audio", error)
      staged.delete()
      synchronized(speechLock) { speechPromise = null }
      promise.resolve(false)
    }
  }

  override fun stopSpeech(promise: Promise) {
    stopSpeechInternal(resolveAs = false)
    promise.resolve(true)
  }

  /**
   * The single teardown path. Completion, error, an explicit stop and every
   * lifecycle callback all route here, so the player and its staged file are
   * released exactly once however the playback ended.
   */
  private fun stopSpeechInternal(resolveAs: Boolean) {
    // Returned out of the critical section rather than assigned into captured
    // vals: the state is cleared under the lock, and everything that can throw
    // happens outside it.
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

  // ----------------------------------------------------------- suppression

  override fun suppressSystemTones(watchdogMs: Double, promise: Promise) {
    // Suppression is armed as a dictation starts, so a prompt still playing is
    // about to be recorded into the transcript. The JS layer stops it before
    // navigating; this is the backstop for every path that does not.
    stopSpeechInternal(resolveAs = false)
    try {
      val applied = synchronized(lock) {
        cancelWatchdogLocked()

        if (mutedStreams.isEmpty()) {
          // Committed before the first mute so a crash between the two still
          // leaves the marker that the next launch reads.
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
      // Iterates a copy: unmuteStream can throw per stream and must not abandon
      // the rest of the list half-restored.
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

  // ------------------------------------------------------------- lifecycle

  override fun onHostResume() = Unit

  override fun onHostPause() {
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
    // Otherwise the dead module stays in the context's listener list and is
    // called back on the next host pause.
    appContext.removeLifecycleEventListener(this)
    super.invalidate()
  }
}