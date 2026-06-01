package expo.modules.veritasoverlay

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

// Reads the visible text of whatever app is in the foreground, on demand.
// We expose a static instance so OverlayService can grab the screen text the
// instant the bubble is tapped (rather than continuously scraping).
class VeritasAccessibilityService : AccessibilityService() {

  companion object {
    @Volatile
    var instance: VeritasAccessibilityService? = null
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
  }

  override fun onDestroy() {
    if (instance === this) instance = null
    super.onDestroy()
  }

  // We don't react to events; capture happens on demand.
  override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
  override fun onInterrupt() {}

  /** Walks the active window's node tree and returns its readable text. */
  fun grabScreenText(): String {
    val root = rootInActiveWindow ?: return ""
    val sb = StringBuilder()
    try {
      collect(root, sb)
    } finally {
      try { root.recycle() } catch (_: Exception) {}
    }
    return sb.toString().replace(Regex("\\s+"), " ").trim().take(8000)
  }

  private fun collect(node: AccessibilityNodeInfo?, sb: StringBuilder) {
    if (node == null) return
    node.text?.let { if (it.isNotBlank()) sb.append(it).append(' ') }
    node.contentDescription?.let { if (it.isNotBlank()) sb.append(it).append(' ') }
    for (i in 0 until node.childCount) {
      val child = node.getChild(i)
      collect(child, sb)
      try { child?.recycle() } catch (_: Exception) {}
    }
  }
}
