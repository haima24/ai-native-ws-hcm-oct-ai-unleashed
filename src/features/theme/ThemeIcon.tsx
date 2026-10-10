import type { ThemeId } from './themes'

const PATHS: Record<ThemeId, string> = {
  vintage: 'M12 3C12 3 5 9 5 13.5a3.5 3.5 0 0 0 7 1.5l-1 5h2l-1-5a3.5 3.5 0 0 0 7-1.5C19 9 12 3 12 3Z',
  light: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z',
  dark: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  ocean: 'M2 9c2.5-3 5-3 7.5 0s5 3 7.5 0c1.2-1.4 2.7-2 4.5-2M2 16c2.5-3 5-3 7.5 0s5 3 7.5 0c1.2-1.4 2.7-2 4.5-2',
  sunny: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
  forest: 'M12 3 6 11h3l-4 6h14l-4-6h3L12 3ZM12 17v4',
}

export default function ThemeIcon({ theme, className }: { theme: ThemeId; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`pointer-events-none shrink-0 ${className ?? ''}`}
    >
      <path d={PATHS[theme]} />
    </svg>
  )
}
