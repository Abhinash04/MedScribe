package com.medscribe.overlay

import com.facebook.react.bridge.ReadableMap

data class OverlaySnapshot(
  val phase: String,
  val transcript: String,
  val partial: String,
  val detail: String,
  val durationSeconds: Int,
  val level: Double,
  val canPause: Boolean,
  val canStop: Boolean,
  val canReview: Boolean,
) {
  companion object {
    const val PHASE_IDLE = "idle"
    const val PHASE_RECORDING = "recording"
    const val PHASE_PAUSED = "paused"
    const val PHASE_PROCESSING = "processing"
    const val PHASE_REVIEW = "review"
    const val PHASE_COMPLETED = "completed"

    fun idle() =
      OverlaySnapshot(
        phase = PHASE_IDLE,
        transcript = "",
        partial = "",
        detail = "",
        durationSeconds = 0,
        level = 0.0,
        canPause = false,
        canStop = false,
        canReview = false,
      )

    fun from(map: ReadableMap): OverlaySnapshot =
      OverlaySnapshot(
        phase = map.stringOr("phase", PHASE_IDLE),
        transcript = map.stringOr("transcript", ""),
        partial = map.stringOr("partial", ""),
        detail = map.stringOr("detail", ""),
        durationSeconds = if (map.hasKey("durationSeconds")) map.getInt("durationSeconds") else 0,
        level = if (map.hasKey("level")) map.getDouble("level") else 0.0,
        canPause = map.booleanOr("canPause"),
        canStop = map.booleanOr("canStop"),
        canReview = map.booleanOr("canReview"),
      )

    private fun ReadableMap.stringOr(key: String, fallback: String): String =
      if (hasKey(key)) getString(key) ?: fallback else fallback

    private fun ReadableMap.booleanOr(key: String): Boolean =
      if (hasKey(key)) getBoolean(key) else false
  }
}
