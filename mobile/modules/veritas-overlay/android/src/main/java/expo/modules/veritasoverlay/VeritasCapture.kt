package expo.modules.veritasoverlay

// Process-global holder for the bubble's runtime config. JS passes the user's
// backend URL / Gemini key when starting the bubble so the native
// OverlayService can run the analysis itself and render the result in an
// overlay panel — without bringing the RN app to the foreground.
object VeritasCapture {
  @Volatile var apiBase: String = ""
  @Volatile var geminiKey: String = ""
  @Volatile var model: String = "gemini-2.5-flash"

  // Retained for the legacy "open app with captured text" path.
  @Volatile var pending: String? = null
}
