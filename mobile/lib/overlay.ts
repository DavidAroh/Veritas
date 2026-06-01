// Safe wrapper around the native Android overlay module. On iOS, Expo Go, or
// any build where the native module isn't present, every call is a harmless
// no-op and `overlaySupported` is false — so screens can hide the UI.

import { Platform } from 'react-native'

interface OverlayNative {
  hasOverlayPermission(): boolean
  requestOverlayPermission(): void
  isAccessibilityEnabled(): boolean
  openAccessibilitySettings(): void
  startBubble(apiBase: string, geminiKey: string, model: string): boolean
  stopBubble(): void
  getPendingCapture(): string
}

let native: OverlayNative | null = null
if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    native = require('@/modules/veritas-overlay').default as OverlayNative
  } catch {
    native = null
  }
}

export const overlaySupported = native != null

export function hasOverlayPermission(): boolean {
  return native?.hasOverlayPermission() ?? false
}
export function requestOverlayPermission(): void {
  native?.requestOverlayPermission()
}
export function isAccessibilityEnabled(): boolean {
  return native?.isAccessibilityEnabled() ?? false
}
export function openAccessibilitySettings(): void {
  native?.openAccessibilitySettings()
}
export function startBubble(apiBase: string, geminiKey: string, model: string): boolean {
  return native?.startBubble(apiBase, geminiKey, model) ?? false
}
export function stopBubble(): void {
  native?.stopBubble()
}
/** Text captured by the last bubble tap, or '' if none. Clears after reading. */
export function getPendingCapture(): string {
  return native?.getPendingCapture() ?? ''
}
