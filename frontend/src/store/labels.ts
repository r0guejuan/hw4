import * as THREE from 'three'

/** A TextureLoader whose textures are tagged sRGB (photos), so components never mutate them. */
export class SrgbTextureLoader extends THREE.TextureLoader {
  load(...[url, onLoad, onProgress, onError]: Parameters<THREE.TextureLoader['load']>) {
    return super.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        onLoad?.(texture)
      },
      onProgress,
      onError,
    )
  }
}

/**
 * Text drawn onto a canvas and used as a texture, so the store needs no web fonts or
 * extra libraries. Returns the texture plus the aspect ratio for sizing the plane.
 */
export function makeLabel(
  lines: { text: string; size: number; weight?: number; color?: string; font?: 'serif' | 'sans' }[],
  opts: { background?: string; padding?: number; width?: number; radius?: number } = {},
): { texture: THREE.CanvasTexture; aspect: number } {
  const scale = 2 // draw at 2x for crisp text
  const padding = (opts.padding ?? 24) * scale
  const width = (opts.width ?? 640) * scale
  const lineGap = 10 * scale
  const height = padding * 2 + lines.reduce((h, l) => h + l.size * scale + lineGap, -lineGap)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.ceil(height)
  const ctx = canvas.getContext('2d')!
  if (opts.background) {
    ctx.fillStyle = opts.background
    const r = (opts.radius ?? 18) * scale
    ctx.beginPath()
    ctx.roundRect(0, 0, width, canvas.height, r)
    ctx.fill()
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  let y = padding
  for (const line of lines) {
    const family = line.font === 'serif' ? "'Playfair Display', Georgia, serif" : "Inter, system-ui, sans-serif"
    ctx.font = `${line.weight ?? 600} ${line.size * scale}px ${family}`
    ctx.fillStyle = line.color ?? '#0f1d33'
    ctx.fillText(line.text, width / 2, y, width - padding * 2)
    y += line.size * scale + lineGap
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { texture, aspect: width / canvas.height }
}

/** A simple wood-plank floor texture, drawn procedurally. */
export function woodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const plank = 64
  for (let i = 0; i < 512 / plank; i++) {
    // deep walnut planks
    const shade = 70 + ((i * 37) % 22)
    ctx.fillStyle = `rgb(${shade + 38}, ${shade + 2}, ${Math.max(shade - 38, 10)})`
    ctx.fillRect(0, i * plank, 512, plank)
    ctx.fillStyle = 'rgba(30, 15, 5, 0.5)'
    ctx.fillRect(0, i * plank, 512, 2)
    for (let g = 0; g < 14; g++) {
      ctx.strokeStyle = `rgba(150, 95, 50, ${0.1 + ((g * 13) % 10) / 100})`
      ctx.beginPath()
      const gy = i * plank + 6 + ((g * 23) % (plank - 10))
      ctx.moveTo(0, gy)
      ctx.bezierCurveTo(170, gy + 3, 340, gy - 3, 512, gy + 1)
      ctx.stroke()
    }
    const seam = (i * 157) % 512
    ctx.fillStyle = 'rgba(25, 12, 4, 0.55)'
    ctx.fillRect(seam, i * plank, 2, plank)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 7)
  return texture
}

/** Red-brick texture for the accent walls (the real store has exposed brick). */
/** tone 'tan' is the buff brick of the older buildings along Broadway. */
export function brickTexture(tone: 'red' | 'tan' = 'red'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#d9cfc4'
  ctx.fillRect(0, 0, 512, 256)
  const bw = 64
  const bh = 32
  for (let row = 0; row < 256 / bh; row++) {
    const offset = row % 2 ? bw / 2 : 0
    for (let col = -1; col < 512 / bw + 1; col++) {
      const r = 150 + ((row * 31 + col * 17) % 40)
      ctx.fillStyle =
        tone === 'tan'
          ? `rgb(${r + 30}, ${Math.round(r * 0.78)}, ${Math.round(r * 0.55)})`
          : `rgb(${r}, ${Math.round(r * 0.45)}, ${Math.round(r * 0.35)})`
      ctx.fillRect(col * bw + offset + 2, row * bh + 2, bw - 4, bh - 4)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  return texture
}
