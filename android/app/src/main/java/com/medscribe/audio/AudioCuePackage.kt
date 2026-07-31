package com.medscribe.audio

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Registers the audio cue module with the New Architecture module registry.
 * App-local modules are not autolinked, so this package is added explicitly in `MainApplication.kt`.
 */
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
          false, // canOverrideExistingModule
          false, // needsEagerInit
          false, // isCxxModule
          true, // isTurboModule
        )
    )
  }
}