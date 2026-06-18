import { useEffect, useMemo, useState } from 'react'
import { BASE_ORDER, OUTS, computeREMatrix } from '../components/reMatrix.js'
import { matchesSelection } from '../components/selection.js'

const onFirst = (b) => b & 1
const onSecond = (b) => b & 2
const onThird = (b) => b & 4
const runnersOn = (b) => (b & 1 ? 1 : 0) + (b & 2 ? 1 : 0) + (b & 4 ? 1 : 0)

const signed = (v) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}`)

export default function Table6({ sel }) {
  const [stateData, setStateData] = useState(null)

  useEffect(() => {
    let live = true
    import('../data/event_states.json').then((m) => live && setStateData(m.default))
    return () => {
      live = false
    }
  }, [])

  const { rows, totalN } = useMemo(() => {
    if (!stateData) return { rows: null, totalN: 0 }
    const { matrix } = computeREMatrix(sel)

    // accumulate HR [count, sumRuns to end of inning] per starting base/out state
    const acc = {}
    for (const o of OUTS) for (const b of BASE_ORDER) acc[b * 10 + o] = { count: 0, sumRuns: 0 }
    for (const g of stateData.groups) {
      if (!matchesSelection(g, sel)) continue
      const e = g.events.HR
      if (!e) continue
      for (const sk in e.states) {
        const [c, r] = e.states[sk]
        if (!acc[sk]) acc[sk] = { count: 0, sumRuns: 0 }
        acc[sk].count += c
        acc[sk].sumRuns += r
      }
    }

    const rows = []
    let totalN = 0
    for (const b of BASE_ORDER) {
      for (const o of OUTS) {
        const k = b * 10 + o
        const { count, sumRuns } = acc[k]
        const startRE = matrix[k]?.re ?? null
        const emptyRE = matrix[o]?.re ?? null // bases empty, same outs — where a HR always leaves you
        const runsScored = runnersOn(b) + 1 // every runner plus the batter scores
        const endingRE = emptyRE != null ? emptyRE + runsScored : null
        const avgROI = count ? sumRuns / count : null
        // "Original": the empirical run value (Table 5) — avg runs to end of inning minus starting RE
        const original = avgROI != null && startRE != null ? avgROI - startRE : null
        // RE-transition run value: ending run value minus starting RE
        const runValue = endingRE != null && startRE != null ? endingRE - startRE : null
        totalN += count
        rows.push({ base: b, outs: o, count, runsScored, original, startRE, endingRE, runValue })
      }
    }
    return { rows, totalN }
  }, [stateData, sel])

  return (
    <>
      <header className="table-head">
        <h1>Run Value of the Home Run, by Base/Out State</h1>
        <p className="subtitle">
          {sel.seasonLabel} &nbsp;&middot;&nbsp; {sel.teamLabel}
        </p>
        <p className="credit">
          Table&nbsp;6 from Tom Tango's <em>The Book</em> &mdash; a second, cleaner way to value the
          home run. Instead of averaging the actual runs scored to the end of the inning (which is
          noisy in small samples), compare the run expectancy of the state the HR{' '}
          <strong>started</strong> in with the state it <strong>ended</strong> in, and add the runs
          that scored on the play.
        </p>
      </header>

      {rows == null ? (
        <div className="empty">Loading event data…</div>
      ) : totalN > 0 ? (
        <>
          <table className="ev t6">
            <thead>
              <tr>
                <th className="b">1B</th>
                <th className="b">2B</th>
                <th className="b">3B</th>
                <th className="num">Outs</th>
                <th className="num">HR</th>
                <th className="num">Original</th>
                <th className="num start">Starting RE</th>
                <th className="num start">Ending RE</th>
                <th className="num delta">Run Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.base * 10 + r.outs} className={r.outs === 2 ? 'group-end' : ''}>
                  <td className="b">{onFirst(r.base) ? '1B' : '––'}</td>
                  <td className="b">{onSecond(r.base) ? '2B' : '––'}</td>
                  <td className="b">{onThird(r.base) ? '3B' : '––'}</td>
                  <td className="num">{r.outs}</td>
                  <td className="num">{r.count.toLocaleString()}</td>
                  <td className={`num delta ${r.original == null ? '' : r.original >= 0 ? 'pos' : 'neg'}`}>
                    {signed(r.original)}
                  </td>
                  <td className="num start">{r.startRE != null ? r.startRE.toFixed(3) : '—'}</td>
                  <td className="num start" title={`bases-empty RE (${r.outs} out) + ${r.runsScored} run${r.runsScored === 1 ? '' : 's'} scored`}>
                    {r.endingRE != null ? r.endingRE.toFixed(3) : '—'}
                  </td>
                  <td className={`num delta ${r.runValue == null ? '' : r.runValue >= 0 ? 'pos' : 'neg'}`}>
                    {signed(r.runValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            {totalN.toLocaleString()} home runs. <strong>Run Value</strong> = Ending RE − Starting RE,
            where <strong>Ending RE</strong> is the run expectancy of the bases-empty state the HR
            leaves you in <em>plus</em> the runs that scored on the play. <strong>Original</strong> is
            the empirical run value from Table&nbsp;5 (average runs to the end of the inning minus
            Starting RE). The two should agree; where they diverge it's mostly small-sample noise in
            the empirical figure. Everything recomputes for the seasons, league and teams you pick.
          </p>
        </>
      ) : (
        <div className="empty">No home runs for this selection.</div>
      )}

      <details className="method">
        <summary>How this is calculated</summary>
        <p>
          Take bases empty, 0 outs as the example. The <strong>Starting RE</strong> is the run
          expectancy of that state. A home run scores 1 run and leaves you in the same state (bases
          empty, 0 outs), so the <strong>Ending RE</strong> is that same run expectancy{' '}
          <em>plus</em> the 1 run that scored. The HR's <strong>Run Value</strong> is the difference
          between the ending and starting values &mdash; here, exactly one run.
        </p>
        <p>
          Because a home run always clears the bases, its ending state and runs scored are fully
          determined by the starting state, so this method needs no play-by-play averaging &mdash;
          just the Table&nbsp;1 run-expectancy matrix. That's what makes it cleaner than the
          runs-to-end-of-inning approach for an event seen only a handful of times in a given state.
        </p>
        <p className="src">Source: {stateData ? stateData.meta.source : ''}.</p>
      </details>
    </>
  )
}
