package com.medscribe

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.medscribe.audio.AudioCapturePackage
import com.medscribe.audio.AudioCuePackage
import com.medscribe.pdf.PdfExporterPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // App-local modules are never autolinked — this one renders patient reports to PDF. See android/app/src/main/java/com/medscribe/pdf.
          add(PdfExporterPackage())
          // Plays the one dictation cue and mutes the system recognizer's
          // per-utterance tones. See android/app/src/main/java/com/medscribe/audio.
          add(AudioCuePackage())
          // Phase 1 spike: concurrent PCM capture probe. Remove with the spike.
          add(AudioCapturePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}