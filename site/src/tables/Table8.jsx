import { useEffect, useMemo, useState } from 'react'
import { loadEventStates } from '../data/eventStates.js'
import { SCORE_BUCKETS, computeMarkovScoringRows } from './markovScoring.js'

const onFirst = (b) => b & 1
const onSecond = (b) => b & 2
const onThird = (b) => b & 4

const pct = (value) => (value == null ? '—' : `${(value * 100).toFixed(1)}%`)

export default function Table8({ sel }) {
  const [stateData, setStateData] = useState(null)

  useEffect(() => {
    let live = true
    loadEventStates().then((d) => live && setStateData(d))
    return () => {
      live = false
    }
  }, [])

  const { rows, totalTransitions } = useMemo(() => {
    if (!stateData) return { rows: null, totalTransitions: 0 }
    return computeMarkovScoringRows(stateData, sel)
  }, [stateData, sel])

  return (
    <>
      <header className="table-head">
        <h1>Scoring Distribution, by Base/Out State</h1>
        <p className="subtitle">
          {sel.seasonLabel} &nbsp;&middot;&nbsp; {sel.teamLabel}
        </p>
        <p className="credit">
          Table&nbsp;8 from Tom Tango's <em>The Book</em>. Starting from each base/out state, this
          builds a Markov chain from observed Retrosheet state transitions and projects the
          probability of scoring 0, 1, 2, 3, 4, or 5+ runs before the inning ends.
        </p>
      </header>

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
            {totalTransitions.toLocaleString()} observed state transitions. <strong>RE</strong> is
            the Markov-chain expected runs from that state; the probability columns sum to 100%,
            with 5+ as the remaining tail. Everything recomputes for the seasons, league and teams
            you pick.
          </p>
        </>
      ) : (
        <div className="empty">Select at least one team to compute the table.</div>
      )}

      <details className="method">
        <summary>How this is calculated</summary>
        <p>
          For every eligible play, the data records the starting base/out state, the ending state,
          and runs scored on the play. Those counts become transition probabilities. The expected
          runs column solves the Markov chain directly, while the scoring distribution solves the
          exact 0-through-4 run buckets recursively. The 5+ column is whatever probability remains.
        </p>
        <p className="src">Source: {stateData ? stateData.meta.source : ''}.</p>
      </details>
    </>
  )
}
