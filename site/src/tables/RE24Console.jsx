import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { computeREMatrix } from '../components/reMatrix.js'
import './re24.css'

/*
  The 24 base-out states, as a decision console.

  A port of the standalone RE24 artifact into the site: instead of the book's
  hardcoded 1999–2002 values, the run-expectancy matrix is computed live from
  the shared Seasons/League/Teams selection (same source as Table 1), so the
  steal break-evens and bunt costs update with whatever filter is active.

  This is a "fun tool", not a faithful recreation of a book table, so it lives
  on its own route and is intentionally kept out of the table registry/nav.
*/

// base bitmask: bit0 = runner on 1st, bit1 = 2nd, bit2 = 3rd
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
const sgn = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3)

function heat(v, min, max) {
  const t = max > min ? Math.max(0, Math.min(1, (v - min) / (max - min))) : 0.5
  return `hsl(${136 - 9 * t} ${28 + 40 * t}% ${94 - 60 * t}%)`
}
function heatText(v, min, max) {
  const t = max > min ? Math.max(0, Math.min(1, (v - min) / (max - min))) : 0.5
  return t > 0.5 ? '#f4f1e6' : '#1c2a20'
}

function desc(mask, outs) {
  const r = []
  if (on(mask, 1)) r.push('1st')
  if (on(mask, 2)) r.push('2nd')
  if (on(mask, 4)) r.push('3rd')
  let base
  if (mask === 0) base = 'Bases empty'
  else if (mask === 7) base = 'Bases loaded'
  else if (r.length === 1) base = 'Runner on ' + r[0]
  else base = 'Runners on ' + r.slice(0, -1).join(', ') + ' & ' + r[r.length - 1]
  return { base, outs: outs === 1 ? '1 out' : outs + ' outs' }
}
function descShort(m) {
  if (m === 0) return 'bases empty'
  if (m === 7) return 'loaded'
  const r = []
  if (on(m, 1)) r.push('1st')
  if (on(m, 2)) r.push('2nd')
  if (on(m, 4)) r.push('3rd')
  return r.join(' & ')
}

function stealOptions(mask) {
  const opts = []
  if (on(mask, 1) && !on(mask, 2)) opts.push({ key: 's2', label: 'Steal 2nd', runner: 'from 1st', safeMask: (mask & ~1) | 2, safeRuns: 0, caughtMask: mask & ~1 })
  if (on(mask, 2) && !on(mask, 4)) opts.push({ key: 's3', label: 'Steal 3rd', runner: 'from 2nd', safeMask: (mask & ~2) | 4, safeRuns: 0, caughtMask: mask & ~2 })
  if (on(mask, 4)) opts.push({ key: 'sh', label: 'Steal home', runner: 'from 3rd', safeMask: mask & ~4, safeRuns: 1, caughtMask: mask & ~4 })
  return opts
}

// static field background (grass, mow wedges, infield, lines, mound, plate)
const FIELD_BG = (() => {
  let s = '<rect x="0" y="0" width="380" height="360" fill="var(--grass)"/>'
  const hx = 190, hy = 312, R = 400, n = 8
  const a0 = (-135 * Math.PI) / 180, a1 = (-45 * Math.PI) / 180
  for (let i = 0; i < n; i++) {
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

// mini diamond used in the matrix row headers
function Mini({ mask }) {
  const g = 'var(--gold)', e = '#efe9da'
  const d = (x, y, fill) => (
    <rect key={`${x},${y}`} x={x - 4} y={y - 4} width="8" height="8" rx="1.5" transform={`rotate(45 ${x} ${y})`} fill={fill} stroke="#b9b09c" strokeWidth="1" />
  )
  return (
    <svg width="34" height="30" viewBox="0 0 34 30">
      {d(17, 7, on(mask, 2) ? g : e)}
      {d(28, 16, on(mask, 1) ? g : e)}
      {d(6, 16, on(mask, 4) ? g : e)}
      <polygon points="17,27 13,24 13,21 21,21 21,24" fill="#d9d2c0" />
    </svg>
  )
}

// count-up animation for the big run-expectancy readout
function useAnimatedNumber(value) {
  const [display, setDisplay] = useState(value)
  const ref = useRef(value)
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches
    const from = ref.current, to = value
    if (reduce || from === to) {
      ref.current = to
      setDisplay(to)
      return
    }
    let raf
    const t0 = performance.now(), dur = 380
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur)
      const eased = 1 - Math.pow(1 - k, 3)
      setDisplay(from + (to - from) * eased)
      if (k < 1) raf = requestAnimationFrame(step)
      else {
        ref.current = to
        setDisplay(to)
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return display
}

export default function RE24Console({ sel }) {
  const [mask, setMask] = useState(1)
  const [outs, setOuts] = useState(0)
  const [steal, setSteal] = useState('s2')
  const [pct, setPct] = useState(75)

  const { matrix, totalPA, lo, hi } = useMemo(() => computeREMatrix(sel), [sel])
  const re = (mk, o) => (o >= 3 ? 0 : matrix[mk * 10 + o]?.re ?? 0)

  const sorted = useMemo(() => {
    const arr = []
    for (const mk of ORDER) for (let o = 0; o < 3; o++) arr.push(o >= 3 ? 0 : matrix[mk * 10 + o]?.re ?? 0)
    return arr.slice().sort((a, b) => b - a)
  }, [matrix])

  const cur = re(mask, outs)
  const animated = useAnimatedNumber(cur)

  // keyboard shortcuts: 1/2/3 toggle bases, arrows change outs
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

  const MIN = lo, MAX = hi, AVG = re(0, 0)
  const dd = desc(mask, outs)
  const reSub = cur > 1.3 ? 'a high-leverage run state' : cur < 0.3 ? 'a tough spot to score' : 'average runs scored from here'

  // tiles
  const walkValue = (() => {
    let nm, scored = 0
    if (!on(mask, 1)) nm = mask | 1
    else if (!on(mask, 2)) nm = mask | 1 | 2
    else if (!on(mask, 4)) nm = mask | 1 | 2 | 4
    else {
      nm = 7
      scored = 1
    }
    return re(nm, outs) + scored - cur
  })()
  const outCost = re(mask, outs + 1) - cur
  const rank = sorted.indexOf(cur) + 1

  // steal view
  const stealOpts = stealOptions(mask)
  const effSteal = stealOpts.length ? (stealOpts.some((x) => x.key === steal) ? steal : stealOpts[0].key) : null
  const opt = stealOpts.find((x) => x.key === effSteal)
  let stealView = null
  if (opt) {
    const no = outs + 1
    const S = re(opt.safeMask, outs) + opt.safeRuns
    const F = no >= 3 ? 0 : re(opt.caughtMask, no)
    let be = (cur - F) / (S - F)
    be = Math.max(0, Math.min(1, be))
    const p = pct / 100
    const net = p * S + (1 - p) * F - cur
    const caughtState = no >= 3 ? 'inning over' : `${descShort(opt.caughtMask)} · ${no} out${no > 1 ? 's' : ''}`
    stealView = { S, F, be, net, caughtState }
  }

  // bunt view
  let buntView = null
  if (mask !== 0 && outs < 2) {
    const scored = on(mask, 4) ? 1 : 0
    const nm = (on(mask, 1) ? 2 : 0) | (on(mask, 2) ? 4 : 0)
    const no = outs + 1
    const after = re(nm, no) + scored
    const delta = after - cur
    buntView = { scored, nm, no, after, delta, good: delta >= 0 }
  }

  const heatStops = [0, 0.25, 0.5, 0.75, 1].map((k) => `${heat(MIN + (MAX - MIN) * k, MIN, MAX)} ${k * 100}%`).join(',')
  const markPct = MAX > MIN ? ((cur - MIN) / (MAX - MIN)) * 100 : 50
  const avgPct = MAX > MIN ? ((AVG - MIN) / (MAX - MIN)) * 100 : 50

  return (
    <div className="re24">
      <div className="wrap">
        <Link to="/table-1" className="back-link">← Back to Table 1</Link>
        <p className="eyebrow">RE24 · live from Retrosheet · {sel.seasonLabel} · {sel.teamLabel}</p>
        <h1>
          The 24 base–out states,<br />as a <em>decision console</em>.
        </h1>
        <p className="dek">
          The same numbers as Table&nbsp;1 — but the field <b>is</b> the input. Put runners on, set the
          outs, and read the expected runs to the end of the inning, computed live for whatever{' '}
          <b>seasons, league and teams</b> you have selected in the sidebar. Then ask the question the
          table was built to answer: <b>is the steal worth it, and what does the bunt cost?</b>
        </p>

        {totalPA === 0 ? (
          <div className="empty-state" style={{ marginTop: 28 }}>
            Select at least one team in the sidebar to compute run expectancy.
          </div>
        ) : (
          <>
            {/* ===== console ===== */}
            <div className="console">
              {/* field */}
              <div className="card field-card">
                <svg id="re24-field" viewBox="0 0 380 360" role="group" aria-label="Interactive baseball field. Tap a base to toggle a runner.">
                  <g dangerouslySetInnerHTML={{ __html: FIELD_BG }} />
                  {BASES.map((b) => (
                    <g
                      key={b.bit}
                      className={'base' + (on(mask, b.bit) ? ' on' : '')}
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
                <div className="field-foot">
                  <div className="outs-row">
                    <span className="lbl">Outs</span>
                    <div className="seg" role="group" aria-label="Outs">
                      {[0, 1, 2].map((n) => (
                        <button key={n} className={n === outs ? 'active' : ''} onClick={() => setOuts(n)} aria-label={n === 1 ? '1 out' : `${n} outs`}>
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
                      <button key={mk} className={'chip' + (mk === mask ? ' sel' : '')} onClick={() => setMask(mk)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="hint">
                    Tap a base to set a runner. <kbd>1</kbd>
                    <kbd>2</kbd>
                    <kbd>3</kbd> toggle bases · <kbd>←</kbd>
                    <kbd>→</kbd> change outs
                  </p>
                </div>
              </div>

              {/* scoreboard */}
              <div className="board-card">
                <span className="board-lbl">Expected runs · rest of inning</span>
                <div className="re-big">{animated.toFixed(3)}</div>
                <span className="re-sub">{reSub}</span>
                <div className="state-line">
                  {dd.base} · <span className="o">{dd.outs}</span>
                </div>

                <div className="heat">
                  <div className="heat-track" style={{ background: `linear-gradient(90deg,${heatStops})` }}>
                    <div className="heat-avg" style={{ left: `${avgPct}%` }} />
                    <div className="heat-mark" style={{ left: `${markPct}%` }} />
                  </div>
                  <div className="heat-ends">
                    <span>{MIN.toFixed(3)} · lowest</span>
                    <span>highest · {MAX.toFixed(3)}</span>
                  </div>
                </div>

                <div className="tiles">
                  <div className="tile">
                    <div className="t-lbl">A walk</div>
                    <div className="t-val v-pos">{sgn(walkValue)}</div>
                    <div className="t-note">runs added</div>
                  </div>
                  <div className="tile">
                    <div className="t-lbl">An out</div>
                    <div className="t-val v-neg">{sgn(outCost)}</div>
                    <div className="t-note">runs lost</div>
                  </div>
                  <div className="tile">
                    <div className="t-lbl">Rank</div>
                    <div className="t-val" style={{ color: '#dfe5db' }}>#{rank}</div>
                    <div className="t-note">{(rank === 1 ? 'most ' : rank === 24 ? 'fewest ' : '') + 'expected runs'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== EV lab ===== */}
            <section className="lab">
              <div className="sec-head">
                <span className="num">/ EV LAB</span>
                <h2>Run the numbers on the play</h2>
              </div>
              <p className="sec-dek">
                Run expectancy turns base-running into a break-even problem, the same shape as any +EV bet:
                you risk the value of an out against the value of a base. Set the situation above, then pick a play.
              </p>

              <div className="lab-grid">
                {/* steal */}
                <div className="card lab-card">
                  <h3>Steal attempt</h3>
                  <p className="sub">Safe = the runner advances. Caught = a runner is erased and an out is added.</p>
                  {!opt ? (
                    <div className="empty-state">
                      No steal available — you need a runner with the base ahead of them open. Try a runner on 1st or 2nd.
                    </div>
                  ) : (
                    <>
                      <div className="runner-opts">
                        {stealOpts.map((x) => (
                          <button key={x.key} className={'ropt' + (x.key === effSteal ? ' sel' : '')} onClick={() => setSteal(x.key)}>
                            {x.label} <span style={{ opacity: 0.65 }}>{x.runner}</span>
                          </button>
                        ))}
                      </div>
                      <div className="triplet">
                        <div className="cell">
                          <div className="c-lbl">Now</div>
                          <div className="c-val">{cur.toFixed(3)}</div>
                          <div className="c-st">{descShort(mask)}</div>
                        </div>
                        <div className="cell safe">
                          <div className="c-lbl">If safe</div>
                          <div className="c-val" style={{ color: 'var(--pos)' }}>{stealView.S.toFixed(3)}</div>
                          <div className="c-st">{(opt.safeRuns ? 'run scores · ' : '') + descShort(opt.safeMask)}</div>
                        </div>
                        <div className="cell caught">
                          <div className="c-lbl">If caught</div>
                          <div className="c-val" style={{ color: 'var(--neg)' }}>{stealView.F.toFixed(3)}</div>
                          <div className="c-st">{stealView.caughtState}</div>
                        </div>
                      </div>
                      <div className="breakeven">
                        <span className="be-lbl">Break-even success rate</span>
                        <span className="be-val">{(stealView.be * 100).toFixed(1)}%</span>
                      </div>
                      <div className="slider-block">
                        <div className="slider-top">
                          <span className="lbl">Your success rate</span>
                          <span className="s-pct">{pct}%</span>
                        </div>
                        <div className="s-track">
                          <div className="be-tick" style={{ left: `${stealView.be * 100}%` }} />
                          <input type="range" min="0" max="100" value={pct} onChange={(e) => setPct(+e.target.value)} />
                        </div>
                        <div className="netev">
                          <span className="n-lbl">Net run value</span>
                          <span className="n-val" style={{ color: stealView.net >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{sgn(stealView.net)}</span>
                        </div>
                        <div className="verdict" style={{ color: stealView.net >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                          {stealView.net >= 0
                            ? `+EV — at ${pct}% this steal adds runs over staying put.`
                            : `−EV — at ${pct}% you give back runs. Clear ${(stealView.be * 100).toFixed(1)}% to profit.`}
                        </div>
                      </div>
                      <p className="note">
                        Run expectancy only, computed live for {sel.seasonLabel} ({sel.teamLabel}). A clean
                        steal/caught — no errors, no balk, no advancing on the throw.
                      </p>
                    </>
                  )}
                </div>

                {/* bunt */}
                <div className="card lab-card">
                  <h3>Sacrifice bunt</h3>
                  <p className="sub">The batter gives up an out so every runner advances one base.</p>
                  {mask === 0 ? (
                    <div className="empty-state">A sacrifice needs a runner on base — put someone on first.</div>
                  ) : outs >= 2 ? (
                    <div className="empty-state">With two outs, a bunt just makes the final out. The sacrifice belongs to 0 or 1 out.</div>
                  ) : (
                    <>
                      <p className="flow">
                        {descShort(mask)}, {outs === 1 ? '1 out' : '0 outs'}
                        <span className="arrow">→</span>
                        {descShort(buntView.nm)}, {buntView.no}
                        {buntView.no > 1 ? ' outs' : ' out'}
                        {buntView.scored ? <span className="run-pill">+1 run scores</span> : null}
                      </p>
                      <div className="triplet" style={{ marginTop: 14 }}>
                        <div className="cell">
                          <div className="c-lbl">Before</div>
                          <div className="c-val">{cur.toFixed(3)}</div>
                        </div>
                        <div className="cell">
                          <div className="c-lbl">After (+runs)</div>
                          <div className="c-val">{buntView.after.toFixed(3)}</div>
                        </div>
                        <div className={'cell ' + (buntView.good ? 'safe' : 'caught')}>
                          <div className="c-lbl">Change</div>
                          <div className="c-val" style={{ color: buntView.good ? 'var(--pos)' : 'var(--neg)' }}>{sgn(buntView.delta)}</div>
                        </div>
                      </div>
                      <div className="delta-big" style={{ color: buntView.good ? 'var(--pos)' : 'var(--neg)' }}>{sgn(buntView.delta)} runs</div>
                      <div className="verdict" style={{ color: buntView.good ? 'var(--pos)' : 'var(--neg)' }}>
                        {buntView.good
                          ? 'This bunt adds expected runs — uncommon, and usually a squeeze.'
                          : 'This bunt costs expected runs. The out is worth more than the base.'}
                      </div>
                      <p className="note">
                        Trading an out for 90 feet almost always loses runs. It can still gain <i>wins</i> in a
                        tie or one-run game late, where pushing a single run across matters more than the inning’s total.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* ===== matrix ===== */}
            <section className="matrix-sec">
              <div className="sec-head">
                <span className="num">/ ALL 24</span>
                <h2>The full table</h2>
              </div>
              <p className="sec-dek">
                Every base–out state at once. Your current situation is ringed in gold — tap any cell to jump there.
              </p>
              <table className="mtx" aria-label="Run expectancy for all 24 base-out states">
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
                      <td className="rowhead">
                        <div className="row-id">
                          <Mini mask={mk} />
                          <span>{LABELS[mk]}</span>
                        </div>
                      </td>
                      {[0, 1, 2].map((o) => {
                        const v = re(mk, o)
                        const isCur = mk === mask && o === outs
                        return (
                          <td
                            key={o}
                            className={'val' + (isCur ? ' cur' : '')}
                            style={{ background: heat(v, MIN, MAX), color: heatText(v, MIN, MAX) }}
                            onClick={() => {
                              setMask(mk)
                              setOuts(o)
                            }}
                          >
                            {v.toFixed(3)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <footer>
              <b>Values:</b> computed live from Retrosheet play-by-play for {sel.seasonLabel} ({sel.teamLabel}),{' '}
              {totalPA.toLocaleString()} plate appearances — the same Table&nbsp;1 matrix the rest of the site
              uses. &nbsp;<b>Method:</b> break-even rates, run values, and bunt costs are derived from this table
              and reflect <i>run</i> expectancy only. In close, late innings, <i>win</i> expectancy can justify a
              different call — a one-run game in the 9th rewards conservatism the table won't credit.
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
