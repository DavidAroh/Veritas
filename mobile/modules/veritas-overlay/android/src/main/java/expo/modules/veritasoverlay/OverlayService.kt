package expo.modules.veritasoverlay

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.abs

// Foreground service that floats a draggable "V" bubble over other apps.
//   • Tap         → read the current screen, analyze it, show a result panel
//                   (an overlay window — you stay in the app you're in).
//   • Long-press  → dismiss the bubble.
//   • Drag        → reposition.
class OverlayService : Service() {

  private lateinit var windowManager: WindowManager
  private var bubble: View? = null
  private var panel: View? = null
  private val main = Handler(Looper.getMainLooper())

  override fun onBind(intent: Intent?): IBinder? = null
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

  override fun onCreate() {
    super.onCreate()
    startInForeground()
    addBubble()
  }

  // ── Foreground notification ──────────────────────────────────────────────
  private fun startInForeground() {
    val channelId = "veritas_overlay"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(channelId, "Veritas bubble", NotificationManager.IMPORTANCE_MIN)
      (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }
    val notification = NotificationCompat.Builder(this, channelId)
      .setContentTitle("Veritas is active")
      .setContentText("Tap the bubble to fact-check what's on screen")
      .setSmallIcon(android.R.drawable.ic_menu_search)
      .setOngoing(true)
      .build()
    startForeground(1001, notification)
  }

  // ── The bubble ───────────────────────────────────────────────────────────
  private fun addBubble() {
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    val size = dp(56)
    val view = TextView(this).apply {
      text = "V"
      setTextColor(Color.BLACK)
      textSize = 22f
      gravity = Gravity.CENTER
      typeface = Typeface.DEFAULT_BOLD
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(ACID)
        setStroke(dp(2), BG)
      }
    }

    val params = WindowManager.LayoutParams(
      size, size, overlayType(),
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = dp(16); y = dp(200)
    }

    view.setOnTouchListener(object : View.OnTouchListener {
      var downX = 0f; var downY = 0f
      var startX = 0; var startY = 0
      var moved = false
      var longFired = false
      val longPress = Runnable {
        longFired = true
        dismissBubble()
      }
      override fun onTouch(v: View, e: MotionEvent): Boolean {
        when (e.action) {
          MotionEvent.ACTION_DOWN -> {
            downX = e.rawX; downY = e.rawY
            startX = params.x; startY = params.y
            moved = false; longFired = false
            main.postDelayed(longPress, 600)
          }
          MotionEvent.ACTION_MOVE -> {
            val dx = (e.rawX - downX).toInt()
            val dy = (e.rawY - downY).toInt()
            if (abs(dx) > dp(8) || abs(dy) > dp(8)) {
              moved = true
              main.removeCallbacks(longPress)
            }
            params.x = startX + dx
            params.y = startY + dy
            windowManager.updateViewLayout(v, params)
          }
          MotionEvent.ACTION_UP -> {
            main.removeCallbacks(longPress)
            if (!moved && !longFired) onBubbleTap()
          }
          MotionEvent.ACTION_CANCEL -> main.removeCallbacks(longPress)
        }
        return true
      }
    })

    bubble = view
    windowManager.addView(view, params)
  }

  private fun dismissBubble() {
    Toast.makeText(this, "Veritas bubble hidden", Toast.LENGTH_SHORT).show()
    stopSelf()
  }

  // ── Tap → capture, analyze, render ───────────────────────────────────────
  private fun onBubbleTap() {
    if (panel != null) { removePanel(); return }
    val text = VeritasAccessibilityService.instance?.grabScreenText() ?: ""
    if (text.length < 200) {
      showInfoPanel("Not enough readable text on this screen to analyze.")
      return
    }
    showLoadingPanel()
    Thread {
      try {
        val result = analyze(text)
        main.post { showPanel(buildResultPanel(result)) }
      } catch (e: Exception) {
        main.post { showInfoPanel(e.message ?: "Analysis failed.") }
      }
    }.start()
  }

  // ── Networking (mirrors lib/api.ts: backend first, then direct Gemini) ───
  private fun analyze(content: String): JSONObject {
    val apiBase = VeritasCapture.apiBase.trimEnd('/')
    if (apiBase.isNotEmpty()) {
      try {
        val body = JSONObject().put("content", content).toString()
        val resp = httpPost("$apiBase/api/analyze", body)
        if (resp.first in 200..299) return JSONObject(resp.second)
      } catch (_: Exception) { /* fall through to direct Gemini */ }
    }

    val key = VeritasCapture.geminiKey
    if (key.isEmpty()) throw Exception("Set a Backend URL or Gemini key in Veritas settings.")
    val model = VeritasCapture.model.ifEmpty { "gemini-2.5-flash" }

    val userPart = JSONObject().put("text", JSONObject().put("content", content).toString())
    val payload = JSONObject()
      .put("system_instruction", JSONObject().put("parts", JSONArray().put(JSONObject().put("text", SYSTEM_PROMPT))))
      .put("contents", JSONArray().put(JSONObject().put("role", "user").put("parts", JSONArray().put(userPart))))
      .put("tools", JSONArray().put(JSONObject().put("google_search", JSONObject())))
      .put("generationConfig", JSONObject().put("temperature", 0.2).put("maxOutputTokens", 2000))

    val url = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$key"
    val resp = httpPost(url, payload.toString())
    if (resp.first !in 200..299) throw Exception("Gemini error ${resp.first}")

    val parts = JSONObject(resp.second)
      .optJSONArray("candidates")?.optJSONObject(0)
      ?.optJSONObject("content")?.optJSONArray("parts")
    val sb = StringBuilder()
    if (parts != null) for (i in 0 until parts.length()) sb.append(parts.optJSONObject(i)?.optString("text") ?: "")
    val clean = sb.toString().replace("```json", "").replace("```", "").trim()
    return JSONObject(clean)
  }

  private fun httpPost(urlStr: String, body: String): Pair<Int, String> {
    val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      connectTimeout = 15000
      readTimeout = 35000
      doOutput = true
      setRequestProperty("Content-Type", "application/json")
    }
    conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
    val code = conn.responseCode
    val stream = if (code in 200..299) conn.inputStream else conn.errorStream
    val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
    conn.disconnect()
    return Pair(code, text)
  }

  // ── Panels ───────────────────────────────────────────────────────────────
  private fun showLoadingPanel() {
    val col = column()
    col.addView(makeText("Analyzing screen…", 14f, TEXT2, false))
    col.addView(ProgressBar(this).apply {
      isIndeterminate = true
      val lp = LinearLayout.LayoutParams(dp(28), dp(28)); lp.topMargin = dp(12); layoutParams = lp
    })
    showPanel(wrapScroll(col))
  }

  private fun showInfoPanel(message: String) {
    val col = column()
    col.addView(closeButton())
    col.addView(makeText(message, 13f, TEXT, false))
    showPanel(wrapScroll(col))
  }

  private fun buildResultPanel(r: JSONObject): View {
    val col = column()
    col.addView(closeButton())

    val score = r.optInt("credibility_score")
    val sc = scoreColor(score)
    col.addView(makeText("$score/100", 30f, sc, true))
    col.addView(makeText(r.optString("credibility_label", "Unverified"), 16f, sc, true))
    col.addView(spacer(8))
    col.addView(makeText(r.optString("page_summary"), 13f, TEXT2, false))

    val warning = r.optString("user_warning_message")
    if (warning.isNotBlank()) {
      col.addView(spacer(10))
      col.addView(makeText("⚠ $warning", 13f, sc, false))
    }

    col.addView(spacer(14))
    col.addView(sectionTitle("Final verdict"))
    col.addView(makeText(r.optString("final_verdict"), 13f, TEXT, false))

    val claims = r.optJSONArray("claims")
    if (claims != null && claims.length() > 0) {
      col.addView(spacer(14))
      col.addView(sectionTitle("Claims (${claims.length()})"))
      for (i in 0 until claims.length()) {
        val c = claims.optJSONObject(i) ?: continue
        val v = c.optString("verification", "UNVERIFIED")
        col.addView(spacer(8))
        col.addView(makeText("${verdictIcon(v)} $v · ${c.optString("confidence")}", 11f, verdictColor(v), true))
        col.addView(makeText(c.optString("claim"), 13f, TEXT, false))
      }
    }
    return wrapScroll(col)
  }

  private fun showPanel(content: View) {
    removePanel()
    val dm = resources.displayMetrics
    val params = WindowManager.LayoutParams(
      (dm.widthPixels * 0.92).toInt(),
      (dm.heightPixels * 0.72).toInt(),
      overlayType(),
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT,
    ).apply { gravity = Gravity.CENTER }

    val card = FrameLayout(this).apply {
      background = GradientDrawable().apply {
        cornerRadius = dp(14).toFloat()
        setColor(BG2)
        setStroke(dp(1), BORDER)
      }
      addView(content)
    }
    panel = card
    windowManager.addView(card, params)
  }

  private fun removePanel() {
    panel?.let { try { windowManager.removeView(it) } catch (_: Exception) {} }
    panel = null
  }

  // ── View helpers ─────────────────────────────────────────────────────────
  private fun column() = LinearLayout(this).apply {
    orientation = LinearLayout.VERTICAL
    setPadding(dp(18), dp(14), dp(18), dp(18))
  }

  private fun wrapScroll(child: View) = ScrollView(this).apply { addView(child) }

  private fun closeButton() = TextView(this).apply {
    text = "✕"; setTextColor(TEXT3); textSize = 18f; gravity = Gravity.END
    setOnClickListener { removePanel() }
  }

  private fun sectionTitle(t: String) = TextView(this).apply {
    text = t.uppercase(); setTextColor(TEXT3); textSize = 10f
    letterSpacing = 0.12f
    val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
    lp.bottomMargin = dp(6); layoutParams = lp
  }

  private fun makeText(t: String, sizeSp: Float, color: Int, bold: Boolean) = TextView(this).apply {
    text = t; setTextColor(color); textSize = sizeSp
    if (bold) typeface = Typeface.DEFAULT_BOLD
    setLineSpacing(0f, 1.2f)
  }

  private fun spacer(h: Int) = View(this).apply {
    layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(h))
  }

  private fun overlayType() =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    else
      @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

  private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

  private fun scoreColor(s: Int) = when {
    s >= 75 -> GREEN; s >= 45 -> BLUE; s >= 25 -> AMBER; else -> RED
  }
  private fun verdictColor(v: String) = when (v) {
    "TRUE" -> GREEN; "MISLEADING" -> AMBER; "FALSE" -> RED; else -> GRAY
  }
  private fun verdictIcon(v: String) = when (v) {
    "TRUE" -> "✓"; "MISLEADING" -> "~"; "FALSE" -> "✕"; else -> "?"
  }

  override fun onDestroy() {
    main.removeCallbacksAndMessages(null)
    removePanel()
    bubble?.let { try { windowManager.removeView(it) } catch (_: Exception) {} }
    bubble = null
    super.onDestroy()
  }

  companion object {
    private val ACID = Color.parseColor("#B8FF57")
    private val BG = Color.parseColor("#0a0a0a")
    private val BG2 = Color.parseColor("#0d0d0d")
    private val BORDER = Color.parseColor("#1f1f1f")
    private val TEXT = Color.parseColor("#e8e6e0")
    private val TEXT2 = Color.parseColor("#c0beb8")
    private val TEXT3 = Color.parseColor("#666660")
    private val GREEN = Color.parseColor("#4ade80")
    private val BLUE = Color.parseColor("#60a5fa")
    private val AMBER = Color.parseColor("#ffab40")
    private val RED = Color.parseColor("#ff4545")
    private val GRAY = Color.parseColor("#888880")

    private const val SYSTEM_PROMPT =
      "You are Veritas Agent, an AI-powered truth verification assistant. " +
        "Use the Google Search tool to verify claims against current real sources before labeling them. " +
        "Extract 3-6 verifiable claims, label each TRUE/MISLEADING/FALSE/UNVERIFIED, detect misinformation " +
        "signals, evaluate source credibility, and produce a 0-100 credibility score. " +
        "Return ONLY valid JSON, no markdown, no code fences: " +
        "{\"page_summary\":\"\",\"credibility_score\":0,\"credibility_label\":\"Verified|Partially Verified|Misleading|Unverified|False\"," +
        "\"claims\":[{\"claim\":\"\",\"verification\":\"TRUE|MISLEADING|FALSE|UNVERIFIED\",\"confidence\":\"87%\",\"reason\":\"\"}]," +
        "\"misinformation_signals\":[],\"source_reliability\":\"\",\"final_verdict\":\"\",\"user_warning_message\":\"\"}"
  }
}
