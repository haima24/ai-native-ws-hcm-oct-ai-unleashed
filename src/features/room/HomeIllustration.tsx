const SPADE =
  'M32 12C32 12 18 24 18 34a8 8 0 0 0 14 5l-2 9h4l-2-9a8 8 0 0 0 14-5C46 24 32 12 32 12Z'

export default function HomeIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none fill-panel stroke-rule text-accent ${className ?? ''}`}
    >
      <rect x="14" y="20" width="44" height="62" rx="4" strokeWidth="2" transform="rotate(-14 36 51)" />
      <rect x="38" y="20" width="44" height="62" rx="4" strokeWidth="2" transform="rotate(14 60 51)" />
      <rect x="26" y="14" width="44" height="64" rx="4" strokeWidth="2" />
      <path d={SPADE} transform="translate(24 24) scale(0.75)" className="fill-current stroke-none" />
    </svg>
  )
}
