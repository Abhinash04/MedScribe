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
          // Owns the microphone for a consultation and feeds the recognizer
          // through a pipe, so one dictation yields both a live transcript and
          // the recording the second transcription needs.
          add(SharedMicPackage())
          // Build-time configuration the app must not carry in committed
          // JavaScript. See android/app/build.gradle.
          add(AppConfigPackage())
          // Phase 1 spike: concurrent PCM capture probe. Debug only — a
          // microphone-capture module has no business in a build handed to a
          // doctor, and the screens that drive it are already __DEV__ gated.
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