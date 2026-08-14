package com.medscribe.overlay

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.medscribe.MainActivity
import com.medscribe.R
import java.lang.ref.WeakReference

class DictationBubbleService : Service() {

  @Volatile private var overlay: OverlayViewController? = null
  private var headlessTaskId: Int? = null
  private var reactContextRef: WeakReference<ReactContext>? = null
  private var dictationForeground = false
  private var headlessRetries = 0

  private val main = Handler(Looper.getMainLooper())

  private val headlessRetry = Runnable { startHeadlessTask() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    instance = WeakReference(this)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!promoteForeground(dictationForeground)) {
      running = false
      stopSelf()
      return START_NOT_STICKY
    }

    when (intent?.action) {
      ACTION_STOP_DICTATION -> DictationOverlayBridge.dispatch(OVERLAY_ACTION_STOP)
      ACTION_BEGIN_DICTATION -> beginDictation()
      ACTION_END_DICTATION -> endDictation()
      else -> Unit
    }

    startHeadlessTask()
    showOverlay()
    running = true
    return START_STICKY
  }

  override fun onDestroy() {
    running = false
    instance = null
    hideOverlay()
    finishHeadlessTask()
    DictationOverlayBridge.reset()
    super.onDestroy()
  }

  private fun beginDictation() {
    dictationForeground = true
    if (!promoteForeground(true)) {
      dictationForeground = false
    }
  }

  private fun endDictation() {
    dictationForeground = false
    promoteForeground(false)
  }

  private fun promoteForeground(withMicrophone: Boolean): Boolean {
    val type =
      when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE ->
          if (withMicrophone) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE or
              ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
          } else {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
          }
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ->
          if (withMicrophone) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0
        else -> 0
      }

    return try {
      ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type)
      true
    } catch (error: Exception) {
      Log.w(TAG, "startForeground(type=$type) failed", error)
      false
    }
  }

  private fun showOverlay() {
    if (overlay != null) {
      return
    }
    val controller = OverlayViewController(this)
    if (controller.attach()) {
      overlay = controller
      DictationOverlayBridge.addRenderer(controller)
    }
  }

  private fun hideOverlay() {
    overlay?.let {
      DictationOverlayBridge.removeRenderer(it)
      it.detach()
    }
    overlay = null
  }

  private fun startHeadlessTask() {
    if (headlessTaskId != null) {
      return
    }
    val context = currentReactContext()
    if (context == null) {
      scheduleHeadlessRetry()
      return
    }
    headlessRetries = 0
    reactContextRef = WeakReference(context)

    UiThreadUtil.runOnUiThread {
      try {
        val taskContext = HeadlessJsTaskContext.getInstance(context)
        headlessTaskId =
          taskContext.startTask(
            HeadlessJsTaskConfig(HEADLESS_TASK_NAME, Arguments.createMap(), 0L, true)
          )
      } catch (error: Exception) {
        headlessTaskId = null
      }
    }
  }

  private fun scheduleHeadlessRetry() {
    if (headlessRetries >= HEADLESS_MAX_RETRIES) {
      return
    }
    headlessRetries += 1
    main.removeCallbacks(headlessRetry)
    main.postDelayed(headlessRetry, HEADLESS_RETRY_MS)
  }

  private fun finishHeadlessTask() {
    main.removeCallbacks(headlessRetry)
    val taskId = headlessTaskId ?: return
    val context = reactContextRef?.get()
    headlessTaskId = null
    reactContextRef = null
    if (context == null) {
      return
    }
    UiThreadUtil.runOnUiThread {
      try {
        val taskContext = HeadlessJsTaskContext.getInstance(context)
        if (taskContext.isTaskRunning(taskId)) {
          taskContext.finishTask(taskId)
        }
      } catch (error: Exception) {
        Unit
      }
    }
  }

  private fun currentReactContext(): ReactContext? =
    (application as? ReactApplication)?.reactHost?.currentReactContext

  private fun createNotificationChannel() {
    val channel =
      NotificationChannelCompat.Builder(CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_LOW)
        .setName(getString(R.string.dictation_channel_name))
        .setShowBadge(false)
        .setSound(null, null)
        .build()
    NotificationManagerCompat.from(this).createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    val openApp =
      PendingIntent.getActivity(
        this,
        0,
        Intent(this, MainActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        },
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )

    val stopDictation =
      PendingIntent.getService(
        this,
        1,
        Intent(this, DictationBubbleService::class.java).setAction(ACTION_STOP_DICTATION),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )

    val builder =
      NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_dictation_notification)
        .setContentTitle(getString(R.string.dictation_notification_title))
        .setContentText(
          if (dictationForeground) {
            getString(R.string.dictation_notification_recording)
          } else {
            getString(R.string.dictation_notification_ready)
          }
        )
        .setContentIntent(openApp)
        .setOngoing(true)
        .setSilent(true)
        .setColor(ContextCompat.getColor(this, R.color.notification_accent))
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setVisibility(NotificationCompat.VISIBILITY_SECRET)

    if (dictationForeground) {
      builder.addAction(
        0,
        getString(R.string.dictation_notification_stop),
        stopDictation,
      )
    }

    return builder.build()
  }

  companion object {
    const val CHANNEL_ID = "medscribe_dictation"
    const val NOTIFICATION_ID = 4711
    const val HEADLESS_TASK_NAME = "MedScribeDictation"
    const val OVERLAY_ACTION_STOP = "stop"
    const val ACTION_STOP_DICTATION = "com.medscribe.overlay.STOP_DICTATION"
    const val ACTION_BEGIN_DICTATION = "com.medscribe.overlay.BEGIN_DICTATION"
    const val ACTION_END_DICTATION = "com.medscribe.overlay.END_DICTATION"
    private const val TAG = "DictationBubbleService"
    private const val HEADLESS_RETRY_MS = 750L
    private const val HEADLESS_MAX_RETRIES = 20

    @Volatile
    var running: Boolean = false
      private set

    @Volatile private var instance: WeakReference<DictationBubbleService>? = null

    fun showMessage(text: String): Boolean {
      if (instance?.get()?.overlay == null) {
        return false
      }
      UiThreadUtil.runOnUiThread {
        instance?.get()?.overlay?.showMessage(text)
      }
      return true
    }

    fun setExpanded(expanded: Boolean): Boolean {
      if (instance?.get()?.overlay == null) {
        return false
      }
      UiThreadUtil.runOnUiThread {
        instance?.get()?.overlay?.setExpanded(expanded)
      }
      return true
    }

    fun start(context: Context) {
      ContextCompat.startForegroundService(
        context,
        Intent(context, DictationBubbleService::class.java),
      )
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, DictationBubbleService::class.java))
    }

    fun send(context: Context, action: String) {
      if (!running) {
        return
      }
      ContextCompat.startForegroundService(
        context,
        Intent(context, DictationBubbleService::class.java).setAction(action),
      )
    }
  }
}
