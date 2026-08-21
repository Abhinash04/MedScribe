package com.medscribe.overlay

import android.content.Context
import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import java.lang.ref.WeakReference

class OverlayReviewActivity : ReactActivity() {

  override fun getMainComponentName(): String = REVIEW_COMPONENT_NAME

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    current = WeakReference(this)
  }

  override fun onDestroy() {
    if (current?.get() === this) {
      current = null
    }
    super.onDestroy()
  }

  companion object {
    const val REVIEW_COMPONENT_NAME = "MedScribeReview"

    private var current: WeakReference<OverlayReviewActivity>? = null

    fun open(context: Context) {
      context.startActivity(
        Intent(context, OverlayReviewActivity::class.java)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      )
    }

    fun close() {
      current?.get()?.finish()
      current = null
    }
  }
}
