import { useMemo } from 'react'
import { BASE_ORDER, OUTS, reMeta, computeREMatrix } from '../components/reMatrix.js'

const onFirst = (b) => b & 1
const onSecond = (b) => b & 2
const onThird = (b) => b & 4

function heat(v, min, max) {
  if (v == null) return 'transparent'
  const t = max > min ? (v - min) / (max - min) : 0.5
  return `hsl(140 55% ${96 - t * 52}%)`
}

export default function Table1({ sel }) {
  const { matrix, totalPA, lo, hi } = useMemo(() => computeREMatrix(sel), [sel])

  const overall = matrix[0]?.re

  return (
    <>
      <header className="table-head">
        <h1>Run Expectancy, By The 24 Base/Out States</h1>
        <p className="subtitle">
          {sel.seasonLabel} &nbsp;&middot;&nbsp; {sel.teamLabel}
        </p>
        <p className="credit">
          Table&nbsp;1 from Tom Tango's <em>The Book</em> &mdash; the expected runs scored from each
          base/out state to the end of the inning.
        </p>
      </header>

      {totalPA > 0 ? (
        <>
          <div className="headline">
            <div className="big">{overall != null ? overall.toFixed(3) : '—'}</div>
            <div className="big-label">
              overall run expectancy
              <span>bases empty, 0 outs &mdash; i.e. avg runs / inning</span>
            </div>
            <div className="sample">{totalPA.toLocaleString()} plate appearances</div>
          </div>

          <table className="re">
            <thead>
              <tr>
                <th className="b">1B</th>
                <th className="b">2B</th>
                <th className="b">3B</th>
                <th>0 Outs</th>
                <th>1 Out</th>
                <th>2 Outs</th>
              </tr>
            </thead>
            <tbody>
              {BASE_ORDER.map((b) => (
                <tr key={b}>
                  <td className="b">{onFirst(b) ? '1B' : '––'}</td>
                  <td className="b">{onSecond(b) ? '2B' : '––'}</td>
                  <td className="b">{onThird(b) ? '3B' : '––'}</td>
                  {OUTS.map((o) => {
                    const cell = matrix[b * 10 + o]
                    return (
                      <td
                        key={o}
                        className="val"
                        style={{ background: heat(cell.re, lo, hi) }}
                        title={cell.count ? `${cell.count.toLocaleString()} PA` : 'no data'}
                      >
                        {cell.re != null ? cell.re.toFixed(3) : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">Hover any cell to see its sample size.</p>
        </>
      ) : (
        <div className="empty">Select at least one team to compute run expectancy.</div>
      )}

      <details className="method">
        <summary>How this is calculated</summary>
        <p>{reMeta.method}.</p>
        <p>
          For every plate appearance we record the base/out state at its start and the runs the
          batting team went on to score before the inning ended. The run expectancy of a state is
          the average of those values over the selected seasons, leagues and teams. Only innings
          that ended with three outs are counted.
        </p>
        <p className="src">Source: {reMeta.source}.</p>
      </details>
    </>
  )
}
