package com.medscribe.pdf

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Registers the PDF exporter with the New Architecture module registry.
 * App-local modules are not autolinked, so this package is added explicitly in `MainApplication.kt`.
 */
class PdfExporterPackage : BaseReactPackage() {

  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    if (name == PDF_EXPORTER_NAME) PdfExporterModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      PDF_EXPORTER_NAME to
        ReactModuleInfo(
          PDF_EXPORTER_NAME,
          PdfExporterModule::class.java.name,
          false, // canOverrideExistingModule
          false, // needsEagerInit
          false, // isCxxModule
          true, // isTurboModule
        )
    )
  }
}
