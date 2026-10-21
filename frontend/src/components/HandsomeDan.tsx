import { useId } from 'react'
import portrait from '../assets/handsome-dan.webp'

/**
 * Handsome Dan in a Yale Blue cameo frame.
 *
 * The illustration (Dan in a Y varsity jacket in front of an ivy-covered Gothic tower)
 * was generated with Google Gemini for this project; see PORTRAIT_CREDIT.
 */
interface Props {
  size?: number
  caption?: boolean
  className?: string
}

export const PORTRAIT_CREDIT = 'Handsome Dan illustration created with Google Gemini'

// The illustration is 765 x 1024. Large cameos show the whole scene (tower, ivy, Dan);
// small avatars (chat button, footer) zoom in on his head.
const FULL = { x: 12, y: 4, width: 176, height: 236 }
const CLOSE = { x: -66, y: -92, width: 320, height: 428 }

export default function HandsomeDan({ size = 200, caption = true, className }: Props) {
  // Unique ids so several cameos on one page don't share clip/arc definitions.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const id = (name: string) => `hd-${name}-${uid}`
  const crop = caption ? FULL : CLOSE
  // With a caption, leave a Yale Blue band around the portrait for the lettering.
  const inner = caption ? { rx: 78, ry: 98 } : { rx: 90, ry: 110 }

  return (
    <svg
      className={className}
      viewBox="0 0 200 240"
      width={size}
      height={(size * 240) / 200}
      role="img"
      aria-label="Handsome Dan, the Yale bulldog"
    >
      <defs>
        <clipPath id={id('clip')}>
          <ellipse cx="100" cy="120" rx={inner.rx} ry={inner.ry} />
        </clipPath>
        <radialGradient id={id('vignette')} cx="50%" cy="45%" r="60%">
          <stop offset="75%" stopColor="#00356b" stopOpacity="0" />
          <stop offset="100%" stopColor="#00356b" stopOpacity="0.18" />
        </radialGradient>
        <path id={id('top')} d="M 18 120 A 82 102 0 0 1 182 120" />
        <path id={id('bottom')} d="M 10 120 A 90 110 0 0 0 190 120" />
      </defs>

      {/* Frame: white rim and Yale Blue band */}
      <ellipse cx="100" cy="120" rx="98" ry="118" fill="#fff" />
      <ellipse cx="100" cy="120" rx="93" ry="113" fill="#00356b" />

      {/* Portrait */}
      <g clipPath={`url(#${id('clip')})`}>
        <rect x="0" y="0" width="200" height="240" fill="#f3ede0" />
        <image href={portrait} preserveAspectRatio="xMidYMid slice" {...crop} />
        <ellipse cx="100" cy="120" rx={inner.rx} ry={inner.ry} fill={`url(#${id('vignette')})`} />
      </g>
      <ellipse
        cx="100"
        cy="120"
        rx={inner.rx}
        ry={inner.ry}
        fill="none"
        stroke="#fff"
        strokeOpacity="0.85"
        strokeWidth={caption ? 1.5 : 0}
      />

      {caption && (
        <g fontFamily="Georgia, 'Times New Roman', serif" fill="#fff" fontWeight="700">
          <text fontSize="10" letterSpacing="3">
            <textPath href={`#${id('top')}`} startOffset="50%" textAnchor="middle">
              HANDSOME DAN
            </textPath>
          </text>
          <text fontSize="8" letterSpacing="2.5" opacity="0.85">
            <textPath href={`#${id('bottom')}`} startOffset="50%" textAnchor="middle">
              YALE · SINCE 1889
            </textPath>
          </text>
        </g>
      )}
    </svg>
  )
}
