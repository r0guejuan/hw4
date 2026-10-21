import * as THREE from 'three'

/**
 * Procedural textures for the store fixtures, drawn on canvases so the scene recreates the
 * real shop (folded YALE tees, hanging sweatshirts, hedge walls) instead of pasting
 * photos onto walls. Each function is cached by its arguments.
 */

const cache = new Map<string, THREE.CanvasTexture>()

export function canvasTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const hit = cache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  draw(canvas.getContext('2d')!)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(...repeat)
  }
  cache.set(key, texture)
  return texture
}

export const SERIF = "'Playfair Display', Georgia, serif"

/** Designs printed on the folded tees, modeled on the real wall: wordmarks, colleges, a crest. */
export type TeeDesign =
  | 'YALE'
  | 'Y'
  | 'crest'
  | 'BULLDOGS'
  | 'ELI'
  | 'BOOLA'
  | 'BRANFORD'
  | 'DAVENPORT'
  | 'SILLIMAN'
  | 'SAYBROOK'
  | 'MORSE'
  | 'PIERSON'
  | 'HOPPER'
  | 'TRUMBULL'

/** A small shield with a Y, like the Yale crest on the college tees. */
function drawCrest(ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number, ink: string, shirt: string) {
  const w = h * 0.8
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, cy - h / 2)
  ctx.lineTo(cx + w / 2, cy - h / 2)
  ctx.lineTo(cx + w / 2, cy)
  ctx.quadraticCurveTo(cx + w / 2, cy + h * 0.38, cx, cy + h / 2)
  ctx.quadraticCurveTo(cx - w / 2, cy + h * 0.38, cx - w / 2, cy)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = shirt
  ctx.font = `800 ${Math.round(h * 0.6)}px ${SERIF}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Y', cx, cy + h * 0.02)
}

/** A cubby full of folded tees, seen from the front: stacked folds with the design peeking out. */
export function foldedStackTexture(shirt: string, print: string, design: TeeDesign = 'YALE', count = 7) {
  return canvasTexture(`fold:${shirt}:${print}:${design}:${count}`, 256, 256, (ctx) => {
    ctx.fillStyle = '#3a2414'
    ctx.fillRect(0, 0, 256, 256)
    const h = 236 / count
    for (let i = 0; i < count; i++) {
      const y = 256 - (i + 1) * h - 4
      const inset = 10 + (i % 2) * 4
      ctx.fillStyle = shirt
      ctx.beginPath()
      ctx.roundRect(inset, y, 256 - inset * 2, h - 3, 6)
      ctx.fill()
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.fillRect(inset, y + h - 8, 256 - inset * 2, 5)
      const cx = 128 + ((i * 7) % 9) - 4
      const cy = y + h / 2 - 1
      ctx.fillStyle = print
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (design === 'crest') {
        drawCrest(ctx, cx, cy, h * 0.78, print, shirt)
      } else if (design === 'Y') {
        ctx.font = `800 ${Math.round(h * 0.78)}px ${SERIF}`
        ctx.fillText('Y', cx, cy + 1)
      } else {
        // college names run wider, so they're squeezed to fit the fold rather than shrunk
        const long = design.length > 5
        ctx.font = `800 ${Math.round(h * (long ? 0.56 : 0.6))}px ${SERIF}`
        ctx.fillText(design, cx, cy, long ? 210 : undefined)
      }
    }
  })
}

/** Light reflections streaking across shop glass (transparent background). */
export function glassReflectionTexture() {
  return canvasTexture('glass', 512, 512, (ctx) => {
    ctx.clearRect(0, 0, 512, 512)
    const sky = ctx.createLinearGradient(0, 0, 0, 512)
    sky.addColorStop(0, 'rgba(210, 230, 250, 0.35)')
    sky.addColorStop(0.55, 'rgba(210, 230, 250, 0.08)')
    sky.addColorStop(1, 'rgba(255, 255, 255, 0.02)')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, 512, 512)
    // diagonal highlight bands
    ctx.save()
    ctx.translate(256, 256)
    ctx.rotate(-0.6)
    for (const [x, w, a] of [
      [-180, 60, 0.28],
      [-100, 18, 0.22],
      [40, 90, 0.16],
      [160, 24, 0.24],
    ] as const) {
      const g = ctx.createLinearGradient(x, 0, x + w, 0)
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.5, `rgba(255,255,255,${a})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(x, -400, w, 800)
    }
    ctx.restore()
  })
}

/** What you glimpse through the shop windows: warm light, shelves of folded tees, racks. */
export function windowBackdropTexture() {
  return canvasTexture('backdrop', 512, 384, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 384)
    g.addColorStop(0, '#1d3157')
    g.addColorStop(0.7, '#2a3f66')
    g.addColorStop(1, '#3d2616')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 384)
    // warm pools of light from pendant lamps
    for (const x of [110, 300, 450]) {
      const glow = ctx.createRadialGradient(x, 40, 5, x, 40, 160)
      glow.addColorStop(0, 'rgba(255, 214, 150, 0.85)')
      glow.addColorStop(1, 'rgba(255, 214, 150, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, 512, 384)
    }
    // shelves of folded tees at the back
    const colors = ['#f2ede2', '#1f2f55', '#9aa3ad', '#e9dfc9']
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 9; col++) {
        ctx.fillStyle = colors[(row + col) % colors.length]
        ctx.fillRect(20 + col * 54, 150 + row * 44, 44, 30)
      }
      ctx.fillStyle = '#5a3b22'
      ctx.fillRect(14, 182 + row * 44, 488, 5)
    }
    // floor
    ctx.fillStyle = '#4a2c17'
    ctx.fillRect(0, 330, 512, 54)
  })
}

type GarmentKind = 'tee' | 'hoodie' | 'crew' | 'zip'

/** A garment on a hanger (transparent background), front view. */
export function garmentTexture(kind: GarmentKind, color: string, print: string, text = 'YALE') {
  return canvasTexture(`garment:${kind}:${color}:${print}:${text}`, 256, 320, (ctx) => {
    // hanger
    ctx.strokeStyle = '#3a3a3a'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(128, 6)
    ctx.quadraticCurveTo(142, 6, 142, 18)
    ctx.quadraticCurveTo(142, 30, 128, 34)
    ctx.lineTo(70, 56)
    ctx.moveTo(128, 34)
    ctx.lineTo(186, 56)
    ctx.stroke()

    const long = kind !== 'tee'
    ctx.beginPath()
    ctx.moveTo(92, 44)
    ctx.quadraticCurveTo(128, 64, 164, 44) // neckline
    ctx.lineTo(220, 70)
    ctx.lineTo(long ? 246 : 236, long ? 250 : 130)
    ctx.lineTo(long ? 212 : 200, long ? 256 : 146)
    ctx.lineTo(196, 112)
    ctx.lineTo(196, 304)
    ctx.lineTo(60, 304)
    ctx.lineTo(60, 112)
    ctx.lineTo(long ? 44 : 56, long ? 256 : 146)
    ctx.lineTo(long ? 10 : 20, long ? 250 : 130)
    ctx.lineTo(36, 70)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 2
    ctx.stroke()

    if (kind === 'hoodie') {
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.beginPath()
      ctx.ellipse(128, 50, 40, 18, 0, 0, Math.PI) // hood folded back
      ctx.fill()
      ctx.beginPath()
      ctx.roundRect(88, 220, 80, 46, 10) // kangaroo pocket
      ctx.fill()
    }
    if (kind === 'zip') {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(128, 56)
      ctx.lineTo(128, 120)
      ctx.stroke()
    }
    if (kind !== 'tee') {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.fillRect(60, 292, 136, 12) // ribbed hem
    }
    if (text) {
      ctx.fillStyle = print
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const small = kind === 'zip'
      ctx.font = `800 ${small ? 22 : 44}px ${SERIF}`
      ctx.fillText(text, small ? 160 : 128, small ? 100 : 150)
    }
  })
}

/** A dense boxwood hedge, like the green walls behind the YALE and Boola Boola signs. */
export function hedgeTexture() {
  return canvasTexture(
    'hedge',
    256,
    256,
    (ctx) => {
      ctx.fillStyle = '#2f5a2a'
      ctx.fillRect(0, 0, 256, 256)
      let seed = 7
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      for (let i = 0; i < 1400; i++) {
        const g = 70 + Math.floor(rand() * 90)
        ctx.fillStyle = `rgb(${Math.floor(g * 0.45)}, ${g}, ${Math.floor(g * 0.35)})`
        ctx.beginPath()
        ctx.ellipse(rand() * 256, rand() * 256, 3 + rand() * 4, 2 + rand() * 3, rand() * Math.PI, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    [2, 2],
  )
}

/** Black pegboard grid behind the cap wall. */
export function gridTexture() {
  return canvasTexture(
    'grid',
    128,
    128,
    (ctx) => {
      ctx.fillStyle = '#2b2b2b'
      ctx.fillRect(0, 0, 128, 128)
      ctx.strokeStyle = '#4a4a4a'
      ctx.lineWidth = 3
      for (let i = 0; i <= 128; i += 32) {
        ctx.beginPath()
        ctx.moveTo(i, 0)
        ctx.lineTo(i, 128)
        ctx.moveTo(0, i)
        ctx.lineTo(128, i)
        ctx.stroke()
      }
    },
    [6, 3],
  )
}

/** A woven rug with a Yale-blue border. */
export function rugTexture() {
  return canvasTexture('rug', 512, 320, (ctx) => {
    ctx.fillStyle = '#00356b'
    ctx.fillRect(0, 0, 512, 320)
    ctx.fillStyle = '#efe6d2'
    ctx.fillRect(18, 18, 476, 284)
    ctx.fillStyle = '#c9b48a'
    for (let x = 30; x < 482; x += 22) ctx.fillRect(x, 30, 10, 260)
    ctx.fillStyle = '#00356b'
    ctx.font = `800 120px ${SERIF}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.globalAlpha = 0.85
    ctx.fillText('Y', 256, 168)
  })
}

/** Poured-concrete sidewalk slabs with expansion joints. */
export function pavementTexture() {
  return canvasTexture(
    'pavement',
    512,
    512,
    (ctx) => {
      ctx.fillStyle = '#b9b6b0'
      ctx.fillRect(0, 0, 512, 512)
      let seed = 11
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      for (let i = 0; i < 9000; i++) {
        const v = 150 + Math.floor(rand() * 60)
        ctx.fillStyle = `rgba(${v}, ${v - 2}, ${v - 6}, 0.35)`
        ctx.fillRect(rand() * 512, rand() * 512, 2, 2)
      }
      // joints between slabs
      ctx.strokeStyle = 'rgba(70, 68, 64, 0.65)'
      ctx.lineWidth = 3
      for (const p of [0, 256, 512]) {
        ctx.beginPath()
        ctx.moveTo(p, 0)
        ctx.lineTo(p, 512)
        ctx.moveTo(0, p)
        ctx.lineTo(512, p)
        ctx.stroke()
      }
    },
    [6, 3],
  )
}
