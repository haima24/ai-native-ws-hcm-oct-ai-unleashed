import type { RoundResults } from '../../types/room'
import ThemeIcon from '../theme/ThemeIcon'
import { useTheme } from '../theme/themeStore'

export default function ResultsPanel({ results }: { results: RoundResults }) {
  const theme = useTheme()
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
      <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dt className="text-ink-muted">Average</dt>
          <dd data-testid="results-average" className="text-2xl font-semibold">
            {results.average}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Consensus</dt>
          <dd data-testid="results-consensus" className="text-2xl font-semibold">
            {results.consensus}
          </dd>
        </div>
      </dl>
      <p data-testid="results-participation" className="mt-2 text-ink-muted">
        {results.voted} of {results.participants} voted
      </p>
    </section>
  )
}
