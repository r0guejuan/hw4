/**
 * Floor plan of the virtual Campus Customs store (meters; -z is "into the store").
 * Every fixture is modeled on the real shop photos: the folded-tee wall and cap pegboard,
 * the hanging sweatshirt racks under "YALE DEPT." signs, the hedge wall with the big blue
 * YALE sign and a round jacket rack, the Boola Boola nook, and Yale campus murals on the walls.
 *
 *              z = -14   hedge wall + big YALE sign      jacket rack
 *   x = -6 ┌──────────────────────────────────────────┐ x = 6
 *          │ Boola Boola nook          quarter-zip rack │ crewneck rack
 *          │                                            │
 *          │ tee cubbies +    [table]      [table]      │ hoodie rack
 *          │ cap pegboard           rug                 │
 *          │ couches + coffee table           mural on wall │
 *          │                       counter │ Handsome Dan (life-size)
 *          └────────────────────[door]──────────────────┘ z = 4  storefront
 *                     sidewalk in front of the store (spawn at z = 9.8)
 */

import type { MuralScene } from './murals'

export const EYE_HEIGHT = 1.6
export const WALL_HEIGHT = 4.2

export const ROOM = { minX: -6, maxX: 6, minZ: -14, maxZ: 4 }
// Outside, the shopper only has the stretch of sidewalk in front of the store.
export const SIDEWALK = { minX: -3.5, maxX: 3.5, minZ: 4.6, maxZ: 10.2 }
export const SPAWN_OUTSIDE = { x: 0, z: 9.8, yaw: 0 }
/** Outside, looking around is limited so the view stays on the storefront. */
export const OUTSIDE_LOOK = { maxYaw: 0.4, minPitch: -0.35, maxPitch: 0.4 }
export const SPAWN_INSIDE = { x: 0, z: 2.6, yaw: 0 }
export const DOOR = { x: 0, width: 2.2, height: 3 }
export const BODY_RADIUS = 0.35

/** What happens when the shopper interacts with something. */
export type StoreAction =
  | { kind: 'link'; to: string; label: string }
  | { kind: 'chat'; label: string; prompt?: string }
  | { kind: 'enter'; label: string }
  | { kind: 'exit'; label: string }

export const ACTIONS = {
  tees: { kind: 'link', to: '/products?category=T-Shirts', label: 'Shop T-shirts' },
  hoodies: { kind: 'link', to: '/products?category=Hoodies', label: 'Shop hoodies' },
  crewnecks: { kind: 'link', to: '/products?category=Crewnecks', label: 'Shop crewnecks' },
  quarterZips: { kind: 'link', to: '/products?category=Quarter-Zips', label: 'Shop quarter-zips' },
  jackets: { kind: 'link', to: '/products?category=Jackets', label: 'Shop jackets' },
  boola: { kind: 'link', to: '/products/boola-boola-t-shirt', label: 'See the Boola Boola tee' },
  gifts: { kind: 'chat', label: 'Ask Dan for gift ideas', prompt: 'Gift for a parent' },
  caps: { kind: 'chat', label: 'Ask Dan what to wear with a cap', prompt: 'What goes well with a Yale cap?' },
  dan: { kind: 'chat', label: 'Talk to Handsome Dan' },
  enter: { kind: 'enter', label: 'Step inside the store' },
  exit: { kind: 'exit', label: 'Step back outside' },
} satisfies Record<string, StoreAction>

/* ---- Fixtures (positions are centers; sizes in meters) ---- */

/** Folded-tee cubbies along the left wall, with the cap pegboard above. */
export const TEE_WALL = { x: ROOM.minX, z: -3.4, length: 6, height: 2.4, depth: 0.5, cols: 8, rows: 4 }
export const CAP_WALL = { y: 3.3, height: 1.2, cols: 12, rows: 2 }

/** Boola Boola nook at the back of the left wall: hedge panel, sign, and a table of stacked tees. */
export const BOOLA = {
  wallZ: -10.8,
  wallWidth: 4,
  table: { x: -4.75, z: -10.8, w: 1.1, d: 2.6, h: 0.85 },
}

/** Hedge wall with the big YALE sign, across the middle of the back wall, and a round jacket rack. */
export const HEDGE_WALL = { width: 7, height: 3.2 }
export const JACKET_RACK = { x: 2.6, z: -12.2, radius: 0.75, height: 1.5, count: 12 }

/** Wall racks of hanging sweatshirts along the right wall. */
export const WALL_RACKS = [
  { z: -2.8, length: 4, kind: 'hoodie' as const, action: ACTIONS.hoodies, sign: 'HOODIES' },
  { z: -8.6, length: 4, kind: 'crew' as const, action: ACTIONS.crewnecks, sign: 'CREWNECKS' },
]
export const RACK_OFFSET = 0.55 // distance of the rail from the wall

/** Freestanding quarter-zip rack in the back middle, garments facing the entrance. */
export const CENTER_RACK = { x: -0.6, z: -9.4, length: 3.2 }

/** Display tables with real catalogue items. */
export const TABLES: { position: [number, number, number]; productIds: string[]; title: string }[] = [
  {
    position: [-2.1, 0, -4.8],
    title: 'Fan Favorites',
    productIds: ['basic-hoodie-big-yale', '2025-yale-vs-harvard-t-shirt', 'big-yale-tri-blend-t-shirt', 'champion-reverse-weave-hoodie-1'],
  },
  {
    position: [2.1, 0, -4.8],
    title: 'College Pride',
    productIds: ['grace-hopper-college-crewneck', 'branford-1-4-zip', 'district-vit-crewneck-vintage-bulldog', 'brooks-brothers-bomber-jacket-yale'],
  },
]
export const TABLE_SIZE = { w: 2.6, d: 1.2, h: 0.85 }

/** Checkout counter by the door (long side along z), with a life-size Handsome Dan behind it. */
export const COUNTER = { x: 3.9, z: 0.4, w: 0.8, d: 2.6, h: 1.0 }
export const DAN = { x: 5.15, z: 0.4 }

/** Leather-couch lounge in the front-left corner, by the window. */
export const LOUNGE = {
  couches: [
    { x: -5.15, z: 1.7, rotationY: Math.PI / 2, length: 2.2 }, // back to the left wall, facing the room
    { x: -2.15, z: 1.7, rotationY: -Math.PI / 2, length: 2.0 }, // facing it across the table
  ],
  table: { x: -3.65, z: 1.7, w: 0.75, d: 1.3, h: 0.42 },
  couchDepth: 0.9,
}

/** Painted Yale campus murals filling the blue walls (centers; y is the mural's middle). */
export interface MuralSpot {
  scene: MuralScene
  wall: 'left' | 'right' | 'back'
  at: number // z along a side wall, x along the back wall
  y: number
  width: number
  height: number
}
export const MURALS: MuralSpot[] = [
  { scene: 'harkness', wall: 'right', at: 1.45, y: 2.45, width: 4.4, height: 2.6 }, // behind Handsome Dan
  { scene: 'cross-campus', wall: 'right', at: -2.85, y: 2.85, width: 3.6, height: 1.6 }, // above the hoodies
  { scene: 'beinecke', wall: 'right', at: -5.7, y: 2.3, width: 1.5, height: 2.6 },
  { scene: 'bowl', wall: 'right', at: -8.6, y: 2.85, width: 3.6, height: 1.6 }, // above the crewnecks
  { scene: 'gym', wall: 'right', at: -12.35, y: 2.3, width: 2.6, height: 2.9 },
  { scene: 'woolsey', wall: 'back', at: 4.75, y: 2.4, width: 2.3, height: 2.6 },
  { scene: 'phelps', wall: 'back', at: -4.75, y: 2.4, width: 2.3, height: 2.6 },
  { scene: 'green', wall: 'left', at: -7.6, y: 2.3, width: 1.8, height: 2.6 },
  { scene: 'sterling', wall: 'left', at: 1.75, y: 2.55, width: 3.6, height: 2.1 }, // above the couches
]

/* ---- Collision ---- */

interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}
const box = (cx: number, cz: number, w: number, d: number): Box => ({
  minX: cx - w / 2,
  maxX: cx + w / 2,
  minZ: cz - d / 2,
  maxZ: cz + d / 2,
})

export const OBSTACLES: Box[] = [
  box(TEE_WALL.x + TEE_WALL.depth / 2, TEE_WALL.z, TEE_WALL.depth, TEE_WALL.length),
  box(BOOLA.table.x, BOOLA.table.z, BOOLA.table.w, BOOLA.table.d),
  box(JACKET_RACK.x, JACKET_RACK.z, JACKET_RACK.radius * 2.4, JACKET_RACK.radius * 2.4),
  ...WALL_RACKS.map((r) => box(ROOM.maxX - RACK_OFFSET, r.z, 1.1, r.length)),
  box(CENTER_RACK.x, CENTER_RACK.z, CENTER_RACK.length + 0.3, 0.9),
  ...TABLES.map((t) => box(t.position[0], t.position[2], TABLE_SIZE.w, TABLE_SIZE.d)),
  box(COUNTER.x, COUNTER.z, COUNTER.w, COUNTER.d),
  box(DAN.x, DAN.z, 0.9, 0.9),
  ...LOUNGE.couches.map((c) => box(c.x, c.z, LOUNGE.couchDepth, c.length)),
  box(LOUNGE.table.x, LOUNGE.table.z, LOUNGE.table.w, LOUNGE.table.d),
]

export type Zone = 'outside' | 'inside'

/** Keep a point inside the current zone and outside every obstacle. */
export function collide(x: number, z: number, zone: Zone): [number, number] {
  const r = BODY_RADIUS
  const area = zone === 'inside' ? ROOM : SIDEWALK
  let nx = Math.min(area.maxX - r, Math.max(area.minX + r, x))
  let nz = Math.min(area.maxZ - r, Math.max(area.minZ + r, z))
  if (zone === 'inside') {
    for (const o of OBSTACLES) {
      if (nx > o.minX - r && nx < o.maxX + r && nz > o.minZ - r && nz < o.maxZ + r) {
        const pushes: [number, number][] = [
          [o.minX - r - nx, 0],
          [o.maxX + r - nx, 0],
          [0, o.minZ - r - nz],
          [0, o.maxZ + r - nz],
        ]
        const [dx, dz] = pushes.reduce((best, p) => (Math.abs(p[0] + p[1]) < Math.abs(best[0] + best[1]) ? p : best))
        nx += dx
        nz += dz
      }
    }
  }
  return [nx, nz]
}
