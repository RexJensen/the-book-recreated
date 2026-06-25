import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadEventStates } from '../data/eventStates.js'
import { BASE_ORDER, OUTS } from '../components/reMatrix.js'
import {
  SCORE_DIFFS,
  computeWinExpectancyModel,
  isImpossibleBookState,
  scoreDiffLabel,
} from './winExpectancy.js'
import './weConsole.css'

const ORDER = [0, 1, 2, 4, 3, 5, 6, 7]
const LABELS = { 0: 'Empty', 1: '1st', 2: '2nd', 4: '3rd', 3: '1st & 2nd', 5: '1st & 3rd', 6: '2nd & 3rd', 7: 'Loaded' }
const PRESETS = [
  [0, 'Bases empty'], [1, 'Runner on 1st'], [2, 'RISP (2nd)'],
  [5, 'Corners'], [6, '2nd & 3rd'], [7, 'Loaded'],
]
const BASES = [
  { bit: 1, x: 286, y: 216, lbl: 'first base' },
  { bit: 2, x: 190, y: 120, lbl: 'second base' },
  { bit: 4, x: 94, y: 216, lbl: 'third base' },
]

const on = (mask, b) => (mask & b) !== 0
const clamp01 = (v) => Math.max(0, Math.min(1, v))
const stateKey = (mask, outs) => mask * 10 + outs
const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const signedPts = (v) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)} pts`)

function ordinal(n) {
  return `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
}

function desc(mask, outs) {
  const runners = []
  if (on(mask, 1)) runners.push('1st')
  if (on(mask, 2)) runners.push('2nd')
  if (on(mask, 4)) runners.push('3rd')
  const bases = mask === 0 ? 'Bases empty' : mask === 7 ? 'Bases loaded' : `Runners on ${runners.join(' & ')}`
  return `${bases} · ${outs} out${outs === 1 ? '' : 's'}`
}

function shortState(mask) {
  if (mask === 0) return 'empty'
  if (mask === 7) return 'loaded'
  const runners = []
  if (on(mask, 1)) runners.push('1st')
  if (on(mask, 2)) runners.push('2nd')
  if (on(mask, 4)) runners.push('3rd')
  return runners.join(' & ')
}

function heat(v) {
  if (v == null) return '#eee7d9'
  if (v >= 0.5) {
    const t = (v - 0.5) / 0.5
    return `hsl(${132 - t * 18} ${32 + t * 30}% ${92 - t * 47}%)`
  }
  const t = (0.5 - v) / 0.5
  return `hsl(${26 - t * 12} ${36 + t * 28}% ${93 - t * 43}%)`
}

function heatText(v) {
  if (v == null) return '#70695d'
  return v > 0.74 || v < 0.2 ? '#f8f3e7' : '#17221c'
}

function advanceWalk(mask) {
  if (!on(mask, 1)) return { mask: mask | 1, runs: 0 }
  if (!on(mask, 2)) return { mask: mask | 2, runs: 0 }
  if (!on(mask, 4)) return { mask: mask | 4, runs: 0 }
  return { mask: 7, runs: 1 }
}

function Field({ mask, setMask }) {
  const bg = (() => {
    let s = '<rect x="0" y="0" width="380" height="360" fill="var(--grass)"/>'
    const hx = 190, hy = 312, R = 400, n = 8
    const a0 = (-135 * Math.PI) / 180, a1 = (-45 * Math.PI) / 180
    for (let i = 0; i < n; i += 1) {
      const s0 = a0 + ((a1 - a0) * i) / n, s1 = a0 + ((a1 - a0) * (i + 1)) / n
      const x0 = hx + R * Math.cos(s0), y0 = hy + R * Math.sin(s0)
      const x1 = hx + R * Math.cos(s1), y1 = hy + R * Math.sin(s1)
      s += `<polygon points="${hx},${hy} ${x0.toFixed(1)},${y0.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}" fill="${i % 2 ? 'var(--grass2)' : 'var(--grass)'}" opacity="${i % 2 ? '.9' : '1'}"/>`
    }
    s += '<polygon points="320,216 190,86 60,216 190,346" fill="var(--clay)"/>'
    s += '<polygon points="262,216 190,144 118,216 190,288" fill="var(--grass2)"/>'
    s += '<line x1="190" y1="312" x2="355" y2="147" stroke="#f3efe4" stroke-width="2.4" opacity=".85"/>'
    s += '<line x1="190" y1="312" x2="25" y2="147" stroke="#f3efe4" stroke-width="2.4" opacity=".85"/>'
    s += '<circle cx="190" cy="216" r="15" fill="var(--clay)"/><rect x="186" y="212" width="8" height="3" rx="1" fill="#e9e0cf"/>'
    s += '<polygon points="190,322 180,314 180,305 200,305 200,314" fill="#f7f3e8" stroke="var(--clay-dark)" stroke-width="1.4"/>'
    return s
  })()

  return (
    <svg className="wec-field" viewBox="0 0 380 360" role="group" aria-label="Interactive baseball field. Tap a base to toggle a runner.">
      <g dangerouslySetInnerHTML={{ __html: bg }} />
      {BASES.map((b) => (
        <g
          key={b.bit}
          className={`base ${on(mask, b.bit) ? 'on' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={`Toggle runner on ${b.lbl}`}
          onClick={() => setMask((m) => m ^ b.bit)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setMask((m) => m ^ b.bit)
            }
          }}
        >
          <rect x={b.x - 13} y={b.y - 13} width="26" height="26" fill="transparent" />
          <rect className="bag" x={b.x - 11} y={b.y - 11} width="22" height="22" rx="3" transform={`rotate(45 ${b.x} ${b.y})`} />
          <circle className="runner" cx={b.x} cy={b.y} r="5.5" />
        </g>
      ))}
    </svg>
  )
}

export default function WEConsole({ sel }) {
  const [stateData, setStateData] = useState(null)
  const [mask, setMask] = useState(0)
  const [outs, setOuts] = useState(0)
  const [inning, setInning] = useState(9)
  const [half, setHalf] = useState('bottom')
  const [diff, setDiff] = useState(0)

  useEffect(() => {
    let live = true
    loadEventStates().then((d) => live && setStateData(d))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (/input|textarea/i.test(e.target.tagName)) return
      if (e.key === '1') setMask((m) => m ^ 1)
      else if (e.key === '2') setMask((m) => m ^ 2)
      else if (e.key === '3') setMask((m) => m ^ 4)
      else if (e.key === 'ArrowLeft') setOuts((o) => Math.max(0, o - 1))
      else if (e.key === 'ArrowRight') setOuts((o) => Math.min(2, o + 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const model = useMemo(() => (stateData ? computeWinExpectancyModel(stateData, sel) : null), [stateData, sel])

  const homeWE = (inningArg, halfArg, diffArg, maskArg, outsArg) => {
    if (!model || isImpossibleBookState(inningArg, halfArg, diffArg)) return null
    return model.winProbability({ inning: inningArg, half: halfArg, diff: diffArg, base: maskArg, outs: outsArg })
  }

  const current = homeWE(inning, half, diff, mask, outs)
  const stateLine = `${ordinal(inning)}, ${half} · ${scoreDiffLabel(diff)} · ${desc(mask, outs)}`

  const afterOutcome = ({ runs = 0, nextMask = mask, nextOuts = outs }) => {
    if (!model || current == null) return null
    const nextDiff = half === 'top' ? diff - runs : diff + runs
    if (half === 'bottom' && inning >= 9 && nextDiff > 0) return 1
    if (nextOuts < 3) return homeWE(inning, half, nextDiff, nextMask, nextOuts)
    if (half === 'top') {
      if (inning >= 9 && nextDiff > 0) return 1
      return homeWE(inning, 'bottom', nextDiff, 0, 0)
    }
    if (inning >= 9) return nextDiff > 0 ? 1 : nextDiff < 0 ? 0 : 0.5
    return homeWE(inning + 1, 'top', nextDiff, 0, 0)
  }

  const walk = advanceWalk(mask)
  const walkWE = afterOutcome({ runs: walk.runs, nextMask: walk.mask, nextOuts: outs })
  const outWE = afterOutcome({ nextMask: mask, nextOuts: outs + 1 })
  const runWE = afterOutcome({ runs: 1, nextMask: mask, nextOuts: outs })
  const runLabel = half === 'top' ? 'Away +1' : 'Home +1'

  const scoreStrip = SCORE_DIFFS.map((scoreDiff) => ({
    diff: scoreDiff,
    we: homeWE(inning, half, scoreDiff, mask, outs),
  }))

  const matrixValues = ORDER.flatMap((mk) =>
    OUTS.map((o) => ({
      mask: mk,
      outs: o,
      value: homeWE(inning, half, diff, mk, o),
    })),
  )
  const validValues = matrixValues.map((r) => r.value).filter((v) => v != null)
  const low = validValues.length ? Math.min(...validValues) : null
  const high = validValues.length ? Math.max(...validValues) : null
  const markPct = current == null || low == null || high == null || high <= low ? 50 : ((current - low) / (high - low)) * 100

  return (
    <div className="wec">
      <div className="wrap">
        <Link to="/table-10" className="back-link">← Back to Table 10</Link>
        <p className="eyebrow">Win expectancy · live from Retrosheet · {sel.seasonLabel} · {sel.teamLabel}</p>
        <h1>
          Every game state,<br />as a <em>win-probability console</em>.
        </h1>
        <p className="dek">
          Table&nbsp;10 has thousands of cells. This is the same model with the knobs exposed:
          set the inning, score, runners and outs, then read the home team's chance to win and the
          leverage of the next play.
        </p>

        {!model || model.totalTransitions === 0 ? (
          <div className="empty-state" style={{ marginTop: 28 }}>
            Select at least one team in the sidebar to compute win expectancy.
          </div>
        ) : (
          <>
            <div className="console">
              <div className="card field-card">
                <Field mask={mask} setMask={setMask} />
                <div className="field-foot">
                  <div className="control-row">
                    <span className="lbl">Outs</span>
                    <div className="seg" role="group" aria-label="Outs">
                      {[0, 1, 2].map((n) => (
                        <button key={n} className={n === outs ? 'active' : ''} onClick={() => setOuts(n)}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <span className="dots" aria-hidden="true">
                      <i className={outs >= 1 ? 'fill' : ''} />
                      <i className={outs >= 2 ? 'fill' : ''} />
                    </span>
                  </div>
                  <div className="presets">
                    {PRESETS.map(([mk, label]) => (
                      <button key={mk} className={`chip ${mk === mask ? 'sel' : ''}`} onClick={() => setMask(mk)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="field-game-controls">
                    <div className="control-block">
                      <span className="lbl">Inning</span>
                      <div className="seg wrap-seg">
                        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                          <button key={n} className={inning === n ? 'active' : ''} onClick={() => setInning(n)}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="control-block">
                      <span className="lbl">Half</span>
                      <div className="seg">
                        {['top', 'bottom'].map((h) => (
                          <button key={h} className={half === h ? 'active' : ''} onClick={() => setHalf(h)}>
                            {h === 'top' ? 'Top' : 'Bottom'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="control-block score">
                      <span className="lbl">Home score</span>
                      <div className="seg wrap-seg">
                        {SCORE_DIFFS.map((scoreDiff) => (
                          <button key={scoreDiff} className={diff === scoreDiff ? 'active' : ''} onClick={() => setDiff(scoreDiff)}>
                            {scoreDiff === 0 ? 'Tie' : scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="hint">
                    Tap a base to set a runner. <kbd>1</kbd>
                    <kbd>2</kbd>
                    <kbd>3</kbd> toggle bases · <kbd>←</kbd>
                    <kbd>→</kbd> change outs
                  </p>
                </div>
              </div>

              <div className="board-card">
                <span className="board-lbl">Home win expectancy</span>
                <div className="we-big">{pct(current)}</div>
                <span className="we-sub">{stateLine}</span>
                <div className="heat">
                  <div className="heat-track">
                    <div className="heat-mark" style={{ left: `${markPct}%` }} />
                  </div>
                  <div className="heat-ends">
                    <span>{pct(low)} · lowest state</span>
                    <span>highest state · {pct(high)}</span>
                  </div>
                </div>

                <div className="tiles">
                  <div className="tile">
                    <div className="t-lbl">A walk</div>
                    <div className={`t-val ${(walkWE ?? 0) >= (current ?? 0) ? 'v-pos' : 'v-neg'}`}>
                      {signedPts(walkWE == null || current == null ? null : walkWE - current)}
                    </div>
                    <div className="t-note">{walk.runs ? 'forces in a run' : `${shortState(walk.mask)}`}</div>
                  </div>
                  <div className="tile">
                    <div className="t-lbl">An out</div>
                    <div className={`t-val ${(outWE ?? 0) >= (current ?? 0) ? 'v-pos' : 'v-neg'}`}>
                      {signedPts(outWE == null || current == null ? null : outWE - current)}
                    </div>
                    <div className="t-note">{outs === 2 ? 'ends half-inning' : `${outs + 1} out${outs + 1 === 1 ? '' : 's'}`}</div>
                  </div>
                  <div className="tile">
                    <div className="t-lbl">{runLabel}</div>
                    <div className={`t-val ${(runWE ?? 0) >= (current ?? 0) ? 'v-pos' : 'v-neg'}`}>
                      {signedPts(runWE == null || current == null ? null : runWE - current)}
                    </div>
                    <div className="t-note">one run scores now</div>
                  </div>
                </div>
              </div>
            </div>

            <section className="lab">
              <div className="sec-head">
                <span className="num">/ SCOREBOARD STRIP</span>
                <h2>Same state, different score</h2>
              </div>
              <p className="sec-dek">
                Keep the inning, half, runners and outs fixed. Slide across the score to see where
                the leverage lives.
              </p>
              <div className="score-strip">
                {scoreStrip.map((item) => (
                  <button
                    key={item.diff}
                    className={item.diff === diff ? 'sel' : ''}
                    onClick={() => setDiff(item.diff)}
                    style={{ background: heat(item.we), color: heatText(item.we) }}
                  >
                    <span>{item.diff === 0 ? 'Tie' : item.diff > 0 ? `+${item.diff}` : item.diff}</span>
                    <strong>{pct(item.we)}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="matrix-sec">
              <div className="sec-head">
                <span className="num">/ ALL 24</span>
                <h2>The full base–out layer</h2>
              </div>
              <p className="sec-dek">
                This is Table&nbsp;10 collapsed to the inning and score you chose. Tap any cell to
                jump the field there.
              </p>
              <table className="mtx" aria-label="Win expectancy for all 24 base-out states">
                <thead>
                  <tr>
                    <th className="rowhead">Base state</th>
                    <th>0 outs</th>
                    <th>1 out</th>
                    <th>2 outs</th>
                  </tr>
                </thead>
                <tbody>
                  {ORDER.map((mk) => (
                    <tr key={mk}>
                      <td className="rowhead">{LABELS[mk]}</td>
                      {OUTS.map((o) => {
                        const v = homeWE(inning, half, diff, mk, o)
                        const isCur = mk === mask && o === outs
                        return (
                          <td
                            key={o}
                            className={`val ${isCur ? 'cur' : ''}`}
                            style={{ background: heat(v), color: heatText(v) }}
                            onClick={() => {
                              setMask(mk)
                              setOuts(o)
                            }}
                          >
                            {pct(v)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <footer>
              <b>Values:</b> computed live from the Table&nbsp;10 Markov game model for {sel.seasonLabel} ({sel.teamLabel}),{' '}
              {model.totalTransitions.toLocaleString()} observed state transitions. &nbsp;<b>Convention:</b> ties
              after the ninth are treated as 50/50, matching the book.
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
