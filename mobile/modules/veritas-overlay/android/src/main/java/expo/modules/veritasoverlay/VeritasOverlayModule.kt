package expo.modules.veritasoverlay

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class VeritasOverlayModule : Module() {

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context unavailable")

  override fun definition() = ModuleDefinition {
    Name("VeritasOverlay")

    // ── "Display over other apps" permission ──────────────────────────────
    Function("hasOverlayPermission") {
      Settings.canDrawOverlays(context)
    }

    Function("requestOverlayPermission") {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}")
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    // ── Accessibility service (screen reading) ────────────────────────────
    Function("isAccessibilityEnabled") {
      val expected = "${context.packageName}/${VeritasAccessibilityService::class.java.name}"
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
      ) ?: ""
      enabled.split(':').any { it.equals(expected, ignoreCase = true) }
    }

    Function("openAccessibilitySettings") {
      context.startActivity(
        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }

    // ── Bubble lifecycle ──────────────────────────────────────────────────
    // The bubble runs analysis natively, so it needs the user's backend/key.
    Function("startBubble") { apiBase: String, geminiKey: String, model: String ->
      if (!Settings.canDrawOverlays(context)) return@Function false
      VeritasCapture.apiBase = apiBase
      VeritasCapture.geminiKey = geminiKey
      VeritasCapture.model = model
      val intent = Intent(context, OverlayService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
      true
    }

    Function("stopBubble") {
      context.stopService(Intent(context, OverlayService::class.java))
    }

    // ── Hand the captured screen text to JS ───────────────────────────────
    Function("getPendingCapture") {
      val text = VeritasCapture.pending
      VeritasCapture.pending = null
      text ?: ""
    }
  }
}
