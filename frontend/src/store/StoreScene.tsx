import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { formatPrice } from '../api'
import type { Product } from '../types'
import { brickTexture, makeLabel, SrgbTextureLoader, woodTexture } from './labels'
import {
  ACTIONS,
  BOOLA,
  CAP_WALL,
  CENTER_RACK,
  COUNTER,
  DAN,
  DOOR,
  HEDGE_WALL,
  JACKET_RACK,
  LOUNGE,
  MURALS,
  RACK_OFFSET,
  ROOM,
  TABLES,
  TABLE_SIZE,
  TEE_WALL,
  WALL_HEIGHT,
  WALL_RACKS,
  type StoreAction,
} from './layout'
import DanFigure from './DanFigure'
import { muralTexture } from './murals'
import {
  foldedStackTexture,
  garmentTexture,
  glassReflectionTexture,
  gridTexture,
  hedgeTexture,
  pavementTexture,
  rugTexture,
  windowBackdropTexture,
  type TeeDesign,
} from './textures'

const NAVY = '#00356b'
const CREAM = '#f3ede0'
const WARM_LIGHT = '#ffd9a8'
const WOOD_DARK = '#5a3b22'
const WOOD = '#6e4526'
const WALL_BLUE = '#1a2c4e'

type Vec3 = [number, number, number]

/** An invisible box the shopper can aim at; generous, so displays are easy to use. */
function Hit({ size, position, rotationY = 0, action }: { size: Vec3; position: Vec3; rotationY?: number; action: StoreAction }) {
  return (
    <mesh position={position} rotation={[0, rotationY, 0]} visible={false} userData={{ action }}>
      <boxGeometry args={size} />
      <meshBasicMaterial />
    </mesh>
  )
}

function Label({
  lines,
  width,
  position,
  rotationY = 0,
  background,
  canvasWidth,
}: {
  lines: Parameters<typeof makeLabel>[0]
  width: number
  position: Vec3
  rotationY?: number
  background?: string
  /** Width of the drawing canvas in px; narrower makes short text fill the label. */
  canvasWidth?: number
}) {
  const { texture, aspect } = useMemo(() => makeLabel(lines, { background, width: canvasWidth }), [lines, background, canvasWidth])
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[width, width / aspect]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  )
}

/** A navy hanging sign like the "KIDS DEPT" / "YALE DEPT." boards in the real store. */
function DeptSign({ text, position, rotationY = 0, width = 2.2 }: { text: string; position: Vec3; rotationY?: number; width?: number }) {
  const lines = useMemo(() => [{ text, size: 44, weight: 800, color: '#ffffff', font: 'serif' as const }], [text])
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * width * 0.35, 0.45, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.9]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      ))}
      <mesh>
        <boxGeometry args={[width, 0.42, 0.04]} />
        <meshStandardMaterial color={NAVY} />
      </mesh>
      <Label lines={lines} width={width * 0.9} position={[0, 0, 0.025]} />
      <Label lines={lines} width={width * 0.9} position={[0, 0, -0.025]} rotationY={Math.PI} />
    </group>
  )
}

/** One garment hanging from a rail. */
function Garment({ texture, position, rotationY = 0, scale = 1 }: { texture: THREE.Texture; position: Vec3; rotationY?: number; scale?: number }) {
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[0.62 * scale, 0.78 * scale]} />
      <meshStandardMaterial map={texture} transparent alphaTest={0.4} side={THREE.DoubleSide} roughness={0.95} />
    </mesh>
  )
}

/**
 * A storefront pane: a warm glimpse of the shop behind it, anything placed in the window,
 * a faint tint, light streaking across the glass, and a black frame with a mullion.
 */
function ShopWindow({
  width,
  height,
  position,
  frame = 0.1,
  children,
}: {
  width: number
  height: number
  position: Vec3
  frame?: number
  children?: React.ReactNode
}) {
  const backdrop = windowBackdropTexture()
  const glass = glassReflectionTexture()
  return (
    <group position={position}>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={backdrop} toneMapped={false} />
      </mesh>
      <group position={[0, 0, 0.04]}>{children}</group>
      <mesh position={[0, 0, 0.16]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#9fb9d6" transparent opacity={0.16} roughness={0.05} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.17]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={glass} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* frame */}
      {[
        [0, height / 2, width + frame, frame],
        [0, -height / 2, width + frame, frame],
        [-width / 2, 0, frame, height],
        [width / 2, 0, frame, height],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.15]}>
          <boxGeometry args={[w, h, 0.08]} />
          <meshStandardMaterial color="#141414" roughness={0.5} />
        </mesh>
      ))}
      {width > 2 && (
        <mesh position={[0, 0, 0.15]}>
          <boxGeometry args={[0.05, height, 0.06]} />
          <meshStandardMaterial color="#141414" />
        </mesh>
      )}
    </group>
  )
}

/** One plain box, for building masses and trim. */
function Block({ size, position, color, roughness = 0.85 }: { size: Vec3; position: Vec3; color: string; roughness?: number }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  )
}

/** A black Broadway lamppost with a glowing globe. */
function Lamppost({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.14, 0.2, 0.6, 12]} />
        <meshStandardMaterial color="#111" roughness={0.5} />
      </mesh>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 3.2, 10]} />
        <meshStandardMaterial color="#111" roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.65, 0]}>
        <cylinderGeometry args={[0.16, 0.08, 0.2, 12]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0, 3.95, 0]} scale={[1, 1.25, 1]}>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshStandardMaterial color="#fff6dc" emissive="#ffe7b0" emissiveIntensity={0.6} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 4.28, 0]}>
        <coneGeometry args={[0.12, 0.18, 12]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  )
}

/** A young street tree with wooden stakes and a mulch bed. */
function StreetTree({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.6, 20]} />
        <meshStandardMaterial color="#4a3526" roughness={1} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 2.4, 8]} />
        <meshStandardMaterial color="#5a4230" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.3, 0.8, 0]}>
          <boxGeometry args={[0.04, 1.6, 0.04]} />
          <meshStandardMaterial color="#9c7a52" />
        </mesh>
      ))}
      {[
        [0, 2.7, 0, 0.75],
        [-0.35, 2.35, 0.15, 0.55],
        [0.35, 2.4, -0.1, 0.55],
        [0, 3.3, 0, 0.5],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 12, 10]} />
          <meshStandardMaterial color={i % 2 ? '#4f8a3a' : '#3f7530'} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

/** A pane of shop glass with a soft interior glow. */
function Glass({ width, height, position, glow = '#f3e4c4' }: { width: number; height: number; position: Vec3; glow?: string }) {
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.12} roughness={0.15} metalness={0.45} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={glassReflectionTexture()} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/**
 * The rest of the block on Broadway, so panning left or right shows the street instead of a
 * blank wall: a limestone-and-glass tech store and a Gothic Yale hall to the left; the iron
 * alley gate, the tan-brick D.W. Flint building with its dry cleaner, and a café to the right.
 */
function Street() {
  const tan = useMemo(() => {
    const t = brickTexture('tan').clone()
    t.needsUpdate = true
    t.repeat.set(4.5, 3.5)
    return t
  }, [])
  const flint = useMemo(() => [{ text: 'D.W. FLINT', size: 60, weight: 700, color: '#8d7c62', font: 'serif' as const }], [])
  const cleaners = useMemo(() => [{ text: 'Blue Jay Cleaners', size: 64, weight: 800, color: '#ffffff' }], [])
  const cafe = useMemo(
    () => [
      { text: 'Broadway Café', size: 60, weight: 700, color: '#ffffff', font: 'serif' as const },
      { text: 'COFFEE · BAKERY', size: 22, weight: 700, color: '#cfe0f5' },
    ],
    [],
  )
  const f = ROOM.maxZ + 0.06
  return (
    <group>
      {/* left: limestone tech store with a wall of glass */}
      <Block size={[10.4, 5.2, 8]} position={[-11.8, 2.6, f - 4.05]} color="#cfc6b6" />
      <Block size={[10.4, 0.5, 0.3]} position={[-11.8, 4.75, f + 0.1]} color="#c3b9a7" />
      <Glass width={9.4} height={4} position={[-11.8, 2.3, f + 0.02]} />
      {[-16.5, -13.4, -10.2, -7.1].map((x) => (
        <Block key={x} size={[0.06, 4, 0.06]} position={[x, 2.3, f + 0.06]} color="#8f8f8f" roughness={0.3} />
      ))}
      <mesh position={[-11.8, 2.3, f - 2.5]}>
        <planeGeometry args={[9.4, 4]} />
        <meshStandardMaterial color="#efeae0" emissive="#f4efe4" emissiveIntensity={0.25} />
      </mesh>
      {/* light wood display tables inside */}
      {[-14.5, -11.6, -8.8].map((x) => (
        <Block key={x} size={[2, 0.12, 0.9]} position={[x, 0.9, f - 1.2]} color="#d9b98a" />
      ))}
      <Block size={[9.4, 0.3, 0.2]} position={[-11.8, 0.15, f + 0.05]} color="#bfb5a3" />

      {/* far left: a Gothic Yale hall, and a tower rising behind the block */}
      <Block size={[9, 8.5, 8]} position={[-21.5, 4.25, f - 3.5]} color="#b9a58a" />
      {Array.from({ length: 12 }, (_, i) => (
        <Block key={i} size={[0.4, 0.45, 0.4]} position={[-25.6 + i * 0.75, 8.7, f + 0.3]} color="#b9a58a" />
      ))}
      {[-24.5, -22.3, -20.1, -18].flatMap((x) => [2.6, 5.6].map((y) => [x, y] as const)).map(([x, y]) => (
        <Glass key={`${x}:${y}`} width={0.8} height={1.9} position={[x, y, f + 0.52]} glow="#e6c98f" />
      ))}
      <group position={[-13, 0, -10]}>
        <Block size={[3.6, 17, 3.6]} position={[0, 8.5, 0]} color="#b3a083" />
        <Block size={[2.8, 3, 2.8]} position={[0, 18.5, 0]} color="#b3a083" />
        {[-1, 1].flatMap((a) => [-1, 1].map((b) => [a, b] as const)).map(([a, b]) => (
          <mesh key={`${a}${b}`} position={[a * 1.6, 18.8, b * 1.6]}>
            <coneGeometry args={[0.25, 3.6, 6]} />
            <meshStandardMaterial color="#b3a083" />
          </mesh>
        ))}
        {[5, 9, 13].map((y) => (
          <Glass key={y} width={0.9} height={2.2} position={[0, y, 1.82]} glow="#d9c49a" />
        ))}
      </group>

      {/* right: the iron gate over the alley */}
      <Block size={[1.4, 3.2, 6]} position={[7.3, 1.6, f - 3.2]} color="#1b1b1b" />
      {Array.from({ length: 12 }, (_, i) => (
        <Block key={i} size={[0.03, 2.6, 0.03]} position={[6.72 + i * 0.105, 1.3, f]} color="#111" roughness={0.4} />
      ))}
      <Block size={[1.4, 0.06, 0.06]} position={[7.3, 2.55, f]} color="#111" />
      <Block size={[1.4, 0.06, 0.06]} position={[7.3, 0.25, f]} color="#111" />

      {/* the D.W. Flint building: tan brick, stone cornice, big shop windows */}
      <mesh position={[12.5, 3.2, f - 0.02]}>
        <planeGeometry args={[8.6, 6.4]} />
        <meshStandardMaterial map={tan} roughness={0.9} />
      </mesh>
      <Block size={[8.6, 6.4, 8]} position={[12.5, 3.2, f - 4.05]} color="#a88a66" />
      <Block size={[8.9, 0.35, 0.4]} position={[12.5, 4.35, f + 0.15]} color="#ddd1bb" />
      {Array.from({ length: 26 }, (_, i) => (
        <Block key={i} size={[0.14, 0.14, 0.12]} position={[8.4 + i * 0.33, 4.12, f + 0.35]} color="#ddd1bb" />
      ))}
      <Block size={[8.9, 0.25, 0.3]} position={[12.5, 6.45, f + 0.1]} color="#ddd1bb" />
      <Block size={[3.4, 0.7, 0.3]} position={[12.5, 6.9, f + 0.05]} color="#c9a87c" />
      <Block size={[3, 0.75, 0.1]} position={[12.5, 5.35, f + 0.08]} color="#e3d8c3" />
      <Label lines={flint} width={2.7} position={[12.5, 5.35, f + 0.14]} />
      <Block size={[7.8, 3.3, 0.12]} position={[12.5, 1.95, f + 0.04]} color="#2a2a2a" />
      {[
        [9.4, 2.3, 2.2],
        [11.6, 2.3, 2.2],
        [14.6, 2.3, 1.4],
        [16.1, 2.3, 1.3],
      ].map(([x, y, w]) => (
        <group key={x}>
          <Glass width={w} height={1.3} position={[x, y + 0.5, f + 0.11]} glow="#dfe6ee" />
          <Glass width={w} height={1.3} position={[x, y - 1.0, f + 0.11]} glow="#e8e2d6" />
        </group>
      ))}
      <Block size={[4.6, 0.12, 0.05]} position={[10.5, 1.95, f + 0.13]} color="#b3272d" />
      <Glass width={0.9} height={2.6} position={[13.35, 1.35, f + 0.11]} glow="#efe9df" />
      <Block size={[2.9, 0.75, 0.12]} position={[15.2, 3.75, f + 0.25]} color="#1d4fa0" />
      <Label lines={cleaners} width={2.6} position={[15.2, 3.75, f + 0.32]} />

      {/* café in a white modern block with a navy awning */}
      <Block size={[7, 4.6, 8]} position={[20.3, 2.3, f - 4.05]} color="#eceae5" />
      <Glass width={5.8} height={2.6} position={[20.3, 1.6, f + 0.02]} glow="#f5dcb0" />
      <mesh position={[20.3, 3.15, f + 0.55]} rotation={[0.55, 0, 0]}>
        <boxGeometry args={[6.4, 0.06, 1.3]} />
        <meshStandardMaterial color="#1f3c6e" roughness={0.8} />
      </mesh>
      <Label lines={cafe} width={3.2} position={[20.3, 3.95, f + 0.04]} background="#1f3c6e" />

      {/* street furniture on the sidewalk */}
      {[-4.6, 4.6, -12, 11].map((x) => (
        <Lamppost key={x} position={[x, 0, 5.6]} />
      ))}
      {[-7.6, 2.3, 9].map((x) => (
        <StreetTree key={x} position={[x, 0, 5.3]} />
      ))}
      {/* blue newspaper box, trash can, mailbox and a planter */}
      <group position={[-5.6, 0, 5.1]}>
        <Block size={[0.5, 0.9, 0.45]} position={[0, 0.55, 0]} color="#2f63c4" />
        <Block size={[0.4, 0.3, 0.02]} position={[0, 0.75, 0.23]} color="#dfe8f5" />
      </group>
      <mesh position={[-3.2, 0.45, 4.95]}>
        <cylinderGeometry args={[0.28, 0.25, 0.9, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
      </mesh>
      <group position={[10.2, 0, 5.6]}>
        <Block size={[0.55, 0.85, 0.5]} position={[0, 0.75, 0]} color="#1f4d9c" />
        <mesh position={[0, 1.18, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.25, 0.55, 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color="#1f4d9c" />
        </mesh>
        <Block size={[0.4, 0.3, 0.3]} position={[0, 0.15, 0]} color="#163a78" />
      </group>
      <group position={[-9.5, 0, 5]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.45, 0.32, 0.6, 16]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.cos(i * 1.25) * 0.22, 0.7, Math.sin(i * 1.25) * 0.22]}>
            <sphereGeometry args={[0.2, 10, 8]} />
            <meshStandardMaterial color={i % 2 ? '#d9534f' : '#4f8a3a'} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Outside: the storefront on Broadway                                 */
/* ------------------------------------------------------------------ */

function Storefront() {
  const brick = useMemo(() => {
    const t = brickTexture().clone()
    t.needsUpdate = true
    t.repeat.set(6, 5.4)
    return t
  }, [])
  const sign = useMemo(() => [{ text: 'Campus Customs', size: 92, weight: 700, color: '#ffffff', font: 'serif' as const }], [])
  const shield = useMemo(() => [{ text: 'Y', size: 120, weight: 800, color: '#ffffff', font: 'serif' as const }], [])
  const blade = useMemo(
    () => [
      { text: 'Campus', size: 34, weight: 700, color: '#ffffff', font: 'serif' as const },
      { text: 'Customs', size: 34, weight: 700, color: '#ffffff', font: 'serif' as const },
      { text: 'YALEBULLDOGBLUE.COM', size: 14, weight: 700, color: '#cfe0f5' },
    ],
    [],
  )
  const aFrame = useMemo(
    () => [
      { text: 'OFFICIAL', size: 22, weight: 700, color: NAVY },
      { text: 'YALE', size: 72, weight: 800, color: NAVY, font: 'serif' as const },
      { text: 'GIFTS & GEAR', size: 26, weight: 800, color: NAVY },
    ],
    [],
  )
  const windowGarments = useMemo(
    () => [garmentTexture('hoodie', '#8e9aa6', '#00356b', 'YALE'), garmentTexture('crew', '#f4f1ea', '#00356b', 'YALE')],
    [],
  )
  const front = ROOM.maxZ + 0.06
  const winW = 3.8
  return (
    <group>
      {/* concrete sidewalk in front of the store */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 9]}>
        <planeGeometry args={[60, 10]} />
        <meshStandardMaterial map={pavementTexture()} roughness={0.95} />
      </mesh>

      {/* three-story brick building with a curved cornice, like 59 Broadway */}
      <mesh position={[0, 5.3, front - 0.02]}>
        <planeGeometry args={[13.2, 10.6]} />
        <meshStandardMaterial map={brick} roughness={0.9} />
      </mesh>
      <mesh position={[0, 5.3, front - 9.05]}>
        <boxGeometry args={[13.2, 10.6, 18]} />
        <meshStandardMaterial color="#7a3b2c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 10.75, front + 0.1]}>
        <boxGeometry args={[13.6, 0.35, 0.35]} />
        <meshStandardMaterial color="#8a4a36" roughness={0.8} />
      </mesh>
      <mesh position={[0, 10.9, front - 0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.55]}>
        <cylinderGeometry args={[3, 3, 0.3, 32, 1, false, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#8a4a36" roughness={0.8} />
      </mesh>
      <mesh position={[0, 11.4, front + 0.12]}>
        <circleGeometry args={[0.9, 24, 0, Math.PI]} />
        <meshStandardMaterial color="#3d5470" emissive="#1c2a3b" emissiveIntensity={0.4} roughness={0.2} />
      </mesh>
      {[7.1, 9.3].flatMap((y) => [-5, -1.7, 1.7, 5].map((x) => [x, y] as const)).map(([x, y]) => (
        <group key={`${x}:${y}`} position={[x, y, front]}>
          <mesh>
            <boxGeometry args={[1.5, 1.9, 0.08]} />
            <meshStandardMaterial color="#f2efe8" />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <planeGeometry args={[1.25, 1.65]} />
            <meshStandardMaterial color="#5b7fa6" emissive="#2b3f57" emissiveIntensity={0.4} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* black fascia with the store name and the Y bulldog shield */}
      <mesh position={[0, 4.75, front + 0.2]}>
        <boxGeometry args={[12.6, 1.35, 0.4]} />
        <meshStandardMaterial color="#141414" roughness={0.6} />
      </mesh>
      <Label lines={sign} width={7.4} position={[-0.8, 4.78, front + 0.41]} />
      <mesh position={[5.1, 4.78, front + 0.42]}>
        <planeGeometry args={[1.1, 1.1]} />
        <meshBasicMaterial color="#1d4f99" />
      </mesh>
      <Label lines={shield} width={0.8} position={[5.1, 4.78, front + 0.43]} canvasWidth={170} />
      {/* blade sign sticking out over the sidewalk */}
      <group position={[6.6, 4.3, front + 0.8]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <boxGeometry args={[1.4, 1.9, 0.18]} />
          <meshStandardMaterial color={NAVY} />
        </mesh>
        <Label lines={blade} width={1.2} position={[0, 0, 0.1]} />
        <Label lines={blade} width={1.2} position={[0, 0, -0.1]} rotationY={Math.PI} />
      </group>

      {/* storefront frame, columns, and glowing display windows */}
      <mesh position={[0, 3.75, front + 0.1]}>
        <boxGeometry args={[12.4, 0.5, 0.25]} />
        <meshStandardMaterial color="#1c1c1c" />
      </mesh>
      {[-6.1, -DOOR.width / 2 - 0.12, DOOR.width / 2 + 0.12, 6.1].map((x) => (
        <mesh key={x} position={[x, 1.75, front + 0.1]}>
          <boxGeometry args={[0.24, 3.5, 0.25]} />
          <meshStandardMaterial color="#1c1c1c" />
        </mesh>
      ))}
      {[-1, 1].map((side) => {
        const cx = side * (DOOR.width / 2 + 0.12 + winW / 2 + 0.1)
        return (
          <group key={side}>
            <mesh position={[cx, 0.3, front + 0.1]}>
              <boxGeometry args={[winW + 0.2, 0.6, 0.3]} />
              <meshStandardMaterial color="#1c1c1c" />
            </mesh>
            <ShopWindow width={winW} height={2.9} position={[cx, 2.05, front]}>
              {[-0.9, 0.9].map((dx, i) => (
                <Garment key={dx} texture={windowGarments[(i + (side > 0 ? 1 : 0)) % 2]} position={[dx, -0.1, 0.06]} scale={2} />
              ))}
            </ShopWindow>
          </group>
        )
      })}
      {/* a pair of glass doors with brass push bars */}
      {[-1, 1].map((s) => (
        <group key={s} position={[(s * DOOR.width) / 4, DOOR.height / 2, front]}>
          <ShopWindow width={DOOR.width / 2 - 0.06} height={DOOR.height - 0.1} position={[0, 0, 0]} frame={0.07} />
          <mesh position={[-s * 0.32, 0, 0.2]}>
            <boxGeometry args={[0.04, 0.9, 0.04]} />
            <meshStandardMaterial color="#c8a24a" metalness={0.8} roughness={0.25} />
          </mesh>
        </group>
      ))}
      <Hit size={[DOOR.width + 2, 3.4, 1.2]} position={[0, 1.7, front + 0.6]} action={ACTIONS.enter} />

      {/* A-frame sidewalk sign */}
      <group position={[3.2, 0, 6.2]} rotation={[0, -0.35, 0]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[0, 0.55, s * 0.18]} rotation={[s * 0.3, s > 0 ? 0 : Math.PI, 0]}>
            <mesh>
              <boxGeometry args={[0.8, 1.15, 0.04]} />
              <meshStandardMaterial color="#1c1c1c" />
            </mesh>
            <mesh position={[0, 0, 0.025]}>
              <planeGeometry args={[0.7, 1.02]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <Label lines={aFrame} width={0.62} position={[0, 0, 0.03]} />
          </group>
        ))}
      </group>

      <Street />

      {/* sky */}
      <mesh position={[0, 10, 0]}>
        <sphereGeometry args={[70, 24, 16]} />
        <meshBasicMaterial color="#cfe3f7" side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Inside: the room                                                    */
/* ------------------------------------------------------------------ */

function RoomShell() {
  const wood = useMemo(() => woodTexture(), [])
  const width = ROOM.maxX - ROOM.minX
  const depth = ROOM.maxZ - ROOM.minZ
  const cz = (ROOM.maxZ + ROOM.minZ) / 2
  const sideW = (width - DOOR.width) / 2
  const storeSign = useMemo(() => [{ text: 'Campus Customs', size: 66, weight: 700, color: '#ffffff', font: 'serif' as const }], [])
  return (
    <group>
      {/* honey wood floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={wood} roughness={0.55} />
      </mesh>
      {/* ceiling with dark wood beams */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT, cz]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#d9cbb4" roughness={1} />
      </mesh>
      {[-12, -9, -6, -3, 0, 3].map((z) => (
        <mesh key={z} position={[0, WALL_HEIGHT - 0.12, z]}>
          <boxGeometry args={[width, 0.24, 0.22]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.7} />
        </mesh>
      ))}

      {/* walls: deep Yale navy throughout, with dark wood wainscoting */}
      {[
        { x: ROOM.minX, r: Math.PI / 2 },
        { x: ROOM.maxX, r: -Math.PI / 2 },
      ].map(({ x, r }) => (
        <group key={x}>
          <mesh position={[x, WALL_HEIGHT / 2, cz]} rotation={[0, r, 0]}>
            <planeGeometry args={[depth, WALL_HEIGHT]} />
            <meshStandardMaterial color={WALL_BLUE} roughness={0.9} />
          </mesh>
          <mesh position={[x + (r > 0 ? 0.02 : -0.02), 0.5, cz]} rotation={[0, r, 0]}>
            <planeGeometry args={[depth, 1]} />
            <meshStandardMaterial color={WOOD} roughness={0.7} />
          </mesh>
          <mesh position={[x + (r > 0 ? 0.03 : -0.03), 1.02, cz]} rotation={[0, r, 0]}>
            <boxGeometry args={[depth, 0.06, 0.04]} />
            <meshStandardMaterial color={WOOD_DARK} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, WALL_HEIGHT / 2, ROOM.minZ]}>
        <planeGeometry args={[width, WALL_HEIGHT]} />
        <meshStandardMaterial color={WALL_BLUE} roughness={0.9} />
      </mesh>

      {/* front wall (inside) with windows either side of the door */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * (DOOR.width / 2 + sideW / 2), WALL_HEIGHT / 2, ROOM.maxZ]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[sideW, WALL_HEIGHT]} />
            <meshStandardMaterial color={WALL_BLUE} roughness={0.9} />
          </mesh>
          <mesh position={[side * (DOOR.width / 2 + sideW / 2), 2, ROOM.maxZ - 0.02]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[sideW - 0.8, 2.6]} />
            <meshStandardMaterial color="#dff0ff" emissive="#cfe6ff" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, DOOR.height + (WALL_HEIGHT - DOOR.height) / 2, ROOM.maxZ]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[DOOR.width, WALL_HEIGHT - DOOR.height]} />
        <meshStandardMaterial color={WALL_BLUE} roughness={0.9} />
      </mesh>
      <mesh position={[0, DOOR.height / 2, ROOM.maxZ - 0.03]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[DOOR.width, DOOR.height]} />
        <meshStandardMaterial color="#dff0ff" emissive="#cfe6ff" emissiveIntensity={0.5} transparent opacity={0.7} />
      </mesh>
      <Hit size={[DOOR.width, DOOR.height, 0.6]} position={[0, DOOR.height / 2, ROOM.maxZ - 0.4]} action={ACTIONS.exit} />
      <mesh position={[0, 3.6, ROOM.maxZ - 0.04]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[3.6, 0.6]} />
        <meshBasicMaterial color={NAVY} />
      </mesh>
      <Label lines={storeSign} width={3} position={[0, 3.6, ROOM.maxZ - 0.06]} rotationY={Math.PI} />
    </group>
  )
}

// Designs scattered across the tee bays: about a third classic YALE, the rest colleges and logos.
const TEE_DESIGNS: TeeDesign[] = [
  'YALE', 'BRANFORD', 'crest', 'YALE', 'BULLDOGS', 'DAVENPORT', 'Y', 'SILLIMAN',
  'YALE', 'ELI', 'SAYBROOK', 'crest', 'BOOLA', 'MORSE', 'YALE', 'PIERSON',
  'HOPPER', 'Y', 'YALE', 'TRUMBULL', 'BULLDOGS', 'crest', 'YALE', 'DAVENPORT',
  'BRANFORD', 'YALE', 'ELI', 'SILLIMAN', 'Y', 'YALE', 'MORSE', 'crest',
]
// A fixed shuffle so the same bay always shows the same design.
const bayDesign = (bay: number) => TEE_DESIGNS[(bay * 13 + 5) % TEE_DESIGNS.length]

/** Left wall: wooden cubbies of folded tees (wordmarks, colleges, crests), with the cap pegboard above. */
function TeeWall() {
  const { x, z, length, height, depth, cols, rows } = TEE_WALL
  const palette: [string, string][] = [
    [NAVY, '#ffffff'],
    ['#f4f1ea', NAVY],
    ['#9aa3ad', NAVY],
    ['#e9e0cc', NAVY],
    ['#1f2a44', '#c9a227'],
  ]
  const cw = length / cols
  const ch = height / rows
  const grid = gridTexture() // cached in textures.ts
  const capColors = [NAVY, '#f4f1ea', '#d8c9a5', '#1f2a44', '#8e9aa6', '#ffffff']
  return (
    <group position={[x + depth / 2, 0, z]} rotation={[0, Math.PI / 2, 0]}>
      {/* shelving carcass */}
      <mesh position={[0, height / 2 + 0.05, -depth / 2 + 0.02]}>
        <boxGeometry args={[length + 0.1, height + 0.1, 0.04]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const bay = r * cols + c
          const [shirt, print] = palette[(bay * 7 + r) % palette.length]
          return (
            <mesh key={`${r}-${c}`} position={[-length / 2 + cw * (c + 0.5), 0.1 + ch * (r + 0.5), 0]}>
              <planeGeometry args={[cw - 0.04, ch - 0.04]} />
              <meshStandardMaterial map={foldedStackTexture(shirt, print, bayDesign(bay))} roughness={0.95} />
            </mesh>
          )
        }),
      )}
      {Array.from({ length: rows + 1 }, (_, r) => (
        <mesh key={`shelf${r}`} position={[0, 0.1 + ch * r, 0]}>
          <boxGeometry args={[length + 0.1, 0.05, depth]} />
          <meshStandardMaterial color={WOOD} />
        </mesh>
      ))}
      {Array.from({ length: cols + 1 }, (_, c) => (
        <mesh key={`div${c}`} position={[-length / 2 + cw * c, 0.1 + height / 2, 0]}>
          <boxGeometry args={[0.04, height, depth]} />
          <meshStandardMaterial color={WOOD} />
        </mesh>
      ))}
      <Hit size={[length, height, depth + 0.8]} position={[0, 0.1 + height / 2, 0.3]} action={ACTIONS.tees} />

      {/* cap pegboard */}
      <mesh position={[0, CAP_WALL.y, -depth / 2 + 0.03]}>
        <planeGeometry args={[length, CAP_WALL.height]} />
        <meshStandardMaterial map={grid} />
      </mesh>
      {Array.from({ length: CAP_WALL.rows }, (_, r) =>
        Array.from({ length: CAP_WALL.cols }, (_, c) => {
          const color = capColors[(r * 5 + c) % capColors.length]
          return (
            <group
              key={`cap${r}-${c}`}
              position={[-length / 2 + (length / CAP_WALL.cols) * (c + 0.5), CAP_WALL.y - 0.22 + r * 0.5, -depth / 2 + 0.05]}
              rotation={[1.25, 0, 0]}
            >
              <mesh>
                <sphereGeometry args={[0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial color={color} roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.005, 0.12]} rotation={[0.15, 0, 0]} scale={[1, 0.12, 0.7]}>
                <cylinderGeometry args={[0.13, 0.13, 0.1, 16]} />
                <meshStandardMaterial color={color} roughness={0.9} />
              </mesh>
            </group>
          )
        }),
      )}
      <Hit size={[length, CAP_WALL.height, 0.8]} position={[0, CAP_WALL.y, 0.1]} action={ACTIONS.caps} />
      <DeptSign text="YALE TEES" position={[0, 3.95, 0.6]} width={2} />
    </group>
  )
}

/** The Boola Boola nook: hedge panel, the shop's sign, and a table of stacked white Y-tees. */
function BoolaNook() {
  const hedge = useMemo(() => hedgeTexture(), [])
  const sign = useMemo(
    () => [
      { text: 'Y   THE   Y', size: 30, weight: 800, color: NAVY, font: 'serif' as const },
      { text: 'BOOLA BOOLA', size: 54, weight: 800, color: NAVY, font: 'serif' as const },
      { text: 'SHOP', size: 30, weight: 800, color: NAVY, font: 'serif' as const },
    ],
    [],
  )
  const { table } = BOOLA
  const stack = useMemo(() => foldedStackTexture('#ffffff', NAVY, 'Y', 6), [])
  return (
    <group>
      <group position={[ROOM.minX + 0.03, 0, BOOLA.wallZ]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 2.25, 0]}>
          <planeGeometry args={[BOOLA.wallWidth, 2.9]} />
          <meshStandardMaterial map={hedge} roughness={1} />
        </mesh>
        <mesh position={[0, 2.9, 0.03]}>
          <planeGeometry args={[2.3, 1.1]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <Label lines={sign} width={2.1} position={[0, 2.9, 0.05]} />
        {/* framed football photos either side */}
        {[-1.55, 1.55].map((dx) => (
          <mesh key={dx} position={[dx, 2.9, 0.04]}>
            <boxGeometry args={[0.6, 0.8, 0.04]} />
            <meshStandardMaterial color="#e9e3d6" />
          </mesh>
        ))}
      </group>
      <group position={[table.x, 0, table.z]}>
        <mesh position={[0, table.h / 2, 0]}>
          <boxGeometry args={[table.w, table.h, table.d]} />
          <meshStandardMaterial color={WOOD} />
        </mesh>
        {[-0.85, -0.28, 0.28, 0.85].map((dz) =>
          [-0.25, 0.25].map((dx) => (
            <group key={`${dz}${dx}`} position={[dx, table.h + 0.13, dz]}>
              <mesh>
                <boxGeometry args={[0.42, 0.26, 0.42]} />
                <meshStandardMaterial color="#f7f5ef" roughness={0.95} />
              </mesh>
              <mesh position={[0.215, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[0.42, 0.26]} />
                <meshStandardMaterial map={stack} roughness={0.95} />
              </mesh>
            </group>
          )),
        )}
      </group>
      <Hit size={[1.8, 3, BOOLA.wallWidth]} position={[ROOM.minX + 0.9, 1.5, BOOLA.wallZ]} action={ACTIONS.boola} />
    </group>
  )
}

const JACKET_COLORS: [string, string][] = [
  [NAVY, '#ffffff'],
  ['#1f2a44', '#ffffff'],
  ['#8e9aa6', NAVY],
]

/** Back wall: a hedge wall with the big blue YALE sign, and a round rack of jackets. */
function HedgeWall() {
  const hedge = useMemo(() => hedgeTexture(), [])
  const yale = useMemo(() => [{ text: 'YALE', size: 150, weight: 800, color: CREAM, font: 'serif' as const }], [])
  const jackets = useMemo(() => JACKET_COLORS.map(([c, p]) => garmentTexture('zip', c, p)), [])
  const { x, z, radius, height, count } = JACKET_RACK
  return (
    <group>
      <mesh position={[0, HEDGE_WALL.height / 2 + 0.35, ROOM.minZ + 0.03]}>
        <planeGeometry args={[HEDGE_WALL.width, HEDGE_WALL.height]} />
        <meshStandardMaterial map={hedge} roughness={1} />
      </mesh>
      <mesh position={[0, 2.5, ROOM.minZ + 0.06]}>
        <boxGeometry args={[4.6, 1.3, 0.06]} />
        <meshStandardMaterial color="#2d5fa8" />
      </mesh>
      <Label lines={yale} width={3.2} position={[0, 2.52, ROOM.minZ + 0.1]} />

      {/* round chrome rack of jackets */}
      <group position={[x, 0, z]}>
        <mesh position={[0, height / 2, 0]}>
          <cylinderGeometry args={[0.03, 0.03, height]} />
          <meshStandardMaterial color="#cfcfcf" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.015, 8, 40]} />
          <meshStandardMaterial color="#cfcfcf" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.35, 0.4, 0.06, 24]} />
          <meshStandardMaterial color="#9a9a9a" metalness={0.6} />
        </mesh>
        {Array.from({ length: count }, (_, i) => {
          const a = (i / count) * Math.PI * 2
          return (
            <Garment
              key={i}
              texture={jackets[i % jackets.length]}
              position={[Math.cos(a) * radius, height - 0.42, Math.sin(a) * radius]}
              rotationY={-a}
              scale={0.95}
            />
          )
        })}
      </group>
      <DeptSign text="JACKETS" position={[x, 2.45, z]} width={1.6} />
      <Hit size={[2.2, 2, 2.2]} position={[x, 1, z]} action={ACTIONS.jackets} />
      <Hit size={[HEDGE_WALL.width, HEDGE_WALL.height, 0.6]} position={[0, 2, ROOM.minZ + 0.35]} action={ACTIONS.gifts} />
    </group>
  )
}

/** A rail of hanging sweatshirts along the right wall. */
const RACK_COLORS: [string, string][] = [
  [NAVY, '#ffffff'],
  ['#8e9aa6', NAVY],
  ['#f4f1ea', NAVY],
  ['#1f2a44', '#ffffff'],
  ['#b8bec6', NAVY],
]

function WallRack({ rack }: { rack: (typeof WALL_RACKS)[number] }) {
  const textures = useMemo(() => RACK_COLORS.map(([c, p]) => garmentTexture(rack.kind, c, p)), [rack.kind])
  const n = Math.floor(rack.length / 0.42)
  const x = ROOM.maxX - RACK_OFFSET
  return (
    <group>
      <mesh position={[x, 1.9, rack.z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, rack.length]} />
        <meshStandardMaterial color="#cfcfcf" metalness={0.8} roughness={0.25} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x + 0.25, 1.9, rack.z + (s * rack.length) / 2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.015, 0.015, 0.5]} />
          <meshStandardMaterial color="#cfcfcf" metalness={0.8} />
        </mesh>
      ))}
      {Array.from({ length: n }, (_, i) => (
        <Garment
          key={i}
          texture={textures[i % textures.length]}
          position={[x - 0.02 * (i % 2), 1.48, rack.z - rack.length / 2 + (i + 0.5) * (rack.length / n)]}
          rotationY={-Math.PI / 2 + 0.55}
          scale={1.05}
        />
      ))}
      <DeptSign text={rack.sign} position={[x - 0.3, 3.3, rack.z]} rotationY={-Math.PI / 2} width={2} />
      <Hit size={[1.4, 2.2, rack.length]} position={[x - 0.3, 1.3, rack.z]} action={rack.action} />
    </group>
  )
}

/** Freestanding rack of quarter-zips facing the entrance. */
function CenterRack() {
  const textures = useMemo(
    () => [
      garmentTexture('zip', '#b8bec6', NAVY, 'YALE'),
      garmentTexture('zip', NAVY, '#ffffff', 'YALE'),
      garmentTexture('zip', '#e9e0cc', NAVY, 'YALE'),
    ],
    [],
  )
  const { x, z, length } = CENTER_RACK
  const n = 6
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.75, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, length]} />
        <meshStandardMaterial color="#cfcfcf" metalness={0.8} roughness={0.25} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[(s * length) / 2, 0, 0]}>
          <mesh position={[0, 0.875, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.75]} />
            <meshStandardMaterial color="#cfcfcf" metalness={0.8} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.08, 0.04, 0.7]} />
            <meshStandardMaterial color="#9a9a9a" metalness={0.6} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: n }, (_, i) => (
        <Garment key={i} texture={textures[i % 3]} position={[-length / 2 + (i + 0.5) * (length / n), 1.34, 0.02 * (i % 2)]} scale={1.05} />
      ))}
      <DeptSign text="YALE DEPT." position={[0, 3.25, 0]} width={2.4} />
      <Hit size={[length, 2, 1]} position={[0, 1.2, 0]} action={ACTIONS.quarterZips} />
    </group>
  )
}

function ProductStand({ product, position }: { product: Product; position: Vec3 }) {
  const texture = useLoader(SrgbTextureLoader, product.image_url)
  const lines = useMemo(
    () => [
      { text: product.name, size: 26, weight: 700 },
      { text: formatPrice(product.price), size: 26, weight: 700, color: NAVY },
    ],
    [product],
  )
  const action: StoreAction = { kind: 'link', to: `/products/${product.product_id}`, label: `View ${product.name}` }
  return (
    <group position={position}>
      <mesh position={[0, 0.32, -0.03]} rotation={[-0.15, 0, 0]}>
        <boxGeometry args={[0.56, 0.56, 0.03]} />
        <meshStandardMaterial color="#f7f3ea" />
      </mesh>
      <mesh position={[0, 0.32, 0]} rotation={[-0.15, 0, 0]}>
        <planeGeometry args={[0.5, 0.5]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <Label lines={lines} width={0.6} position={[0, 0.0, 0.2]} background="rgba(255,250,240,0.96)" />
      <Hit size={[0.6, 0.8, 0.6]} position={[0, 0.3, 0.05]} action={action} />
    </group>
  )
}

function DisplayTable({ table, products }: { table: (typeof TABLES)[number]; products: Map<string, Product> }) {
  const items = table.productIds.map((id) => products.get(id)).filter((p): p is Product => !!p)
  const spacing = TABLE_SIZE.w / Math.max(items.length, 1)
  const title = useMemo(() => [{ text: table.title, size: 30, weight: 700, color: '#ffffff', font: 'serif' as const }], [table.title])
  return (
    <group position={table.position}>
      {/* chunky wooden table with legs */}
      <mesh position={[0, TABLE_SIZE.h - 0.03, 0]}>
        <boxGeometry args={[TABLE_SIZE.w, 0.07, TABLE_SIZE.d]} />
        <meshStandardMaterial color="#9a6a3e" roughness={0.45} />
      </mesh>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[(sx * (TABLE_SIZE.w - 0.16)) / 2, (TABLE_SIZE.h - 0.06) / 2, (sz * (TABLE_SIZE.d - 0.16)) / 2]}>
          <boxGeometry args={[0.09, TABLE_SIZE.h - 0.06, 0.09]} />
          <meshStandardMaterial color={WOOD_DARK} />
        </mesh>
      ))}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[TABLE_SIZE.w - 0.2, 0.04, TABLE_SIZE.d - 0.2]} />
        <meshStandardMaterial color={WOOD_DARK} />
      </mesh>
      {items.map((p, i) => (
        <ProductStand key={p.product_id} product={p} position={[-TABLE_SIZE.w / 2 + spacing * (i + 0.5), TABLE_SIZE.h, 0.05]} />
      ))}
      <mesh position={[0, TABLE_SIZE.h - 0.15, TABLE_SIZE.d / 2 + 0.005]}>
        <planeGeometry args={[1.3, 0.22]} />
        <meshBasicMaterial color={NAVY} />
      </mesh>
      <Label lines={title} width={1.1} position={[0, TABLE_SIZE.h - 0.15, TABLE_SIZE.d / 2 + 0.01]} />
    </group>
  )
}

/** Checkout counter by the door, with a life-size Handsome Dan standing behind it. */
function Counter() {
  const caption = useMemo(
    () => [
      { text: 'Talk to Handsome Dan', size: 30, weight: 700, color: '#ffffff', font: 'serif' as const },
      { text: 'Sizes, stock & gift ideas', size: 18, weight: 500, color: '#cfe0f5' },
    ],
    [],
  )
  const { x, z, w, d, h } = COUNTER
  return (
    <group>
      <group position={[x, 0, z]}>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={NAVY} roughness={0.5} />
        </mesh>
        <mesh position={[0, h + 0.03, 0]}>
          <boxGeometry args={[w + 0.1, 0.06, d + 0.1]} />
          <meshStandardMaterial color="#7a4e2c" roughness={0.4} />
        </mesh>
        {/* register and a jar of dog treats */}
        <mesh position={[0, h + 0.18, 0.75]}>
          <boxGeometry args={[0.3, 0.24, 0.4]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
        <mesh position={[0, h + 0.16, -0.8]}>
          <cylinderGeometry args={[0.1, 0.1, 0.22, 16]} />
          <meshStandardMaterial color="#e8f2ff" transparent opacity={0.5} />
        </mesh>
        <Label lines={caption} width={1.6} position={[-w / 2 - 0.01, h * 0.55, 0]} rotationY={-Math.PI / 2} background={NAVY} />
      </group>
      {/* Handsome Dan, life-size, facing the shop floor */}
      <group position={[DAN.x, 0, DAN.z]} rotation={[0, -Math.PI / 2, 0]} scale={1.12}>
        <DanFigure />
      </group>
      <spotLight
        position={[DAN.x - 2, 3.6, DAN.z]}
        target-position={[DAN.x, 1.5, DAN.z]}
        angle={0.6}
        penumbra={0.6}
        intensity={10}
        color={WARM_LIGHT}
        distance={6}
      />
      <Hit size={[2.2, 2.1, d + 0.4]} position={[(x + DAN.x) / 2, 1.05, z]} action={ACTIONS.dan} />
    </group>
  )
}

const LEATHER = '#5a2e1b'
const LEATHER_LIGHT = '#6e3a23'

/** A chesterfield-style leather couch, centered on its seat, facing +z. */
function Couch({ length }: { length: number }) {
  const depth = LOUNGE.couchDepth
  const seats = length > 2.1 ? 3 : 2
  const cushionW = (length - 0.36) / seats
  return (
    <group>
      {/* base */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[length, 0.3, depth]} />
        <meshStandardMaterial color={LEATHER} roughness={0.45} />
      </mesh>
      {/* back */}
      <mesh position={[0, 0.62, -depth / 2 + 0.12]}>
        <boxGeometry args={[length, 0.62, 0.24]} />
        <meshStandardMaterial color={LEATHER} roughness={0.45} />
      </mesh>
      {/* rolled arms */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (length - 0.18)) / 2, 0.52, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.13, depth - 0.26, 6, 12]} />
          <meshStandardMaterial color={LEATHER_LIGHT} roughness={0.4} />
        </mesh>
      ))}
      {/* seat and back cushions with tufting buttons */}
      {Array.from({ length: seats }, (_, i) => {
        const x = -length / 2 + 0.18 + cushionW * (i + 0.5)
        return (
          <group key={i} position={[x, 0, 0]}>
            <mesh position={[0, 0.44, 0.06]}>
              <boxGeometry args={[cushionW - 0.03, 0.14, depth - 0.3]} />
              <meshStandardMaterial color={LEATHER_LIGHT} roughness={0.4} />
            </mesh>
            {[0.55, 0.75].map((y) =>
              [-0.15, 0.15].map((dx) => (
                <mesh key={`${y}${dx}`} position={[dx, y, -depth / 2 + 0.245]}>
                  <sphereGeometry args={[0.018, 8, 6]} />
                  <meshStandardMaterial color="#3a1c10" />
                </mesh>
              )),
            )}
          </group>
        )
      })}
      {/* feet */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[(sx * (length - 0.2)) / 2, 0.035, (sz * (depth - 0.2)) / 2]}>
            <cylinderGeometry args={[0.035, 0.03, 0.07, 10]} />
            <meshStandardMaterial color="#2a160c" />
          </mesh>
        )),
      )}
    </group>
  )
}

/** Two leather couches facing each other over a coffee table, with a lamp and some Yale books. */
function Lounge() {
  const { table } = LOUNGE
  const title = useMemo(() => [{ text: 'YALE', size: 60, weight: 800, color: '#c9a227', font: 'serif' as const }], [])
  return (
    <group>
      {LOUNGE.couches.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation={[0, c.rotationY, 0]}>
          <Couch length={c.length} />
        </group>
      ))}
      {/* coffee table */}
      <group position={[table.x, 0, table.z]}>
        <mesh position={[0, table.h, 0]}>
          <boxGeometry args={[table.w, 0.06, table.d]} />
          <meshStandardMaterial color="#3d2414" roughness={0.35} />
        </mesh>
        <mesh position={[0, table.h / 2, 0]}>
          <boxGeometry args={[table.w - 0.12, table.h - 0.06, table.d - 0.12]} />
          <meshStandardMaterial color="#4a2c18" roughness={0.6} />
        </mesh>
        {/* stack of Yale books and a mug */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0.05, table.h + 0.05 + i * 0.045, -0.25]} rotation={[0, i * 0.25, 0]}>
            <boxGeometry args={[0.3, 0.04, 0.22]} />
            <meshStandardMaterial color={[NAVY, '#7a1f1f', '#e9e0cc'][i]} />
          </mesh>
        ))}
        <Label lines={title} width={0.18} position={[0.05, table.h + 0.165, -0.25]} rotationY={0} />
        <mesh position={[-0.12, table.h + 0.08, 0.3]}>
          <cylinderGeometry args={[0.045, 0.04, 0.1, 16]} />
          <meshStandardMaterial color={NAVY} />
        </mesh>
      </group>
      {/* side table with a reading lamp by the window */}
      <group position={[-5.25, 0, 3.15]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.6, 20]} />
          <meshStandardMaterial color="#3d2414" />
        </mesh>
        <mesh position={[0, 0.85, 0]}>
          <cylinderGeometry args={[0.03, 0.05, 0.5, 10]} />
          <meshStandardMaterial color="#c8a24a" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.14, 0.24, 0.28, 20, 1, true]} />
          <meshStandardMaterial color="#f3e4c4" emissive="#ffcf8a" emissiveIntensity={0.6} side={THREE.DoubleSide} />
        </mesh>
        <pointLight position={[0, 1.15, 0]} color={WARM_LIGHT} intensity={2.5} distance={3.5} decay={1.6} />
      </group>
    </group>
  )
}

/** Painted Yale campus murals across the blue walls, each in a thin walnut frame. */
const WALL_PLACE = {
  left: (at: number) => ({ position: [ROOM.minX + 0.03, at] as const, rotationY: Math.PI / 2 }),
  right: (at: number) => ({ position: [ROOM.maxX - 0.03, at] as const, rotationY: -Math.PI / 2 }),
  back: (at: number) => ({ position: [at, ROOM.minZ + 0.03] as const, rotationY: 0 }),
}

function Murals() {
  return (
    <group>
      {MURALS.map((m) => {
        const { position, rotationY } = WALL_PLACE[m.wall](m.at)
        return (
          <group key={m.scene} position={[position[0], m.y, position[1]]} rotation={[0, rotationY, 0]}>
            <mesh position={[0, 0, -0.005]}>
              <planeGeometry args={[m.width + 0.08, m.height + 0.08]} />
              <meshStandardMaterial color="#3a2516" roughness={0.7} />
            </mesh>
            <mesh>
              <planeGeometry args={[m.width, m.height]} />
              <meshStandardMaterial map={muralTexture(m.scene, m.width / m.height)} roughness={0.95} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/** Cozy extras: rug, plants, pendant lamps. */
function Cozy() {
  const rug = useMemo(() => rugTexture(), [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -1.4]}>
        <planeGeometry args={[4.2, 2.6]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      {[
        [-1.75, 3.45],
        [5.35, -13.35],
        [-5.35, -13.35],
        [-5.4, -7.6],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.24, 0.18, 0.5, 16]} />
            <meshStandardMaterial color="#c56b3c" roughness={0.8} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos(i * 1.3) * 0.12, 0.85 + (i % 3) * 0.15, Math.sin(i * 1.3) * 0.12]}>
              <sphereGeometry args={[0.28, 12, 10]} />
              <meshStandardMaterial color={i % 2 ? '#4f7a3a' : '#3f6b30'} roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
      {/* warm pendant lamps over the tables */}
      {TABLES.map((t) => (
        <group key={t.title} position={[t.position[0], WALL_HEIGHT, t.position[2]]}>
          <mesh position={[0, -0.45, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.9]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, -0.98, 0]}>
            <coneGeometry args={[0.32, 0.3, 24, 1, true]} />
            <meshStandardMaterial color="#1f2a44" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -1.08, 0]}>
            <sphereGeometry args={[0.08, 12, 10]} />
            <meshBasicMaterial color="#fff1d6" />
          </mesh>
          <pointLight position={[0, -1.2, 0]} color={WARM_LIGHT} intensity={4} distance={4.5} decay={1.6} />
        </group>
      ))}
    </group>
  )
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#fff4e2', '#6b4a2b', 1.0]} />
      <ambientLight color="#ffe8cc" intensity={0.4} />
      <directionalLight position={[6, 12, 14]} intensity={1.1} color="#fff6e8" />
      {/* warm track lights down the store */}
      {[-11.5, -8, -4.5, -1, 2].map((z) => (
        <pointLight key={z} position={[0, WALL_HEIGHT - 0.9, z]} color={WARM_LIGHT} intensity={7} distance={7.5} decay={1.4} />
      ))}
      {/* wash lights on the tee wall and the racks */}
      <spotLight position={[-2.5, WALL_HEIGHT - 0.2, TEE_WALL.z]} target-position={[ROOM.minX, 1.5, TEE_WALL.z]} angle={0.9} penumbra={0.8} intensity={14} color={WARM_LIGHT} distance={9} />
      <spotLight position={[2.5, WALL_HEIGHT - 0.2, -5.7]} target-position={[ROOM.maxX, 1.5, -5.7]} angle={0.95} penumbra={0.8} intensity={14} color={WARM_LIGHT} distance={9} />
      <spotLight position={[0, WALL_HEIGHT - 0.2, -10]} target-position={[0, 2, ROOM.minZ]} angle={0.8} penumbra={0.7} intensity={12} color={WARM_LIGHT} distance={9} />
    </>
  )
}

export default function StoreScene({ products }: { products: Map<string, Product> }) {
  return (
    <>
      <Lights />
      <Storefront />
      <RoomShell />
      <TeeWall />
      <BoolaNook />
      <HedgeWall />
      {WALL_RACKS.map((r) => (
        <WallRack key={r.sign} rack={r} />
      ))}
      <CenterRack />
      {TABLES.map((t) => (
        <DisplayTable key={t.title} table={t} products={products} />
      ))}
      <Counter />
      <Cozy />
      <Lounge />
      <Murals />
    </>
  )
}
