/**
 * Painted murals of the Yale campus for the store's walls, drawn on canvases in a soft,
 * hand-painted style. Each scene gets its name lettered in a corner, like a real wall mural.
 */
import { canvasTexture, SERIF } from './textures'

export type MuralScene =
  | 'harkness'
  | 'sterling'
  | 'beinecke'
  | 'phelps'
  | 'bowl'
  | 'woolsey'
  | 'gym'
  | 'green'
  | 'cross-campus'

export const MURAL_TITLES: Record<MuralScene, string> = {
  harkness: 'Lux et Veritas',
  sterling: 'Sterling Memorial Library',
  beinecke: 'Beinecke Library',
  phelps: 'Phelps Gate · Old Campus',
  bowl: 'The Yale Bowl',
  woolsey: 'Woolsey Hall',
  gym: 'Payne Whitney Gym',
  green: 'New Haven Green',
  'cross-campus': 'Cross Campus',
}

type Ctx = CanvasRenderingContext2D

const STONE = '#b9a58a'
const STONE_DARK = '#8c7a62'
const GLOW = '#ffd58a'

function sky(ctx: Ctx, W: number, H: number, stops: string[], horizon = 0.72) {
  const g = ctx.createLinearGradient(0, 0, 0, H * horizon)
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function clouds(ctx: Ctx, list: [number, number, number][], color = 'rgba(255, 245, 230, 0.4)') {
  ctx.fillStyle = color
  for (const [x, y, w] of list) {
    ctx.beginPath()
    ctx.ellipse(x, y, w / 2, w / 9, 0, 0, Math.PI * 2)
    ctx.ellipse(x + w / 5, y - w / 14, w / 4, w / 10, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Pointed Gothic windows in a grid. */
function gothicWindows(ctx: Ctx, x: number, y: number, w: number, h: number, ww = 14, gap = 30, row = 46) {
  ctx.fillStyle = GLOW
  for (let wx = x + 14; wx < x + w - ww - 2; wx += gap) {
    for (let wy = y + 26; wy < y + h - 30; wy += row) {
      ctx.beginPath()
      ctx.moveTo(wx, wy + 26)
      ctx.lineTo(wx, wy + 8)
      ctx.quadraticCurveTo(wx + ww / 2, wy - 4, wx + ww, wy + 8)
      ctx.lineTo(wx + ww, wy + 26)
      ctx.closePath()
      ctx.fill()
    }
  }
}

/** A crenellated Gothic hall. */
function hall(ctx: Ctx, x: number, w: number, h: number, base: number, color = STONE) {
  ctx.fillStyle = color
  ctx.fillRect(x, base - h, w, h)
  for (let i = 0; i < w; i += 18) ctx.fillRect(x + i, base - h - 10, 10, 10)
  gothicWindows(ctx, x, base - h, w, h)
  ctx.fillStyle = STONE_DARK
  ctx.fillRect(x, base - 8, w, 8)
}

/** A square Gothic tower with pinnacles and a spire. */
function tower(ctx: Ctx, cx: number, w: number, h: number, base: number, spire = true) {
  ctx.fillStyle = STONE
  ctx.fillRect(cx - w / 2, base - h, w, h)
  ctx.fillRect(cx - w * 0.38, base - h - h * 0.22, w * 0.76, h * 0.22)
  for (const dx of [-w / 2, w / 2 - 10]) {
    ctx.beginPath()
    ctx.moveTo(cx + dx, base - h)
    ctx.lineTo(cx + dx + 5, base - h - 40)
    ctx.lineTo(cx + dx + 10, base - h)
    ctx.fill()
  }
  if (spire) {
    ctx.beginPath()
    ctx.moveTo(cx - w * 0.25, base - h - h * 0.22)
    ctx.lineTo(cx, base - h - h * 0.55)
    ctx.lineTo(cx + w * 0.25, base - h - h * 0.22)
    ctx.fill()
  }
  ctx.fillStyle = GLOW
  for (let i = 0; i < 3; i++) {
    const y = base - h * (0.2 + i * 0.28)
    const ww = w * 0.22
    ctx.beginPath()
    ctx.moveTo(cx - ww / 2, y + 40)
    ctx.lineTo(cx - ww / 2, y + 12)
    ctx.quadraticCurveTo(cx, y - 6, cx + ww / 2, y + 12)
    ctx.lineTo(cx + ww / 2, y + 40)
    ctx.closePath()
    ctx.fill()
  }
}

function tree(ctx: Ctx, x: number, base: number, r: number, leaf = '#3f6b33', light = 'rgba(160, 200, 110, 0.35)') {
  ctx.fillStyle = '#4a3020'
  ctx.fillRect(x - r * 0.08, base - r * 0.6, r * 0.16, r * 0.6)
  ctx.fillStyle = leaf
  ctx.beginPath()
  ctx.ellipse(x, base - r * 1.05, r * 0.9, r * 0.75, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = light
  ctx.beginPath()
  ctx.ellipse(x - r * 0.3, base - r * 1.25, r * 0.4, r * 0.3, 0, 0, Math.PI * 2)
  ctx.fill()
}

function lawn(ctx: Ctx, W: number, H: number, base: number, top = '#5f8a45', bottom = '#3f6a30') {
  const g = ctx.createLinearGradient(0, base, 0, H)
  g.addColorStop(0, top)
  g.addColorStop(1, bottom)
  ctx.fillStyle = g
  ctx.fillRect(0, base, W, H - base)
}

function people(ctx: Ctx, list: [number, number, string][], scale = 1) {
  for (const [x, y, c] of list) {
    ctx.fillStyle = c
    ctx.fillRect(x - 5 * scale, y - 26 * scale, 10 * scale, 20 * scale)
    ctx.fillStyle = '#e9c9a8'
    ctx.beginPath()
    ctx.arc(x, y - 32 * scale, 6 * scale, 0, Math.PI * 2)
    ctx.fill()
  }
}

/* ---- scenes ---- */

function harkness(ctx: Ctx, W: number, H: number) {
  sky(ctx, W, H, ['#2c4f86', '#7d8fbf', '#f2b77e', '#f7d6a0'])
  clouds(ctx, [
    [W * 0.15, H * 0.14, 180],
    [W * 0.64, H * 0.11, 240],
  ])
  const base = H * 0.72
  hall(ctx, W * 0.04, W * 0.27, H * 0.29, base)
  hall(ctx, W * 0.66, W * 0.3, H * 0.26, base)
  tower(ctx, W * 0.47, W * 0.1, H * 0.48, base)
  ;[0.33, 0.38, 0.59, 0.63, 0.89].forEach((x, i) => tree(ctx, W * x, base, H * (0.11 + (i % 2) * 0.03)))
  lawn(ctx, W, H, base)
  people(ctx, [
    [W * 0.27, base + H * 0.12, '#00356b'],
    [W * 0.56, base + H * 0.17, '#f4f1ea'],
    [W * 0.75, base + H * 0.1, '#00356b'],
  ])
}

function sterling(ctx: Ctx, W: number, H: number) {
  sky(ctx, W, H, ['#6fa2d8', '#a9cbe9', '#e6eef4'])
  clouds(ctx, [
    [W * 0.2, H * 0.12, 220],
    [W * 0.78, H * 0.2, 180],
  ])
  const base = H * 0.74
  // the long "cathedral" nave and its great entrance arch
  ctx.fillStyle = STONE
  ctx.fillRect(W * 0.08, base - H * 0.3, W * 0.84, H * 0.3)
  ctx.beginPath()
  ctx.moveTo(W * 0.3, base - H * 0.3)
  ctx.lineTo(W * 0.5, base - H * 0.42)
  ctx.lineTo(W * 0.7, base - H * 0.3)
  ctx.fill()
  gothicWindows(ctx, W * 0.08, base - H * 0.3, W * 0.22, H * 0.3)
  gothicWindows(ctx, W * 0.7, base - H * 0.3, W * 0.22, H * 0.3)
  // the stack tower
  tower(ctx, W * 0.5, W * 0.13, H * 0.42, base - H * 0.12, false)
  ctx.fillStyle = '#5a4630'
  ctx.beginPath()
  ctx.moveTo(W * 0.44, base)
  ctx.lineTo(W * 0.44, base - H * 0.14)
  ctx.quadraticCurveTo(W * 0.5, base - H * 0.24, W * 0.56, base - H * 0.14)
  ctx.lineTo(W * 0.56, base)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = GLOW
  ctx.globalAlpha = 0.6
  ctx.fillRect(W * 0.47, base - H * 0.11, W * 0.06, H * 0.11)
  ctx.globalAlpha = 1
  ;[0.06, 0.94].forEach((x) => tree(ctx, W * x, base, H * 0.16))
  lawn(ctx, W, H, base, '#6f9a52', '#4a7638')
  people(ctx, [
    [W * 0.3, base + H * 0.12, '#00356b'],
    [W * 0.36, base + H * 0.15, '#7a1f1f'],
    [W * 0.68, base + H * 0.11, '#f4f1ea'],
  ])
}

function beinecke(ctx: Ctx, W: number, H: number) {
  sky(ctx, W, H, ['#3d6fb5', '#8fb6e0', '#dcebf6'], 0.65)
  const base = H * 0.78
  // plaza
  ctx.fillStyle = '#d9d4ca'
  ctx.fillRect(0, base, W, H - base)
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = 2
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x, base)
    ctx.lineTo(x + (x - W / 2) * 0.4, H)
    ctx.stroke()
  }
  // the marble cube on corner piers, glowing amber panels
  const cw = W * 0.72
  const ch = H * 0.42
  const x0 = (W - cw) / 2
  const y0 = base - ch - H * 0.08
  ctx.fillStyle = '#e8e2d4'
  ctx.fillRect(x0, y0, cw, ch)
  const n = 6
  const m = 4
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const px = x0 + 8 + (i * (cw - 16)) / n
      const py = y0 + 8 + (j * (ch - 16)) / m
      const g = ctx.createRadialGradient(px + 20, py + 20, 2, px + 20, py + 20, 50)
      g.addColorStop(0, '#f6c77a')
      g.addColorStop(1, '#c98f4a')
      ctx.fillStyle = g
      ctx.fillRect(px + 4, py + 4, (cw - 16) / n - 8, (ch - 16) / m - 8)
    }
  }
  ctx.fillStyle = '#cfc8b8'
  for (const x of [x0, x0 + cw - 18]) ctx.fillRect(x, y0 + ch, 18, H * 0.08)
  ctx.fillStyle = 'rgba(0,0,0,0.15)'
  ctx.fillRect(x0 + 18, y0 + ch, cw - 36, H * 0.08)
  people(ctx, [
    [W * 0.25, H * 0.94, '#00356b'],
    [W * 0.7, H * 0.92, '#f4f1ea'],
  ])
}

function phelps(ctx: Ctx, W: number, H: number) {
  sky(ctx, W, H, ['#4f79b5', '#9cbde0', '#f1dcc0'])
  const base = H * 0.74
  // gatehouse with a big arch and twin turrets
  ctx.fillStyle = STONE
  ctx.fillRect(W * 0.2, base - H * 0.38, W * 0.6, H * 0.38)
  for (const x of [W * 0.2, W * 0.73]) {
    ctx.fillRect(x, base - H * 0.5, W * 0.07, H * 0.5)
    for (let i = 0; i < 3; i++) ctx.fillRect(x + i * W * 0.025, base - H * 0.53, W * 0.015, H * 0.03)
  }
  for (let i = 0; i < W * 0.46; i += 18) ctx.fillRect(W * 0.27 + i, base - H * 0.41, 10, H * 0.03)
  ctx.fillStyle = '#3b2a1a'
  ctx.beginPath()
  ctx.moveTo(W * 0.42, base)
  ctx.lineTo(W * 0.42, base - H * 0.18)
  ctx.quadraticCurveTo(W * 0.5, base - H * 0.3, W * 0.58, base - H * 0.18)
  ctx.lineTo(W * 0.58, base)
  ctx.closePath()
  ctx.fill()
  // the lawn glimpsed through the arch
  ctx.fillStyle = '#6f9a52'
  ctx.fillRect(W * 0.43, base - H * 0.06, W * 0.14, H * 0.06)
  gothicWindows(ctx, W * 0.27, base - H * 0.38, W * 0.13, H * 0.3)
  gothicWindows(ctx, W * 0.6, base - H * 0.38, W * 0.13, H * 0.3)
  // fall foliage
  ;[0.08, 0.14, 0.88, 0.94].forEach((x, i) =>
    tree(ctx, W * x, base, H * (0.15 + (i % 2) * 0.03), i % 2 ? '#d9792b' : '#c8492b', 'rgba(255, 200, 90, 0.4)'),
  )
  lawn(ctx, W, H, base, '#7d9a4a', '#5a7a36')
  ctx.fillStyle = '#e07b2c'
  for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % W, base + ((i * 53) % (H - base)), 6, 4)
  people(ctx, [
    [W * 0.33, base + H * 0.14, '#00356b'],
    [W * 0.62, base + H * 0.18, '#f4f1ea'],
  ])
}

function bowl(ctx: Ctx, W: number, H: number) {
  sky(ctx, W, H, ['#2f63a8', '#79a9db', '#cfe3f3'], 0.4)
  // seating rings of the bowl
  const cx = W / 2
  const cy = H * 0.62
  for (let r = 0; r < 10; r++) {
    ctx.fillStyle = r % 2 ? '#c9c2b4' : '#b5ad9d'
    ctx.beginPath()
    ctx.ellipse(cx, cy, W * 0.5 - r * W * 0.022, H * 0.3 - r * H * 0.014, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // the crowd: navy and white dots
  for (let i = 0; i < 900; i++) {
    const a = (i * 2.399) % (Math.PI * 2)
    const rr = 0.62 + ((i * 37) % 30) / 100
    const x = cx + Math.cos(a) * W * 0.47 * rr
    const y = cy + Math.sin(a) * H * 0.27 * rr
    if (y > cy - H * 0.27) {
      ctx.fillStyle = i % 3 ? '#00356b' : '#f4f1ea'
      ctx.fillRect(x, y, 3, 3)
    }
  }
  // the field
  ctx.fillStyle = '#4f8a3c'
  ctx.beginPath()
  ctx.ellipse(cx, cy, W * 0.29, H * 0.13, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 2
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath()
    ctx.moveTo(cx + i * W * 0.05, cy - H * 0.1)
    ctx.lineTo(cx + i * W * 0.05, cy + H * 0.1)
    ctx.stroke()
  }
  ctx.fillStyle = '#00356b'
  ctx.font = `800 ${Math.round(H * 0.07)}px ${SERIF}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('YALE', cx, cy + 2)
}

function woolsey(ctx: Ctx, W: number, H: number) {
  sky(ctx, W, H, ['#e7a86b', '#f2c995', '#f8e3c2'])
  const base = H * 0.78
  // classical rotunda with a colonnade and a dome
  ctx.fillStyle = '#e5ddca'
  ctx.fillRect(W * 0.18, base - H * 0.42, W * 0.64, H * 0.42)
  ctx.beginPath()
  ctx.ellipse(W / 2, base - H * 0.42, W * 0.2, H * 0.2, 0, Math.PI, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#d3c8b0'
  ctx.fillRect(W * 0.16, base - H * 0.46, W * 0.68, H * 0.04)
  for (let i = 0; i < 9; i++) {
    const x = W * 0.21 + i * W * 0.072
    ctx.fillStyle = '#f2ecdd'
    ctx.fillRect(x, base - H * 0.4, W * 0.025, H * 0.34)
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(x + W * 0.018, base - H * 0.4, W * 0.007, H * 0.34)
  }
  ctx.fillStyle = 'rgba(255, 213, 138, 0.55)'
  ctx.fillRect(W * 0.23, base - H * 0.34, W * 0.54, H * 0.22)
  // steps and the plaza
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? '#d9d1bf' : '#cbc2ae'
    ctx.fillRect(W * (0.14 - i * 0.02), base - H * 0.06 + i * H * 0.015, W * (0.72 + i * 0.04), H * 0.015)
  }
  ctx.fillStyle = '#c9bfa9'
  ctx.fillRect(0, base, W, H - base)
  people(ctx, [
    [W * 0.3, H * 0.93, '#00356b'],
    [W * 0.52, H * 0.96, '#1d1d1d'],
    [W * 0.7, H * 0.92, '#7a1f1f'],
  ])
}

function gym(ctx: Ctx, W: number, H: number) {
  sky(ctx, W, H, ['#22325e', '#5b5f99', '#e3907a', '#f4b98a'])
  const base = H * 0.82
  // the "cathedral of sweat": a tall Gothic tower at dusk
  hall(ctx, W * 0.05, W * 0.9, H * 0.22, base, '#a8977f')
  tower(ctx, W * 0.5, W * 0.38, H * 0.48, base - H * 0.18, false)
  lawn(ctx, W, H, base, '#4f6f3c', '#344d28')
  ;[0.12, 0.88].forEach((x) => tree(ctx, W * x, base, H * 0.12, '#2f5228', 'rgba(140, 170, 90, 0.3)'))
}

function green(ctx: Ctx, W: number, H: number) {
  sky(ctx, W, H, ['#8fa6c2', '#c3d1e0', '#eef2f6'])
  const base = H * 0.68
  // three white churches with steeples on the Green
  const church = (cx: number, w: number, h: number) => {
    ctx.fillStyle = '#f5f2ec'
    ctx.fillRect(cx - w / 2, base - h, w, h)
    ctx.beginPath()
    ctx.moveTo(cx - w / 2 - 6, base - h)
    ctx.lineTo(cx, base - h - w * 0.35)
    ctx.lineTo(cx + w / 2 + 6, base - h)
    ctx.fill()
    ctx.fillRect(cx - w * 0.12, base - h - w * 0.35 - h * 0.5, w * 0.24, h * 0.5)
    ctx.beginPath()
    ctx.moveTo(cx - w * 0.12, base - h - w * 0.35 - h * 0.5)
    ctx.lineTo(cx, base - h - w * 0.35 - h * 1.1)
    ctx.lineTo(cx + w * 0.12, base - h - w * 0.35 - h * 0.5)
    ctx.fill()
    ctx.fillStyle = '#7a8796'
    for (let i = 0; i < 3; i++) ctx.fillRect(cx - w * 0.3 + i * w * 0.24, base - h * 0.7, w * 0.12, h * 0.4)
  }
  church(W * 0.2, W * 0.16, H * 0.22)
  church(W * 0.5, W * 0.2, H * 0.26)
  church(W * 0.8, W * 0.16, H * 0.22)
  // snow
  ctx.fillStyle = '#f4f6f9'
  ctx.fillRect(0, base, W, H - base)
  ;[0.08, 0.35, 0.65, 0.92].forEach((x) => {
    ctx.strokeStyle = '#5a4434'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(W * x, base + 10)
    ctx.lineTo(W * x, base - H * 0.16)
    ctx.moveTo(W * x, base - H * 0.08)
    ctx.lineTo(W * x - 28, base - H * 0.16)
    ctx.moveTo(W * x, base - H * 0.1)
    ctx.lineTo(W * x + 26, base - H * 0.19)
    ctx.stroke()
  })
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (let i = 0; i < 160; i++) {
    ctx.beginPath()
    ctx.arc((i * 131) % W, (i * 71) % base, 2 + (i % 3), 0, Math.PI * 2)
    ctx.fill()
  }
  people(ctx, [
    [W * 0.42, base + H * 0.16, '#00356b'],
    [W * 0.47, base + H * 0.18, '#7a1f1f'],
  ])
}

function crossCampus(ctx: Ctx, W: number, H: number) {
  sky(ctx, W, H, ['#5d8fcf', '#a6c8ea', '#e9f1f7'])
  const base = H * 0.62
  hall(ctx, -W * 0.02, W * 0.32, H * 0.22, base)
  hall(ctx, W * 0.7, W * 0.34, H * 0.24, base)
  tower(ctx, W * 0.5, W * 0.08, H * 0.28, base - H * 0.05)
  // the long lawn with sunbathers and frisbee players
  lawn(ctx, W, H, base, '#76a35a', '#4f7a3a')
  ctx.strokeStyle = '#ddd0b3'
  ctx.lineWidth = 12
  ctx.beginPath()
  ctx.moveTo(W * 0.5, base)
  ctx.lineTo(W * 0.5, H)
  ctx.stroke()
  ;[0.18, 0.3, 0.68, 0.82].forEach((x, i) => tree(ctx, W * x, base + H * 0.05, H * (0.12 + (i % 2) * 0.02)))
  people(ctx, [
    [W * 0.24, base + H * 0.2, '#00356b'],
    [W * 0.37, base + H * 0.28, '#f4f1ea'],
    [W * 0.62, base + H * 0.24, '#c94f3d'],
    [W * 0.75, base + H * 0.3, '#00356b'],
  ])
  ctx.fillStyle = '#f4f1ea'
  ctx.beginPath()
  ctx.ellipse(W * 0.5, base + H * 0.17, 12, 4, 0, 0, Math.PI * 2)
  ctx.fill()
}

const PAINTERS: Record<MuralScene, (ctx: Ctx, W: number, H: number) => void> = {
  harkness,
  sterling,
  beinecke,
  phelps,
  bowl,
  woolsey,
  gym,
  green,
  'cross-campus': crossCampus,
}

/** The mural for one scene, sized to the wall space (aspect = width / height). */
export function muralTexture(scene: MuralScene, aspect: number) {
  const W = 1100
  const H = Math.round(W / aspect)
  return canvasTexture(`mural:${scene}:${aspect.toFixed(2)}`, W, H, (ctx) => {
    PAINTERS[scene](ctx, W, H)
    // painted-on-a-wall finish: soft edges and a hand-lettered title
    const edge = ctx.createLinearGradient(0, 0, 0, H)
    edge.addColorStop(0, 'rgba(0,0,0,0.12)')
    edge.addColorStop(0.04, 'rgba(0,0,0,0)')
    edge.addColorStop(0.96, 'rgba(0,0,0,0)')
    edge.addColorStop(1, 'rgba(0,0,0,0.14)')
    ctx.fillStyle = edge
    ctx.fillRect(0, 0, W, H)
    const size = Math.round(Math.min(W, H) * 0.06)
    ctx.font = `italic 700 ${size}px ${SERIF}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = 'rgba(15, 25, 45, 0.35)'
    ctx.fillText(MURAL_TITLES[scene], W - size * 0.7 + 2, size * 1.45 + 2)
    ctx.fillStyle = 'rgba(255, 248, 235, 0.95)'
    ctx.fillText(MURAL_TITLES[scene], W - size * 0.7, size * 1.45)
  })
}
