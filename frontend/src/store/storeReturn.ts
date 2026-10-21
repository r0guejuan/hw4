/**
 * Remembers where the shopper was standing in the virtual store, so that after Handsome Dan (or a
 * display) sends them to products, "Back to the virtual store" drops them in the exact same spot,
 * facing the same way. Kept in sessionStorage; small enough to import from any page without
 * pulling in three.js.
 */

export interface StorePose {
  zone: 'outside' | 'inside'
  x: number
  z: number
  yaw: number
  pitch: number
}

const POSE_KEY = 'campus-customs:store-pose'
const RETURN_KEY = 'campus-customs:store-return'

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable: the store just starts fresh next time
  }
}

/** Called by the store as the shopper moves (and when it unmounts). */
export function rememberStorePose(pose: StorePose) {
  write(POSE_KEY, pose)
}

/** Called when the store sends the shopper to products (Dan's results, a display, a product). */
export function markCameFromStore() {
  write(RETURN_KEY, true)
}

/** True while the shopper is browsing products they reached from the virtual store. */
export function cameFromStore(): boolean {
  return read<boolean>(RETURN_KEY) === true
}

/** On returning to the store: the spot to resume from (once), or null to start at the door. */
export function takeStoreReturnPose(): StorePose | null {
  if (!cameFromStore()) return null
  write(RETURN_KEY, null)
  return read<StorePose>(POSE_KEY)
}

/** Leaving the store for the regular site: forget the return trip. */
export function clearStoreReturn() {
  write(RETURN_KEY, null)
}
