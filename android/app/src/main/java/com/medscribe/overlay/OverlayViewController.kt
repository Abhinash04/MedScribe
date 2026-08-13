package com.medscribe.overlay

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.animation.AnticipateInterpolator
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.medscribe.R
import kotlin.math.abs
import kotlin.math.roundToInt

private object OverlayPalette {
  const val ACCENT = 0xFF2F6BFF.toInt()
  const val DANGER = 0xFFDC2626.toInt()
  const val SURFACE = 0xFF16213E.toInt()
  const val PANEL = 0xE60B1220.toInt()
  const val MUTED = 0xFFCBD5E1.toInt()
}

class OverlayViewController(private val context: Context) : OverlayRenderer {

  private val windowManager =
    context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  private val main = Handler(Looper.getMainLooper())
  private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop

  private var bubbleRoot: FrameLayout? = null
  private var bubbleParams: WindowManager.LayoutParams? = null
  private var transcriptRoot: LinearLayout? = null
  private var transcriptParams: WindowManager.LayoutParams? = null

  private lateinit var bubble: FrameLayout
  private lateinit var bubbleIcon: ImageView
  private lateinit var satellites: LinearLayout
  private lateinit var playSatellite: FrameLayout
  private lateinit var playIcon: ImageView
  private lateinit var stopSatellite: FrameLayout
  private lateinit var homeSatellite: FrameLayout
  private lateinit var timerLabel: TextView
  private lateinit var transcriptLabel: TextView
  private lateinit var transcriptStatus: TextView

  private var expanded = false
  private var snapshot: OverlaySnapshot = OverlaySnapshot.idle()
  private var rotationIndex = 0
  private var rotating = false

  private val rotateMessages =
    Runnable {
      rotationIndex += 1
      applyProcessingMessage()
      scheduleRotation()
    }

  fun attach(): Boolean {
    if (bubbleRoot != null) {
      return true
    }
    if (!Settings.canDrawOverlays(context)) {
      DictationOverlayBridge.windowAttached = false
      return false
    }

    val params = buildBubbleParams()
    val view = buildBubbleViews()

    return try {
      windowManager.addView(view, params)
      bubbleRoot = view
      bubbleParams = params
      DictationOverlayBridge.windowAttached = true
      render(DictationOverlayBridge.latest)
      true
    } catch (error: Exception) {
      DictationOverlayBridge.windowAttached = false
      false
    }
  }

  fun detach() {
    stopRotation()
    detachTranscript()
    val view = bubbleRoot ?: return
    bubbleRoot = null
    bubbleParams = null
    DictationOverlayBridge.windowAttached = false
    try {
      windowManager.removeView(view)
    } catch (error: Exception) {
      Unit
    }
  }

  override fun render(snapshot: OverlaySnapshot) {
    this.snapshot = snapshot
    if (bubbleRoot == null) {
      return
    }

    bubbleBackground().setColor(bubbleColorFor(snapshot.phase))
    playIcon.setImageResource(
      if (snapshot.phase == OverlaySnapshot.PHASE_RECORDING) {
        R.drawable.ic_overlay_pause
      } else {
        R.drawable.ic_overlay_play
      },
    )

    playSatellite.isEnabled = snapshot.phase != OverlaySnapshot.PHASE_PROCESSING
    stopSatellite.isEnabled = snapshot.canStop
    playSatellite.alpha = if (playSatellite.isEnabled) 1f else 0.4f
    stopSatellite.alpha = if (stopSatellite.isEnabled) 1f else 0.4f

    timerLabel.text = formatDuration(snapshot.durationSeconds)
    timerLabel.visibility =
      if (showsTimer(snapshot.phase)) View.VISIBLE else View.GONE

    if (showsTranscript(snapshot.phase)) {
      attachTranscript()
      updateTranscript()
    } else {
      detachTranscript()
    }

    if (snapshot.phase == OverlaySnapshot.PHASE_PROCESSING) {
      startRotation()
    } else {
      stopRotation()
    }

    if (snapshot.phase == OverlaySnapshot.PHASE_IDLE && expanded) {
      setExpanded(false)
    }
  }

  private fun showsTimer(phase: String): Boolean =
    phase == OverlaySnapshot.PHASE_RECORDING || phase == OverlaySnapshot.PHASE_PAUSED

  private fun showsTranscript(phase: String): Boolean =
    phase == OverlaySnapshot.PHASE_RECORDING ||
      phase == OverlaySnapshot.PHASE_PAUSED ||
      phase == OverlaySnapshot.PHASE_PROCESSING

  private fun buildBubbleParams(): WindowManager.LayoutParams {
    val type =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION")
        WindowManager.LayoutParams.TYPE_PHONE
      }

    return WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        type,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
          WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
          WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT,
      )
      .apply {
        gravity = Gravity.TOP or Gravity.START
        x = prefs.getInt(KEY_BUBBLE_X, dp(12))
        y = prefs.getInt(KEY_BUBBLE_Y, dp(200))
      }
  }

  @SuppressLint("ClickableViewAccessibility")
  private fun buildBubbleViews(): FrameLayout {
    val container = FrameLayout(context)

    val row =
      LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
      }

    satellites =
      LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        visibility = View.GONE
      }

    playSatellite = buildSatellite(R.drawable.ic_overlay_play, OverlayPalette.ACCENT) {
      DictationOverlayBridge.dispatch(
        if (snapshot.phase == OverlaySnapshot.PHASE_RECORDING) ACTION_PAUSE else ACTION_PLAY,
      )
    }
    playIcon = playSatellite.getChildAt(0) as ImageView

    stopSatellite = buildSatellite(R.drawable.ic_overlay_stop, OverlayPalette.DANGER) {
      DictationOverlayBridge.dispatch(ACTION_STOP)
    }

    homeSatellite = buildSatellite(R.drawable.ic_overlay_home, OverlayPalette.SURFACE) {
      DictationOverlayBridge.dispatch(ACTION_HOME)
    }

    satellites.addView(playSatellite)
    satellites.addView(stopSatellite)
    satellites.addView(homeSatellite)

    val bubbleColumn =
      LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
      }

    bubble =
      FrameLayout(context).apply {
        background =
          GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(OverlayPalette.ACCENT)
          }
        elevation = dp(8).toFloat()
        layoutParams = LinearLayout.LayoutParams(dp(BUBBLE_DP), dp(BUBBLE_DP))
      }

    bubbleIcon =
      ImageView(context).apply {
        setImageResource(R.drawable.ic_bubble_logo)
        layoutParams =
          FrameLayout.LayoutParams(dp(BUBBLE_DP), dp(BUBBLE_DP)).apply {
            gravity = Gravity.CENTER
          }
      }
    bubble.addView(bubbleIcon)
    bubble.setOnTouchListener(BubbleTouchListener())

    timerLabel =
      TextView(context).apply {
        setTextColor(Color.WHITE)
        textSize = 11f
        gravity = Gravity.CENTER
        visibility = View.GONE
        setPadding(dp(8), dp(2), dp(8), dp(2))
        background =
          GradientDrawable().apply {
            cornerRadius = dp(9).toFloat()
            setColor(OverlayPalette.PANEL)
          }
        layoutParams =
          LinearLayout.LayoutParams(
              LinearLayout.LayoutParams.WRAP_CONTENT,
              LinearLayout.LayoutParams.WRAP_CONTENT,
            )
            .apply { topMargin = dp(4) }
      }

    bubbleColumn.addView(bubble)
    bubbleColumn.addView(timerLabel)

    row.addView(satellites)
    row.addView(bubbleColumn)
    container.addView(row)
    return container
  }

  private fun buildSatellite(iconRes: Int, tint: Int, onTap: () -> Unit): FrameLayout {
    val holder =
      FrameLayout(context).apply {
        background =
          GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(tint)
          }
        elevation = dp(6).toFloat()
        alpha = 0f
        scaleX = 0.4f
        scaleY = 0.4f
        layoutParams =
          LinearLayout.LayoutParams(dp(SATELLITE_DP), dp(SATELLITE_DP)).apply {
            marginEnd = dp(10)
          }
        setOnClickListener { onTap() }
      }

    holder.addView(
      ImageView(context).apply {
        setImageResource(iconRes)
        layoutParams =
          FrameLayout.LayoutParams(dp(20), dp(20)).apply { gravity = Gravity.CENTER }
      },
    )
    return holder
  }

  private fun setExpanded(next: Boolean) {
    if (expanded == next) {
      return
    }
    expanded = next
    if (next) {
      animateSatellitesIn()
    } else {
      animateSatellitesOut()
    }
  }

  private fun orderedSatellites(): List<FrameLayout> =
    listOf(homeSatellite, stopSatellite, playSatellite)

  private fun animateSatellitesIn() {
    satellites.visibility = View.VISIBLE
    orderedSatellites().forEachIndexed { index, satellite ->
      satellite.animate().cancel()
      satellite
        .animate()
        .alpha(1f)
        .scaleX(1f)
        .scaleY(1f)
        .setStartDelay(index * SATELLITE_STAGGER_MS)
        .setDuration(SATELLITE_DURATION_MS)
        .setInterpolator(OvershootInterpolator(2f))
        .start()
    }
  }

  private fun animateSatellitesOut() {
    val ordered = orderedSatellites().reversed()
    ordered.forEachIndexed { index, satellite ->
      satellite.animate().cancel()
      satellite
        .animate()
        .alpha(0f)
        .scaleX(0.4f)
        .scaleY(0.4f)
        .setStartDelay(index * SATELLITE_STAGGER_MS)
        .setDuration(SATELLITE_DURATION_MS)
        .setInterpolator(AnticipateInterpolator(1.4f))
        .withEndAction {
          if (!expanded && satellite === ordered.last()) {
            satellites.visibility = View.GONE
          }
        }
        .start()
    }
  }

  private fun bubbleBackground(): GradientDrawable = bubble.background as GradientDrawable

  private fun bubbleColorFor(phase: String): Int =
    when (phase) {
      OverlaySnapshot.PHASE_RECORDING -> OverlayPalette.DANGER
      OverlaySnapshot.PHASE_PAUSED -> OverlayPalette.SURFACE
      OverlaySnapshot.PHASE_PROCESSING -> OverlayPalette.SURFACE
      else -> OverlayPalette.ACCENT
    }

  private fun attachTranscript() {
    if (transcriptRoot != null) {
      return
    }
    if (!Settings.canDrawOverlays(context)) {
      return
    }

    val params = buildTranscriptParams()
    val view = buildTranscriptViews()

    try {
      windowManager.addView(view, params)
      transcriptRoot = view
      transcriptParams = params
    } catch (error: Exception) {
      transcriptRoot = null
      transcriptParams = null
    }
  }

  private fun detachTranscript() {
    val view = transcriptRoot ?: return
    transcriptRoot = null
    transcriptParams = null
    try {
      windowManager.removeView(view)
    } catch (error: Exception) {
      Unit
    }
  }

  private fun buildTranscriptParams(): WindowManager.LayoutParams {
    val type =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION")
        WindowManager.LayoutParams.TYPE_PHONE
      }

    return WindowManager.LayoutParams(
        screenWidth() - dp(32),
        WindowManager.LayoutParams.WRAP_CONTENT,
        type,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
          WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
          WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT,
      )
      .apply {
        gravity = Gravity.TOP or Gravity.START
        x = prefs.getInt(KEY_TRANSCRIPT_X, dp(16))
        y = prefs.getInt(KEY_TRANSCRIPT_Y, dp(72))
      }
  }

  @SuppressLint("ClickableViewAccessibility")
  private fun buildTranscriptViews(): LinearLayout {
    val panel =
      LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        background =
          GradientDrawable().apply {
            cornerRadius = dp(16).toFloat()
            setColor(OverlayPalette.PANEL)
          }
        elevation = dp(4).toFloat()
        setPadding(dp(16), dp(12), dp(16), dp(14))
      }

    transcriptStatus =
      TextView(context).apply {
        setTextColor(OverlayPalette.MUTED)
        textSize = 11f
        letterSpacing = 0.06f
      }

    transcriptLabel =
      TextView(context).apply {
        setTextColor(Color.WHITE)
        textSize = 14f
        maxLines = TRANSCRIPT_MAX_LINES
        setLineSpacing(dp(3).toFloat(), 1f)
        setPadding(0, dp(6), 0, 0)
      }

    panel.addView(transcriptStatus)
    panel.addView(transcriptLabel)
    panel.setOnTouchListener(TranscriptTouchListener())
    return panel
  }

  private fun updateTranscript() {
    if (transcriptRoot == null) {
      return
    }
    val live =
      listOf(snapshot.transcript, snapshot.partial)
        .filter { it.isNotEmpty() }
        .joinToString(" ")
    transcriptLabel.text = live
    transcriptLabel.visibility = if (live.isEmpty()) View.GONE else View.VISIBLE
    applyProcessingMessage()
  }

  private fun applyProcessingMessage() {
    if (transcriptRoot == null) {
      return
    }
    transcriptStatus.text =
      when {
        snapshot.detail.isNotEmpty() -> snapshot.detail
        snapshot.phase == OverlaySnapshot.PHASE_PROCESSING -> currentRotatingMessage()
        snapshot.phase == OverlaySnapshot.PHASE_PAUSED ->
          context.getString(R.string.overlay_status_paused)
        else -> context.getString(R.string.overlay_status_listening)
      }
  }

  private fun currentRotatingMessage(): String {
    val messages = context.resources.getStringArray(R.array.overlay_processing_messages)
    if (messages.isEmpty()) {
      return ""
    }
    return messages[rotationIndex % messages.size]
  }

  private fun startRotation() {
    if (rotating) {
      return
    }
    rotating = true
    rotationIndex = 0
    applyProcessingMessage()
    scheduleRotation()
  }

  private fun scheduleRotation() {
    if (!rotating) {
      return
    }
    main.removeCallbacks(rotateMessages)
    main.postDelayed(rotateMessages, ROTATION_INTERVAL_MS)
  }

  private fun stopRotation() {
    rotating = false
    main.removeCallbacks(rotateMessages)
  }

  private fun formatDuration(totalSeconds: Int): String {
    val safe = if (totalSeconds < 0) 0 else totalSeconds
    return String.format("%02d:%02d", safe / 60, safe % 60)
  }

  private fun dp(value: Int): Int =
    (value * context.resources.displayMetrics.density).roundToInt()

  private fun screenWidth(): Int = context.resources.displayMetrics.widthPixels

  private fun safeUpdate(view: View?, params: WindowManager.LayoutParams?) {
    if (view == null || params == null) {
      return
    }
    try {
      windowManager.updateViewLayout(view, params)
    } catch (error: Exception) {
      Unit
    }
  }

  private inner class BubbleTouchListener : View.OnTouchListener {
    private var startX = 0
    private var startY = 0
    private var touchX = 0f
    private var touchY = 0f
    private var dragging = false

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouch(view: View, event: MotionEvent): Boolean {
      val params = bubbleParams ?: return false

      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          startX = params.x
          startY = params.y
          touchX = event.rawX
          touchY = event.rawY
          dragging = false
          bubble.animate().scaleX(0.92f).scaleY(0.92f).setDuration(90).start()
          return true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = (event.rawX - touchX).roundToInt()
          val dy = (event.rawY - touchY).roundToInt()
          if (!dragging && abs(dx) < touchSlop && abs(dy) < touchSlop) {
            return true
          }
          if (!dragging && expanded) {
            setExpanded(false)
          }
          dragging = true
          params.x = startX + dx
          params.y = startY + dy
          safeUpdate(bubbleRoot, params)
          return true
        }
        MotionEvent.ACTION_UP,
        MotionEvent.ACTION_CANCEL -> {
          bubble.animate().scaleX(1f).scaleY(1f).setDuration(120).start()
          if (!dragging) {
            setExpanded(!expanded)
            return true
          }
          snapToEdge(params)
          return true
        }
      }
      return false
    }

    private fun snapToEdge(params: WindowManager.LayoutParams) {
      val margin = dp(12)
      val width = dp(BUBBLE_DP)
      val centre = params.x + width / 2
      val target =
        if (centre < screenWidth() / 2) margin else screenWidth() - width - margin
      val from = params.x

      if (params.y < margin) {
        params.y = margin
      }

      val animator = android.animation.ValueAnimator.ofInt(from, target)
      animator.duration = SNAP_DURATION_MS
      animator.interpolator = DecelerateInterpolator()
      animator.addUpdateListener { value ->
        val live = bubbleParams ?: return@addUpdateListener
        live.x = value.animatedValue as Int
        safeUpdate(bubbleRoot, live)
      }
      animator.start()

      prefs.edit().putInt(KEY_BUBBLE_X, target).putInt(KEY_BUBBLE_Y, params.y).apply()
    }
  }

  private inner class TranscriptTouchListener : View.OnTouchListener {
    private var startX = 0
    private var startY = 0
    private var touchX = 0f
    private var touchY = 0f

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouch(view: View, event: MotionEvent): Boolean {
      val params = transcriptParams ?: return false

      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          startX = params.x
          startY = params.y
          touchX = event.rawX
          touchY = event.rawY
          return true
        }
        MotionEvent.ACTION_MOVE -> {
          params.x = startX + (event.rawX - touchX).roundToInt()
          params.y = startY + (event.rawY - touchY).roundToInt()
          safeUpdate(transcriptRoot, params)
          return true
        }
        MotionEvent.ACTION_UP,
        MotionEvent.ACTION_CANCEL -> {
          prefs
            .edit()
            .putInt(KEY_TRANSCRIPT_X, params.x)
            .putInt(KEY_TRANSCRIPT_Y, params.y)
            .apply()
          return true
        }
      }
      return false
    }
  }

  fun onConfigurationChanged(configuration: Configuration) {
    val params = bubbleParams ?: return
    val maxX = screenWidth() - dp(BUBBLE_DP) - dp(12)
    if (params.x > maxX) {
      params.x = maxX
      safeUpdate(bubbleRoot, params)
    }
    transcriptParams?.let {
      it.width = screenWidth() - dp(32)
      safeUpdate(transcriptRoot, it)
    }
  }

  companion object {
    private const val PREFS_NAME = "medscribe_overlay"
    private const val KEY_BUBBLE_X = "bubble_x"
    private const val KEY_BUBBLE_Y = "bubble_y"
    private const val KEY_TRANSCRIPT_X = "transcript_x"
    private const val KEY_TRANSCRIPT_Y = "transcript_y"
    private const val BUBBLE_DP = 60
    private const val SATELLITE_DP = 44
    private const val TRANSCRIPT_MAX_LINES = 6
    private const val SATELLITE_STAGGER_MS = 45L
    private const val SATELLITE_DURATION_MS = 220L
    private const val SNAP_DURATION_MS = 220L
    private const val ROTATION_INTERVAL_MS = 2500L
    const val ACTION_PLAY = "play"
    const val ACTION_PAUSE = "pause"
    const val ACTION_STOP = "stop"
    const val ACTION_HOME = "home"
  }
}
