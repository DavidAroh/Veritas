// Polyfills for Next.js server route runtime under Jest.
import { TextEncoder, TextDecoder } from 'util'

if (typeof (globalThis as any).TextEncoder === 'undefined') {
  ;(globalThis as any).TextEncoder = TextEncoder
}
if (typeof (globalThis as any).TextDecoder === 'undefined') {
  ;(globalThis as any).TextDecoder = TextDecoder as any
}

// next/server pulls in Request/Response/Headers via undici on Node 18+,
// but we need to make sure crypto.randomUUID etc. are available.
import { webcrypto } from 'crypto'
if (typeof (globalThis as any).crypto === 'undefined') {
  ;(globalThis as any).crypto = webcrypto as Crypto
}
