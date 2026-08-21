package com.medscribe

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.medscribe.audio.AudioCapturePackage
import com.medscribe.audio.AudioCuePackage
import com.medscribe.audio.SharedMicPackage
import com.medscribe.config.AppConfigPackage
import com.medscribe.overlay.DictationOverlayPackage
import com.medscribe.pdf.PdfExporterPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(PdfExporterPackage())
          add(AudioCuePackage())
          add(SharedMicPackage())
          add(AppConfigPackage())
          add(DictationOverlayPackage())
          if (BuildConfig.DEBUG) {
            add(AudioCapturePackage())
          }
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}