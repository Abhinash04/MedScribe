package com.medscribe.config

import com.facebook.react.bridge.ReactApplicationContext
import com.medscribe.BuildConfig
import com.medscribe.specs.NativeAppConfigSpec

const val APP_CONFIG_NAME = "AppConfig"
class AppConfigModule(reactContext: ReactApplicationContext) :
  NativeAppConfigSpec(reactContext) {

  override fun getAnuvadiniToken(): String = BuildConfig.ANUVADINI_STT_TOKEN
}
