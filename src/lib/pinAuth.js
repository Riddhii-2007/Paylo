/**
 * pinAuth.js — Pure PIN authentication helpers.
 *
 * Exported symbols are shared between PinLockScreen, Settings, usePinLock,
 * and the test suite. No side-effects; no React imports.
 */

// ── Rate-limiting constants ──────────────────────────────────────────────────
export const MAX_ATTEMPTS = 3
export const LOCKOUT_SECONDS = 30

/** Returns a fresh rate-limit state object. */
export function initialRateLimitState() {
  return { attempts: 0, lockedUntil: null }
}

/**
 * Pure rate-limit step function.
 *
 * @param {{ attempts: number, lockedUntil: number|null }} state
 * @param {boolean} correct — whether the PIN attempt was correct
 * @returns {{ newState, result }}
 *   result.status: 'unlocked' | 'wrong' | 'locked_now' | 'locked'
 */
export function processAttempt(state, correct) {
  // Already locked out?
  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    return {
      newState: state,
      result: {
        status: 'locked',
        remaining: Math.ceil((state.lockedUntil - Date.now()) / 1000)
      }
    }
  }

  if (correct) {
    return {
      newState: { attempts: 0, lockedUntil: null },
      result: { status: 'unlocked' }
    }
  }

  const next = state.attempts + 1
  if (next >= MAX_ATTEMPTS) {
    const lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000
    return {
      newState: { attempts: next, lockedUntil },
      result: { status: 'locked_now', attempts: next }
    }
  }

  return {
    newState: { attempts: next, lockedUntil: null },
    result: { status: 'wrong', attempts: next }
  }
}

/** Returns true if the given state is currently in a lockout window. */
export function isLockedOut(state) {
  return !!(state.lockedUntil && Date.now() < state.lockedUntil)
}

// ── PIN string validation ────────────────────────────────────────────────────

/** Returns true for a valid 4-digit numeric PIN string. */
export function validatePin(p) {
  return typeof p === 'string' && p.length === 4 && /^\d+$/.test(p)
}

// ── PIN hashing (PBKDF2-SHA-256, 100 000 iterations) ────────────────────────

const PBKDF2_ITERATIONS = 100_000

async function deriveBits(pin, salt) {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return new Uint8Array(bits)
}

function toBase64(buf) {
  return btoa(String.fromCharCode(...buf))
}

function fromBase64(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

/**
 * Creates a hashed PIN record from a plain PIN string.
 * The record — not the PIN — is what gets stored in IndexedDB.
 *
 * @param {string} pin
 * @returns {Promise<{ salt: string, hash: string }>}
 */
export async function createPinRecord(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveBits(pin, salt)
  return { salt: toBase64(salt), hash: toBase64(hash) }
}

/** Constant-time byte comparison to prevent timing attacks. */
function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/**
 * Verifies a plain PIN against a stored { salt, hash } record.
 *
 * @param {string} pin
 * @param {{ salt: string, hash: string }} record
 * @returns {Promise<boolean>}
 */
export async function verifyPin(pin, record) {
  if (!record || typeof record !== 'object' || !record.salt || !record.hash) return false
  try {
    const salt = fromBase64(record.salt)
    const expected = fromBase64(record.hash)
    const actual = await deriveBits(pin, salt)
    return constantTimeEqual(actual, expected)
  } catch {
    return false
  }
}

/**
 * Returns true if the stored pin value is a legacy plain-text PIN
 * (a short string, from before hashing was introduced).
 */
export function isLegacyPin(value) {
  return typeof value === 'string' && value.length <= 8
}
