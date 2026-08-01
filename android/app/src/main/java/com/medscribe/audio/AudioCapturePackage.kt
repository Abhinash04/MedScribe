package com.medscribe.audio

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class AudioCapturePackage : BaseReactPackage() {

  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    if (name == AUDIO_CAPTURE_NAME) AudioCaptureModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      AUDIO_CAPTURE_NAME to
        ReactModuleInfo(
          AUDIO_CAPTURE_NAME,
          AudioCaptureModule::class.java.name,
          false,
          false,
          false,
          true,
        )
    )
  }
}
