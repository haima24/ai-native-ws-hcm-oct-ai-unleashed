import type { ReactNode } from 'react'
import type { ThemeId } from '../theme/themes'
import { useTheme } from '../theme/themeStore'

const SPADE =
  'M32 12C32 12 18 24 18 34a8 8 0 0 0 14 5l-2 9h4l-2-9a8 8 0 0 0 14-5C46 24 32 12 32 12Z'

const cards = (
  <>
    <rect x="14" y="20" width="44" height="62" rx="4" strokeWidth="2" transform="rotate(-14 36 51)" />
    <rect x="38" y="20" width="44" height="62" rx="4" strokeWidth="2" transform="rotate(14 60 51)" />
    <rect x="26" y="14" width="44" height="64" rx="4" strokeWidth="2" />
  </>
)

const frontCard = <rect x="26" y="14" width="44" height="64" rx="4" strokeWidth="2" />

const ART: Record<ThemeId, ReactNode> = {
  vintage: (
    <>
      {cards}
      <path d={SPADE} transform="translate(24 24) scale(0.75)" className="fill-current stroke-none" />
    </>
  ),
  light: (
    <>
      {frontCard}
      <circle cx="48" cy="38" r="9" className="fill-current stroke-none" />
      <path d="M36 58h24M40 66h16" className="stroke-current" strokeWidth="3" strokeLinecap="round" fill="none" />
    </>
  ),
  dark: (
    <>
      {frontCard}
      <path d="M56 30a14 14 0 1 0 6 24 11 11 0 0 1-6-24Z" className="fill-current stroke-none" />
      <path
        d="M36 26l1.5 3.5L41 31l-3.5 1.5L36 36l-1.5-3.5L31 31l3.5-1.5ZM60 56l1 2.5 2.5 1-2.5 1L60 63l-1-2.5-2.5-1 2.5-1Z"
        className="fill-current stroke-none"
      />
    </>
  ),
  ocean: (
    <>
      {frontCard}
      <path
        d="M30 44c4-5 8-5 12 0s8 5 12 0 6-4 10-1M30 56c4-5 8-5 12 0s8 5 12 0 6-4 10-1M30 68c4-5 8-5 12 0s8 5 12 0 6-4 10-1"
        className="stroke-current"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="48" cy="26" r="3.5" className="stroke-current" strokeWidth="2.5" fill="none" />
      <path d="M48 30v10M42 35h12M40 38c1 5 4 7 8 7s7-2 8-7" className="stroke-current" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </>
  ),
  sunny: (
    <>
      {frontCard}
      <circle cx="48" cy="46" r="12" className="fill-current stroke-none" />
      <path
        d="M48 24v6M48 62v6M30 46h6M60 46h6M35 33l4 4M57 55l4 4M35 59l4-4M57 37l4-4"
        className="stroke-current"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  forest: (
    <>
      {frontCard}
      <path d="M48 24 36 42h6L32 56h32L54 42h6L48 24ZM48 56v10" className="fill-current stroke-current" strokeWidth="2" strokeLinejoin="round" />
      <path d="M58 64c6-1 9-5 9-10-6 0-9 4-9 10Z" className="fill-current stroke-none" />
    </>
  ),
}

export default function HomeIllustration({ className }: { className?: string }) {
  const theme = useTheme()
  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none fill-panel stroke-rule text-accent ${className ?? ''}`}
    >
      {ART[theme]}
    </svg>
  )
}
