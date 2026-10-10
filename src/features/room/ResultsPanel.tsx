import type { RoundResults } from '../../types/room'
import ThemeIcon from '../theme/ThemeIcon'
import { useTheme } from '../theme/themeStore'

export default function ResultsPanel({ results }: { results: RoundResults }) {
  const theme = useTheme()
  const maxCount = Math.max(...results.groups.map((g) => g.count))
  return (
    <section aria-labelledby="results-heading" data-testid="results-panel" className="ornate mt-6 rounded border border-rule bg-panel p-3">
      <h3
        id="results-heading"
        tabIndex={-1}
        data-testid="results-heading"
        className="flex w-fit items-center gap-2 text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <ThemeIcon theme={theme} className="h-5 w-5 text-accent" />
        Results
      </h3>
      <ul data-testid="results-groups" className="mt-3 flex flex-col gap-2">
        {results.groups.map(({ card, count }) => (
          <li key={card} data-testid="results-group" className="flex items-center gap-3">
            <span className="w-8 shrink-0 text-center text-xl font-semibold">{card}</span>
            <span className="h-4 min-w-0 flex-1">
              <span
                aria-hidden="true"
                data-testid="results-group-bar"
                className="block h-full rounded-sm bg-accent"
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </span>
            <span data-testid="results-group-count" className="w-20 shrink-0 text-ink-muted">
              {count === 1 ? '1 vote' : `${count} votes`}
            </span>
          </li>
        ))}
      </ul>
      <p data-testid="results-participation" className="mt-2 text-ink-muted">
        {results.voted} of {results.participants} voted
      </p>
    </section>
  )
}
