/* eslint-disable react/immutability --
 * react-three-fiber's frame loop (useFrame) is where the camera and input refs are meant to be
 * mutated every frame, outside React rendering; the React-compiler immutability rule doesn't
 * apply to it. */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { EYE_HEIGHT, OUTSIDE_LOOK, ROOM, SPAWN_INSIDE, SPAWN_OUTSIDE, collide, type StoreAction, type Zone } from './layout'
import type { StorePose } from './storeReturn'

const WALK_SPEED = 3.2 // m/s
const TURN_SPEED = 2.0 // rad/s with ← →
const LOOK_SPEED = 0.005 // rad per dragged pixel (touch / mouse drag)
const REACH = 5 // how far away a display can be activated from

/** Shared, mutable input state written by the page (touch joystick, drag-look) and read each frame. */
export interface TouchInput {
  move: [number, number] // joystick: x = strafe, y = forward (-1..1)
  look: [number, number] // accumulated drag pixels since the last frame
}

interface Props {
  zone: Zone
  onZone: (zone: Zone) => void
  /** Called when the shopper starts or stops looking at something they can use. */
  onFocus: (action: StoreAction | null) => void
  touch: React.RefObject<TouchInput>
  /** The page calls this to lock the mouse (desktop) when the shopper clicks "walk in". */
  lockRef: React.RefObject<(() => void) | null>
  onLockChange: (locked: boolean) => void
  /** Set by the page to teleport between outside and inside. */
  teleport: React.RefObject<Zone | null>
  /** Where to start (a remembered spot when coming back from products); default is the sidewalk. */
  start: StorePose | null
  /** Updated every frame with where the shopper is standing and looking. */
  poseRef: React.RefObject<StorePose | null>
}

/**
 * First-person controls, in the style of the Lecture 7 Evans Hall walkthrough:
 * desktop = click to lock the mouse, mouse/← → to look, W A S D / ↑ ↓ to walk;
 * touch = left joystick to walk, drag anywhere else to look.
 * Every frame it also checks what's in the center of the view, so the HUD can offer "E: Shop T-shirts".
 */
export default function Player({ zone, onZone, onFocus, touch, lockRef, onLockChange, teleport, start, poseRef }: Props) {
  const { camera, gl, scene } = useThree()
  const controls = useMemo(() => new PointerLockControls(camera, gl.domElement), [camera, gl])
  const keys = useRef<Record<string, boolean>>({})
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])
  const forward = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const center = useMemo(() => new THREE.Vector2(0, 0), [])
  const focused = useRef<StoreAction | null>(null)
  const zoneRef = useRef(zone)
  useEffect(() => {
    zoneRef.current = zone
  }, [zone])

  useEffect(() => {
    if (start) {
      camera.position.set(start.x, EYE_HEIGHT, start.z)
      camera.rotation.set(start.pitch, start.yaw, 0, 'YXZ')
    } else {
      camera.position.set(SPAWN_OUTSIDE.x, EYE_HEIGHT, SPAWN_OUTSIDE.z)
      camera.rotation.set(0, SPAWN_OUTSIDE.yaw, 0, 'YXZ')
    }
    lockRef.current = () => controls.lock()
    const onLock = () => onLockChange(true)
    const onUnlock = () => {
      keys.current = {}
      onLockChange(false)
    }
    controls.addEventListener('lock', onLock)
    controls.addEventListener('unlock', onUnlock)
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea')) return // typing in the chat
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault()
      keys.current[e.code] = true
    }
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false)
    const blur = () => (keys.current = {})
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      controls.removeEventListener('lock', onLock)
      controls.removeEventListener('unlock', onUnlock)
      controls.dispose()
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [camera, controls, lockRef, onLockChange]) // eslint-disable-line react-hooks/exhaustive-deps -- `start` applies once

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)

    // Teleport requests (step inside / outside).
    if (teleport.current) {
      const to = teleport.current
      teleport.current = null
      const spawn = to === 'inside' ? SPAWN_INSIDE : SPAWN_OUTSIDE
      camera.position.set(spawn.x, EYE_HEIGHT, spawn.z)
      camera.rotation.set(0, spawn.yaw, 0, 'YXZ')
      onZone(to)
      return
    }

    // Look: drag (touch or mouse without pointer lock) and ← → keys.
    const k = keys.current
    const t = touch.current
    const turn = (k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0)
    if (t.look[0] || t.look[1] || turn) {
      euler.setFromQuaternion(camera.quaternion)
      euler.y -= t.look[0] * LOOK_SPEED - turn * TURN_SPEED * dt
      euler.x = Math.max(-1.3, Math.min(1.3, euler.x - t.look[1] * LOOK_SPEED))
      camera.quaternion.setFromEuler(euler)
      t.look[0] = t.look[1] = 0
    }

    // Walk: W A S D / ↑ ↓, or the touch joystick.
    let fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + t.move[1]
    let strafe = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + t.move[0]
    const len = Math.hypot(fwd, strafe)
    if (len > 1) {
      fwd /= len
      strafe /= len
    }
    if (fwd || strafe) {
      camera.getWorldDirection(forward)
      forward.y = 0
      forward.normalize()
      right.crossVectors(forward, camera.up).normalize()
      const step = WALK_SPEED * dt
      let x = camera.position.x + (forward.x * fwd + right.x * strafe) * step
      let z = camera.position.z + (forward.z * fwd + right.z * strafe) * step
      const current = zoneRef.current
      // Walking into the doorway moves you between the sidewalk and the store.
      if (current === 'outside' && z < ROOM.maxZ + 0.9 && Math.abs(x) < 1.1) {
        teleport.current = 'inside'
        return
      }
      if (current === 'inside' && z > ROOM.maxZ - 0.5 && Math.abs(x) < 1.1) {
        teleport.current = 'outside'
        return
      }
      ;[x, z] = collide(x, z, current)
      camera.position.x = x
      camera.position.z = z
    }

    // Outside, keep the view on the storefront; then record where the shopper is.
    euler.setFromQuaternion(camera.quaternion, 'YXZ')
    if (zoneRef.current === 'outside') {
      const yaw = THREE.MathUtils.clamp(euler.y, -OUTSIDE_LOOK.maxYaw, OUTSIDE_LOOK.maxYaw)
      const pitch = THREE.MathUtils.clamp(euler.x, OUTSIDE_LOOK.minPitch, OUTSIDE_LOOK.maxPitch)
      if (yaw !== euler.y || pitch !== euler.x) {
        euler.set(pitch, yaw, 0, 'YXZ')
        camera.quaternion.setFromEuler(euler)
      }
    }
    poseRef.current = { zone: zoneRef.current, x: camera.position.x, z: camera.position.z, yaw: euler.y, pitch: euler.x }

    // What is the shopper looking at?
    raycaster.setFromCamera(center, camera)
    raycaster.far = REACH
    const hit = raycaster.intersectObjects(scene.children, true).find((h) => h.object.userData.action)
    const action = (hit?.object.userData.action as StoreAction | undefined) ?? null
    if (action !== focused.current) {
      focused.current = action
      onFocus(action)
    }
  })

  return null
}
