import type { RoundResults } from '../../types/room'

export default function ResultsPanel({ results }: { results: RoundResults }) {
  return (
    <section aria-labelledby="results-heading" data-testid="results-panel" className="mt-6 rounded bg-[#F1F3F4] p-3">
      <h3
        id="results-heading"
        tabIndex={-1}
        data-testid="results-heading"
        className="text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005FCC]"
      >
        Results
      </h3>
      <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dt className="text-[#546E7A]">Average</dt>
          <dd data-testid="results-average" className="text-2xl font-semibold">
            {results.average}
          </dd>
        </div>
        <div>
          <dt className="text-[#546E7A]">Consensus</dt>
          <dd data-testid="results-consensus" className="text-2xl font-semibold">
            {results.consensus}
          </dd>
        </div>
      </dl>
      <p data-testid="results-participation" className="mt-2 text-[#546E7A]">
        {results.voted} of {results.participants} voted
      </p>
    </section>
  )
}
