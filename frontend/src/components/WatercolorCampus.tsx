/**
 * A watercolor-style painting of the Yale skyline (Harkness Tower, Gothic halls, the Sterling
 * nave, elms on the lawn), drawn as inline SVG. Turbulence filters roughen the edges so washes
 * bleed like pigment on wet paper, and a fine noise layer adds paper grain.
 */
import { useId } from 'react'

const STONE = '#c7a77c'
const STONE_SHADE = '#a8865e'
const INK = '#2b3f5c'

/** A crenellated Gothic hall: body, battlements, and pointed windows. */
function Hall({ x, w, h, base = 760 }: { x: number; w: number; h: number; base?: number }) {
  const top = base - h
  const merlons = Array.from({ length: Math.floor(w / 26) }, (_, i) => x + 6 + i * 26)
  const windows = Array.from({ length: Math.floor((w - 30) / 42) }, (_, i) => x + 24 + i * 42)
  return (
    <g>
      <rect x={x} y={top} width={w} height={h} fill={STONE} opacity={0.75} />
      {merlons.map((mx) => (
        <rect key={mx} x={mx} y={top - 14} width={14} height={14} fill={STONE} opacity={0.75} />
      ))}
      <rect x={x + w * 0.62} y={top} width={w * 0.38} height={h} fill={STONE_SHADE} opacity={0.35} />
      {windows.flatMap((wx) =>
        [top + 30, top + 30 + 62].filter((wy) => wy + 40 < base).map((wy) => (
          <path
            key={`${wx}:${wy}`}
            d={`M${wx} ${wy + 36} V${wy + 10} Q${wx + 8} ${wy - 4} ${wx + 16} ${wy + 10} V${wy + 36} Z`}
            fill="#5f6f86"
            opacity={0.45}
          />
        )),
      )}
    </g>
  )
}

function Tree({ x, r, base = 790, tint = '#7fa35c' }: { x: number; r: number; base?: number; tint?: string }) {
  return (
    <g>
      <rect x={x - 4} y={base - r * 0.9} width={8} height={r * 0.9} fill="#6b5137" opacity={0.6} />
      <circle cx={x} cy={base - r * 1.2} r={r} fill={tint} opacity={0.55} />
      <circle cx={x - r * 0.45} cy={base - r * 0.95} r={r * 0.7} fill={tint} opacity={0.45} />
      <circle cx={x + r * 0.5} cy={base - r * 1.0} r={r * 0.65} fill="#5d8a49" opacity={0.4} />
    </g>
  )
}

/**
 * `banner` crops to a strip through the rooftops for short, wide spaces like the site header.
 */
export default function WatercolorCampus({ className, banner = false }: { className?: string; banner?: boolean }) {
  // unique filter ids, so the header and the splash can both be on the page
  const uid = useId().replace(/:/g, '')
  const id = (name: string) => `${name}-${uid}`
  const url = (name: string) => `url(#${id(name)})`
  return (
    <svg
      className={className}
      viewBox={banner ? '0 330 1600 330' : '0 0 1600 900'}
      preserveAspectRatio={banner ? 'xMidYMid slice' : 'xMidYMax slice'}
      aria-hidden="true"
    >
      <defs>
        {/* bleeding wash edges */}
        <filter id={id('wc-bleed')} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" result="bled" />
          <feGaussianBlur in="bled" stdDeviation="1.2" />
        </filter>
        {/* soft, cloudy sky washes */}
        <filter id={id('wc-cloud')} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="2" seed="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="60" />
          <feGaussianBlur stdDeviation="18" />
        </filter>
        {/* wobbly ink linework */}
        <filter id={id('wc-ink')}>
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="11" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" />
        </filter>
        {/* paper grain */}
        <filter id={id('wc-paper')}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.28  0 0 0 0.09 0" />
        </filter>
        <linearGradient id={id('wc-paper-tone')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf7ef" />
          <stop offset="1" stopColor="#f3ead9" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill={url('wc-paper-tone')} />

      {/* sky: loose blue and peach washes */}
      <g filter={url('wc-cloud')}>
        <ellipse cx="300" cy="170" rx="420" ry="150" fill="#9fc2e6" opacity="0.55" />
        <ellipse cx="1250" cy="130" rx="480" ry="160" fill="#a9c9ea" opacity="0.5" />
        <ellipse cx="820" cy="300" rx="520" ry="120" fill="#f4cfa6" opacity="0.45" />
        <ellipse cx="1450" cy="380" rx="260" ry="90" fill="#f2c4a3" opacity="0.35" />
      </g>

      {/* distant towers, pale and cool */}
      <g filter={url('wc-bleed')} opacity="0.5">
        <rect x="1080" y="470" width="60" height="290" fill="#9aa9bf" />
        <path d="M1080 470 L1110 410 L1140 470 Z" fill="#9aa9bf" />
        <rect x="250" y="520" width="70" height="240" fill="#9aa9bf" />
        <rect x="1390" y="540" width="90" height="220" fill="#9aa9bf" />
      </g>

      {/* the Gothic halls, Harkness Tower, and the Sterling nave */}
      <g filter={url('wc-bleed')}>
        <Hall x={40} w={360} h={210} />
        <Hall x={1170} w={420} h={230} />
        <g>
          {/* Sterling nave with its gable and stack tower */}
          <rect x={860} y={560} width={300} height={200} fill={STONE} opacity={0.7} />
          <path d="M860 560 L1010 470 L1160 560 Z" fill={STONE_SHADE} opacity={0.6} />
          <rect x={960} y={380} width={100} height={180} fill={STONE} opacity={0.7} />
          <path d="M985 760 V680 Q1010 640 1035 680 V760 Z" fill="#6b5a46" opacity={0.6} />
        </g>
        <g>
          {/* Harkness Tower */}
          <rect x={560} y={330} width={140} height={430} fill={STONE} opacity={0.8} />
          <rect x={580} y={220} width={100} height={115} fill={STONE} opacity={0.8} />
          <rect x={598} y={150} width={64} height={75} fill={STONE} opacity={0.8} />
          <path d="M604 150 L630 70 L656 150 Z" fill={STONE_SHADE} opacity={0.8} />
          {[560, 680, 580, 662].map((px, i) => (
            <path
              key={i}
              d={`M${px} ${i < 2 ? 330 : 220} l10 -60 l10 60 Z`}
              fill={STONE_SHADE}
              opacity={0.75}
            />
          ))}
          <rect x={630} y={330} width={70} height={430} fill={STONE_SHADE} opacity={0.35} />
          {[400, 520, 640].map((y) => (
            <path key={y} d={`M618 ${y + 70} V${y + 18} Q630 ${y} 642 ${y + 18} V${y + 70} Z`} fill="#5f6f86" opacity={0.5} />
          ))}
          <circle cx={630} cy={265} r={22} fill="#f3ead9" opacity={0.7} />
        </g>
        <Hall x={400} w={160} h={160} />
        <Hall x={700} w={160} h={170} />
      </g>

      {/* loose ink outlines over the washes */}
      <g filter={url('wc-ink')} fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" opacity="0.45">
        <path d="M560 760 V330 H580 V220 H598 V150 H604 L630 70 L656 150 H662 V220 H680 V330 H700 V760" />
        <path d="M40 760 V550 H400 V760 M1170 760 V530 H1590" />
        <path d="M860 760 V560 L1010 470 L1160 560 V760 M960 560 V380 H1060 V560" />
      </g>

      {/* elms and the lawn */}
      <g filter={url('wc-bleed')}>
        <path d="M0 770 Q400 740 800 765 T1600 760 V960 H-40 Z" fill="#9dbb78" opacity="0.6" />
        <path d="M0 820 Q500 795 900 815 T1600 810 V960 H-40 Z" fill="#7fa35c" opacity="0.45" />
        <Tree x={110} r={70} />
        <Tree x={470} r={55} tint="#8db06a" />
        <Tree x={790} r={60} />
        <Tree x={1200} r={75} tint="#8db06a" />
        <Tree x={1520} r={65} />
      </g>

      <rect width="1600" height="900" filter={url('wc-paper')} />
    </svg>
  )
}
