import { requireNativeModule } from 'expo'

// Native Android module (no-op on other platforms — guarded by lib/overlay.ts).
export default requireNativeModule('VeritasOverlay')
