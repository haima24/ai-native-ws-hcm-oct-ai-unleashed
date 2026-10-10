import { useState } from 'react'
import { setTheme, useTheme } from './themeStore'
import ThemeIcon from './ThemeIcon'
import { THEMES, themeLabel, type ThemeId } from './themes'

export default function ThemePicker({ className }: { className?: string }) {
  const theme = useTheme()
  const [announced, setAnnounced] = useState<ThemeId | null>(null)

  const choose = (id: ThemeId) => {
    setTheme(id)
    setAnnounced(id)
  }

  return (
    <fieldset data-testid="theme-picker" className={className}>
      <legend className="text-sm text-ink-muted">Theme</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {THEMES.map(({ id, label }) => (
          <label
            key={id}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded border-2 border-rule bg-panel px-3 text-ink has-checked:bg-accent has-checked:font-semibold has-checked:text-paper has-checked:ring-2 has-checked:ring-inset has-checked:ring-paper has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
          >
            <input
              type="radio"
              name="theme"
              value={id}
              checked={theme === id}
              onChange={() => choose(id)}
              className="sr-only"
            />
            <ThemeIcon theme={id} className="h-5 w-5" />
            {label}
          </label>
        ))}
      </div>
      <p role="status" data-testid="theme-status" className="mt-1 min-h-5 text-sm text-ink-muted">
        {announced ? `Theme set to ${themeLabel(announced)}.` : ''}
      </p>
    </fieldset>
  )
}
