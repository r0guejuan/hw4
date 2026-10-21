import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchProducts } from '../api'
import { openChat } from '../chat/openChat'
import type { Product } from '../types'
import type { StoreAction, Zone } from './layout'
import Player, { type TouchInput } from './Player'
import StoreScene from './StoreScene'
import {
  clearStoreReturn,
  markCameFromStore,
  rememberStorePose,
  takeStoreReturnPose,
  type StorePose,
} from './storeReturn'

/**
 * Phones held upright have a narrow screen, so a fixed 70° vertical view only shows the doors.
 * Widen the vertical field of view on tall screens to keep about 60° side to side.
 */
function ResponsiveFov() {
  const camera = useThree((state) => state.camera)
  const aspect = useThree((state) => state.size.width / state.size.height)
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    const wide = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(30)) / aspect))
    // three.js cameras are mutable scene objects, not React state
    // eslint-disable-next-line react/immutability
    camera.fov = THREE.MathUtils.clamp(wide, 70, 95)
    camera.updateProjectionMatrix()
  }, [camera, aspect])
  return null
}

const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/**
 * The virtual Campus Customs store: a first-person walk through the shop built from real store
 * photos (in the style of the Lecture 7 Evans Hall walkthrough). Displays link to the matching
 * products, the tables hold real catalogue items, and Handsome Dan's counter opens the chat.
 */
export default function VirtualStore() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Map<string, Product>>(new Map())
  // Coming back from products? Resume in the exact spot the shopper left from.
  const [resume] = useState<StorePose | null>(() => takeStoreReturnPose())
  const [started, setStarted] = useState(false)
  const [locked, setLocked] = useState(false)
  const [zone, setZone] = useState<Zone>(resume?.zone ?? 'outside')
  const poseRef = useRef<StorePose | null>(resume)
  const [focus, setFocus] = useState<StoreAction | null>(null)
  const [touchMode] = useState(isTouch)
  const touch = useRef<TouchInput>({ move: [0, 0], look: [0, 0] })
  const lockRef = useRef<(() => void) | null>(null)
  const teleport = useRef<Zone | null>(null)
  const focusRef = useRef<StoreAction | null>(null)
  useEffect(() => {
    focusRef.current = focus
  }, [focus])

  // Keep the shopper's spot saved, so any trip to the product pages can bring them back here.
  useEffect(() => {
    const save = () => poseRef.current && rememberStorePose(poseRef.current)
    const timer = window.setInterval(save, 1000)
    return () => {
      window.clearInterval(timer)
      save()
    }
  }, [])

  useEffect(() => {
    fetchProducts()
      .then((all) => setProducts(new Map(all.map((p) => [p.product_id, p]))))
      .catch(() => setProducts(new Map()))
  }, [])

  const activate = useCallback(
    (action: StoreAction | null) => {
      if (!action) return
      if (action.kind === 'enter') teleport.current = 'inside'
      else if (action.kind === 'exit') teleport.current = 'outside'
      else {
        document.exitPointerLock?.()
        if (action.kind === 'link') {
          markCameFromStore()
          navigate(action.to)
        } else openChat(action.prompt)
      }
    },
    [navigate],
  )

  // E (or a click while walking) uses whatever is in the center of the view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.('input, textarea')) return
      if (e.code === 'KeyE' || e.code === 'Enter') activate(focusRef.current)
    }
    const onClick = () => {
      if (document.pointerLockElement) activate(focusRef.current)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [activate])

  const walkIn = () => {
    setStarted(true)
    if (!touchMode) lockRef.current?.()
  }

  // Drag to look (touch, or mouse when the pointer isn't locked).
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (!started || locked) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    touch.current.look[0] += e.clientX - d.x
    touch.current.look[1] += e.clientY - d.y
    d.x = e.clientX
    d.y = e.clientY
  }
  const onPointerUp = () => (drag.current = null)

  const zoneLabel = useMemo(() => (zone === 'inside' ? 'Inside Campus Customs' : 'Outside on Broadway'), [zone])

  return (
    <div className="vstore">
      <div
        className="vstore__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Canvas camera={{ fov: 70, near: 0.05, far: 200 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
          <color attach="background" args={['#bcd6f2']} />
          <ResponsiveFov />
          <Suspense fallback={null}>
            <StoreScene products={products} />
          </Suspense>
          <Player
            zone={zone}
            onZone={setZone}
            onFocus={setFocus}
            touch={touch}
            lockRef={lockRef}
            onLockChange={setLocked}
            teleport={teleport}
            start={resume}
            poseRef={poseRef}
          />
        </Canvas>

        {started && <div className="vstore__crosshair" aria-hidden="true" />}

        <div className="vstore__top">
          <Link
            to="/"
            className="vstore__exit"
            onClick={() => {
              document.exitPointerLock?.()
              clearStoreReturn()
            }}
          >
            ← Back to the site
          </Link>
          <span className="vstore__zone">{zoneLabel}</span>
        </div>

        {started && focus && (
          <button className="vstore__prompt" onClick={() => activate(focus)}>
            <kbd>{touchMode ? 'Tap' : 'E'}</kbd> {focus.label}
          </button>
        )}

        {started && !touchMode && !locked && (
          <button className="vstore__resume" onClick={() => lockRef.current?.()}>
            Click to keep walking · drag to look around
          </button>
        )}

        {started && touchMode && <Joystick onMove={(x, y) => (touch.current.move = [x, y])} />}

        {!started && (
          <div className="vstore__intro">
            <div className="vstore__card">
              <p className="eyebrow">Virtual storefront</p>
              <h1>{resume ? 'Welcome back to Campus Customs' : 'Take a stroll through Campus Customs'}</h1>
              <p className="muted">
                Walk up Broadway, step inside, and browse the shop. Look at a display or a product and{' '}
                {touchMode ? 'tap the button that appears' : 'press E'} to shop it, or stop by Handsome Dan's counter for help.
              </p>
              <button className="btn btn--primary" onClick={walkIn}>
                {resume ? 'Pick up where you left off' : touchMode ? 'Tap to walk in' : 'Click to walk in'}
              </button>
              <ul className="vstore__keys">
                {touchMode ? (
                  <>
                    <li>Left thumb: walk</li>
                    <li>Drag anywhere: look around</li>
                  </>
                ) : (
                  <>
                    <li>
                      <kbd>W</kbd>
                      <kbd>A</kbd>
                      <kbd>S</kbd>
                      <kbd>D</kbd> or arrows: walk
                    </li>
                    <li>Mouse: look around</li>
                    <li>
                      <kbd>E</kbd> or click: shop what you're looking at
                    </li>
                    <li>
                      <kbd>Esc</kbd>: free the mouse
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** A simple on-screen thumbstick for phones and tablets. */
function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const [knob, setKnob] = useState<[number, number]>([0, 0])
  const origin = useRef<{ id: number; x: number; y: number } | null>(null)
  const RADIUS = 46
  const move = (e: React.PointerEvent) => {
    const o = origin.current
    if (!o || o.id !== e.pointerId) return
    let dx = e.clientX - o.x
    let dy = e.clientY - o.y
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    setKnob([dx, dy])
    onMove(dx / RADIUS, -dy / RADIUS)
  }
  const end = () => {
    origin.current = null
    setKnob([0, 0])
    onMove(0, 0)
  }
  return (
    <div
      className="vstore__joystick"
      onPointerDown={(e) => {
        e.stopPropagation()
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // capture is a nicety; the stick still works while the finger stays on it
        }
        const rect = e.currentTarget.getBoundingClientRect()
        origin.current = { id: e.pointerId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        move(e)
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="Walk joystick"
    >
      <span className="vstore__knob" style={{ transform: `translate(${knob[0]}px, ${knob[1]}px)` }} />
    </div>
  )
}
