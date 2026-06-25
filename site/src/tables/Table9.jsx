import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { loadEventStates } from '../data/eventStates.js'
import {
  BOOK_TABLE_9_RUNS_PER_GAME,
  SCORE_BUCKETS,
  computeAdjustedMarkovScoringRows,
} from './markovScoring.js'

const onFirst = (b) => b & 1
const onSecond = (b) => b & 2
const onThird = (b) => b & 4

const pct = (value) => (value == null ? '—' : `${(value * 100).toFixed(1)}%`)

function clampRuns(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return BOOK_TABLE_9_RUNS_PER_GAME
  return Math.max(2, Math.min(7, parsed))
}

export default function Table9({ sel }) {
  const [stateData, setStateData] = useState(null)
  const [runsPerGame, setRunsPerGame] = useState(BOOK_TABLE_9_RUNS_PER_GAME)
  const deferredRunsPerGame = useDeferredValue(runsPerGame)

  useEffect(() => {
    let live = true
    loadEventStates().then((d) => live && setStateData(d))
    return () => {
      live = false
    }
  }, [])

  const { rows, totalTransitions, actualRunsPerGame } = useMemo(() => {
    if (!stateData) return { rows: null, totalTransitions: 0, actualRunsPerGame: null }
    return computeAdjustedMarkovScoringRows(stateData, sel, deferredRunsPerGame)
  }, [stateData, sel, deferredRunsPerGame])

  return (
    <>
      <header className="table-head">
        <h1>Scoring Distribution, Tuned Run Environment</h1>
        <p className="subtitle">
          {sel.seasonLabel} &nbsp;&middot;&nbsp; {sel.teamLabel}
        </p>
        <p className="credit">
          Table&nbsp;9 from Tom Tango's <em>The Book</em>. It starts with the observed Markov
          transitions, then shifts the run environment to a target runs/game level. The book's
          example uses 3.2 runs/game.
        </p>
      </header>

      <div className="env-control">
        <label>
          <span>Runs/Game</span>
          <input
            type="range"
            min="2"
            max="7"
            step="0.1"
            value={runsPerGame}
            onChange={(e) => setRunsPerGame(clampRuns(e.target.value))}
          />
        </label>
        <input
          className="env-number"
          type="number"
          min="2"
          max="7"
          step="0.1"
          value={runsPerGame}
          onChange={(e) => setRunsPerGame(clampRuns(e.target.value))}
        />
        <button type="button" onClick={() => setRunsPerGame(BOOK_TABLE_9_RUNS_PER_GAME)}>
          3.2
        </button>
        <button type="button" onClick={() => setRunsPerGame(5)}>
          5.0
        </button>
      </div>

      {rows == null ? (
        <div className="empty">Loading event data…</div>
      ) : totalTransitions > 0 ? (
        <>
          <table className="ev t8">
            <thead>
              <tr>
                <th className="b">1B</th>
                <th className="b">2B</th>
                <th className="b">3B</th>
                <th className="num">Outs</th>
                <th className="num">RE</th>
                {SCORE_BUCKETS.map((bucket) => (
                  <th key={bucket} className="num">
                    {bucket === 5 ? '5+' : bucket}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.base * 10 + r.outs} className={r.outs === 2 ? 'group-end' : ''}>
                  <td className="b">{onFirst(r.base) ? '1B' : '––'}</td>
                  <td className="b">{onSecond(r.base) ? '2B' : '––'}</td>
                  <td className="b">{onThird(r.base) ? '3B' : '––'}</td>
                  <td className="num">{r.outs}</td>
                  <td className="num start">{r.re == null ? '—' : r.re.toFixed(3)}</td>
                  {r.probs.map((prob, i) => (
                    <td key={SCORE_BUCKETS[i]} className="num prob">
                      {pct(prob)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            Target: {deferredRunsPerGame.toFixed(1)} runs/game
            {actualRunsPerGame == null ? '' : `; solved: ${actualRunsPerGame.toFixed(2)}`}.{' '}
            {totalTransitions.toLocaleString()} observed state transitions provide the shape of the
            Markov chain; the run environment adjustment shifts the transition probabilities.
          </p>
        </>
      ) : (
        <div className="empty">Select at least one team to compute the table.</div>
      )}

      <details className="method">
        <summary>How this is calculated</summary>
        <p>
          The site aggregates the same start-to-end state transitions as Table&nbsp;8. To hit a
          chosen run environment, it downweights or upweights transitions that preserve the out count
          until the empty-bases, zero-out Markov expectancy equals target runs/game divided by nine.
          The final table then resolves the full 0, 1, 2, 3, 4, and 5+ run distribution from those
          adjusted probabilities.
        </p>
        <p className="src">Source: {stateData ? stateData.meta.source : ''}.</p>
      </details>
    </>
  )
}
