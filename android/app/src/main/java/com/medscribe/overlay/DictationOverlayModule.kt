package com.medscribe.overlay

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.medscribe.specs.NativeDictationOverlaySpec

const val DICTATION_OVERLAY_NAME = "DictationOverlay"

@ReactModule(name = DICTATION_OVERLAY_NAME)
class DictationOverlayModule(private val reactContext: ReactApplicationContext) :
  NativeDictationOverlaySpec(reactContext) {

  init {
    DictationOverlayBridge.setEmitter { action ->
      emitOnOverlayCommand(Arguments.createMap().apply { putString("action", action) })
    }
  }

  override fun getName(): String = DICTATION_OVERLAY_NAME

  override fun canDrawOverlays(): Boolean = Settings.canDrawOverlays(reactContext)

  override fun isServiceRunning(): Boolean = DictationBubbleService.running

  override fun requestOverlayPermission(promise: Promise) {
    if (Settings.canDrawOverlays(reactContext)) {
      promise.resolve(true)
      return
    }

    val packageUri = Uri.parse("package:${reactContext.packageName}")
    val candidates =
      listOf(
        Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, packageUri),
        Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION),
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri),
      )

    for (intent in candidates) {
      if (launchSettings(intent)) {
        promise.resolve(false)
        return
      }
    }

    promise.reject(
      "E_NO_OVERLAY_SETTINGS",
      "No settings activity on this device accepted an overlay permission request",
    )
  }

  private fun launchSettings(intent: Intent): Boolean {
    val activity = reactContext.currentActivity
    if (activity != null) {
      try {
        activity.startActivity(intent)
        return true
      } catch (error: Exception) {
        Unit
      }
    }
    return try {
      reactContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      true
    } catch (error: Exception) {
      false
    }
  }

  override fun getOverlayDiagnostics(): WritableMap {
    val diagnostics = Arguments.createMap()
    diagnostics.putBoolean("canDrawOverlays", Settings.canDrawOverlays(reactContext))
    diagnostics.putBoolean("serviceRunning", DictationBubbleService.running)
    diagnostics.putBoolean("windowAttached", DictationOverlayBridge.windowAttached)
    diagnostics.putInt("sdkInt", Build.VERSION.SDK_INT)
    diagnostics.putString("manufacturer", Build.MANUFACTURER)
    diagnostics.putString("model", Build.MODEL)
    diagnostics.putString("installerPackage", installerPackage())
    return diagnostics
  }

  private fun installerPackage(): String =
    try {
      val packageManager = reactContext.packageManager
      val name =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          packageManager.getInstallSourceInfo(reactContext.packageName).installingPackageName
        } else {
          @Suppress("DEPRECATION")
          packageManager.getInstallerPackageName(reactContext.packageName)
        }
      name ?: "none"
    } catch (error: Exception) {
      "unknown"
    }

  override fun startBubbleService(promise: Promise) {
    if (!Settings.canDrawOverlays(reactContext)) {
      promise.resolve(false)
      return
    }
    try {
      DictationBubbleService.start(reactContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("E_SERVICE_START", error)
    }
  }

  override fun stopBubbleService(promise: Promise) {
    try {
      DictationBubbleService.stop(reactContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("E_SERVICE_STOP", error)
    }
  }

  override fun beginDictationForeground(promise: Promise) {
    DictationBubbleService.send(reactContext, DictationBubbleService.ACTION_BEGIN_DICTATION)
    promise.resolve(DictationBubbleService.running)
  }

  override fun endDictationForeground(promise: Promise) {
    DictationBubbleService.send(reactContext, DictationBubbleService.ACTION_END_DICTATION)
    promise.resolve(DictationBubbleService.running)
  }

  override fun pushState(snapshot: ReadableMap) {
    DictationOverlayBridge.publish(OverlaySnapshot.from(snapshot))
  }

  override fun setExpanded(expanded: Boolean) {
    DictationOverlayBridge.dispatch(
      if (expanded) OverlayViewController.ACTION_PLAY else OverlayViewController.ACTION_PAUSE
    )
  }

  override fun openReviewSurface(promise: Promise) {
    try {
      OverlayReviewActivity.open(reactContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("E_REVIEW_OPEN", error)
    }
  }

  override fun closeReviewSurface(promise: Promise) {
    OverlayReviewActivity.close()
    promise.resolve(true)
  }

  override fun handoffToReport(promise: Promise) {
    try {
      OverlayReviewActivity.close()
      val intent =
        reactContext.packageManager
          .getLaunchIntentForPackage(reactContext.packageName)
          ?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      if (intent == null) {
        promise.resolve(false)
        return
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("E_HANDOFF", error)
    }
  }

  override fun invalidate() {
    DictationOverlayBridge.clearEmitter()
    super.invalidate()
  }
}
