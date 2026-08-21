package com.medscribe.overlay

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class DictationOverlayPackage : BaseReactPackage() {

  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    if (name == DICTATION_OVERLAY_NAME) DictationOverlayModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      DICTATION_OVERLAY_NAME to
        ReactModuleInfo(
          name = DICTATION_OVERLAY_NAME,
          className = DictationOverlayModule::class.java.name,
          canOverrideExistingModule = false,
          needsEagerInit = true,
          isCxxModule = false,
          isTurboModule = true,
        )
    )
  }
}
