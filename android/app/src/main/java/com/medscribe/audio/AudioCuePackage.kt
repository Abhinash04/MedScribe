package com.medscribe.audio

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class AudioCuePackage : BaseReactPackage() {

  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    if (name == AUDIO_CUE_NAME) AudioCueModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      AUDIO_CUE_NAME to
        ReactModuleInfo(
          AUDIO_CUE_NAME,
          AudioCueModule::class.java.name,
          false,
          false,
          false,
          true,
        )
    )
  }
}