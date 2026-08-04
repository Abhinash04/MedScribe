package com.medscribe.config

import com.facebook.react.bridge.ReactApplicationContext
import com.medscribe.BuildConfig
import com.medscribe.specs.NativeAppConfigSpec

const val APP_CONFIG_NAME = "AppConfig"

/**
 * Build-time configuration, kept out of committed JavaScript.
 *
 * The Anuvadini token arrives from `android/local.properties` via BuildConfig,
 * so it is never in Git and never a literal in a source file. It is still
 * readable from a compiled APK; only moving the call behind our own service
 * removes it from the device entirely.
 *
 * Synchronous on purpose — the value is a compile-time constant, and the client
 * needs it before it can decide which transport to use.
 */
class AppConfigModule(reactContext: ReactApplicationContext) :
  NativeAppConfigSpec(reactContext) {

  override fun getAnuvadiniToken(): String = BuildConfig.ANUVADINI_STT_TOKEN
}
