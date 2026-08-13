package com.medscribe.overlay

import android.os.Handler
import android.os.Looper
import java.util.ArrayDeque
import java.util.concurrent.CopyOnWriteArrayList

interface OverlayRenderer {
  fun render(snapshot: OverlaySnapshot)
}

object DictationOverlayBridge {

  private val main = Handler(Looper.getMainLooper())
  private val pendingCommands = ArrayDeque<String>()
  private val renderers = CopyOnWriteArrayList<OverlayRenderer>()

  @Volatile private var emitter: ((String) -> Unit)? = null

  @Volatile
  var latest: OverlaySnapshot = OverlaySnapshot.idle()
    private set

  @Volatile
  var dictationActive: Boolean = false
    private set

  @Volatile
  var windowAttached: Boolean = false

  fun setEmitter(next: (String) -> Unit) {
    emitter = next
    main.post { drainPending() }
  }

  fun clearEmitter() {
    emitter = null
  }

  fun dispatch(action: String) {
    main.post {
      val target = emitter
      if (target == null) {
        pendingCommands.addLast(action)
      } else {
        target(action)
      }
    }
  }

  fun publish(snapshot: OverlaySnapshot) {
    if (snapshot == latest) {
      return
    }
    latest = snapshot
    dictationActive =
      snapshot.phase == OverlaySnapshot.PHASE_RECORDING ||
        snapshot.phase == OverlaySnapshot.PHASE_PAUSED
    main.post {
      renderers.forEach { it.render(snapshot) }
    }
  }

  fun addRenderer(renderer: OverlayRenderer) {
    renderers.addIfAbsent(renderer)
    val snapshot = latest
    main.post { renderer.render(snapshot) }
  }

  fun removeRenderer(renderer: OverlayRenderer) {
    renderers.remove(renderer)
  }

  fun reset() {
    latest = OverlaySnapshot.idle()
    dictationActive = false
    pendingCommands.clear()
  }

  private fun drainPending() {
    val target = emitter ?: return
    while (pendingCommands.isNotEmpty()) {
      target(pendingCommands.removeFirst())
    }
  }
}
