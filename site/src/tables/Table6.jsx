import { useEffect, useMemo, useState } from 'react'
import { BASE_ORDER, OUTS, computeREMatrix } from '../components/reMatrix.js'
import {
  computeTransitionStateRows,
  eventChoices,
  signed,
} from './eventTransitions.js'

const onFirst = (b) => b & 1
const onSecond = (b) => b & 2
const onThird = (b) => b & 4
export default function Table6({ sel }) {
  const [stateData, setStateData] = useState(null)
  const [event, setEvent] = useState('HR')

  useEffect(() => {
    let live = true
    import('../data/event_states.json').then((m) => live && setStateData(m.default))
    return () => {
      live = false
    }
  }, [])

  const labels = useMemo(
    () => (stateData ? Object.fromEntries(stateData.meta.categories) : {}),
    [stateData],
  )

  const choices = useMemo(() => (stateData ? eventChoices(stateData) : []), [stateData])

  const { rows, totalN } = useMemo(() => {
    if (!stateData) return { rows: null, totalN: 0 }
    const { matrix } = computeREMatrix(sel)
    return computeTransitionStateRows(stateData, sel, matrix, event, BASE_ORDER, OUTS)
  }, [stateData, sel, event])

  const label = labels[event] || event

  return (
    <>
      <header className="table-head">
        <h1>Transition Run Value, by Base/Out State</h1>
        <p className="subtitle">
          {sel.seasonLabel} &nbsp;&middot;&nbsp; {sel.teamLabel}
        </p>
        <p className="credit">
          Table&nbsp;6 from Tom Tango's <em>The Book</em>, generalized. Pick an event and compare the
          run expectancy of the state it <strong>started</strong> in with the state it{' '}
          <strong>ended</strong> in, adding the runs that scored on the play.
        </p>
      </header>

      <label className="toggle">
        Event:&nbsp;
        <select value={event} onChange={(e) => setEvent(e.target.value)}>
          {choices.map((c) => (
            <option key={c} value={c}>
              {labels[c] || c}
            </option>
          ))}
        </select>
      </label>

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
                <th className="num">N</th>
                <th className="num">Original</th>
                <th className="num start">Starting RE</th>
                <th className="num start">Ending Value</th>
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
                  <td className="num start">
                    {r.ending != null ? r.ending.toFixed(3) : '—'}
                  </td>
                  <td className={`num delta ${r.runValue == null ? '' : r.runValue >= 0 ? 'pos' : 'neg'}`}>
                    {signed(r.runValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            {totalN.toLocaleString()} {label} events. <strong>Run Value</strong> = Ending Value −
            Starting RE, where <strong>Ending Value</strong> is runs scored on the play plus the run
            expectancy of the post-play base/out state. <strong>Original</strong> is the empirical
            Table&nbsp;5 run value. Everything recomputes for the seasons, league and teams you pick.
          </p>
        </>
      ) : (
        <div className="empty">No {label} events for this selection.</div>
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
          For other events, the site weights every observed start-to-end transition for the selected
          event. Third-out transitions have no remaining run expectancy, so their ending value is
          just the runs scored on the play.
        </p>
        <p className="src">Source: {stateData ? stateData.meta.source : ''}.</p>
      </details>
    </>
  )
}
