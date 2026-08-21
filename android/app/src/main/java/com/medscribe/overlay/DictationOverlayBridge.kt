package com.medscribe.overlay

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import java.util.ArrayDeque
import java.util.concurrent.CopyOnWriteArrayList

interface OverlayRenderer {
  fun render(snapshot: OverlaySnapshot)
}

object DictationOverlayBridge {

  private const val PENDING_LIMIT = 8
  private const val PENDING_TTL_MS = 10_000L

  private data class PendingCommand(val action: String, val at: Long)

  private val main = Handler(Looper.getMainLooper())
  private val pendingCommands = ArrayDeque<PendingCommand>()
  private val renderers = CopyOnWriteArrayList<OverlayRenderer>()

  @Volatile private var emitter: ((String) -> Unit)? = null
  @Volatile private var emitterOwner: Any? = null

  @Volatile
  var latest: OverlaySnapshot = OverlaySnapshot.idle()
    private set

  @Volatile
  var dictationActive: Boolean = false
    private set

  @Volatile
  var windowAttached: Boolean = false

  fun setEmitter(owner: Any, next: (String) -> Unit) {
    emitterOwner = owner
    emitter = next
    main.post { drainPending() }
  }

  fun clearEmitter(owner: Any) {
    if (emitterOwner !== owner) {
      return
    }
    emitterOwner = null
    emitter = null
  }

  fun dispatch(action: String) {
    main.post {
      val target = emitter
      if (target == null) {
        while (pendingCommands.size >= PENDING_LIMIT) {
          pendingCommands.removeFirst()
        }
        pendingCommands.addLast(PendingCommand(action, SystemClock.uptimeMillis()))
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
    val now = SystemClock.uptimeMillis()
    while (pendingCommands.isNotEmpty()) {
      val pending = pendingCommands.removeFirst()
      if (now - pending.at <= PENDING_TTL_MS) {
        target(pending.action)
      }
    }
  }
}
