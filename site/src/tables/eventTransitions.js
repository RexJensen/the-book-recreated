import { matchesSelection } from '../components/selection.js'

export const NOT_IN_BOOK = new Set(['FC', 'FLE', 'OTHER'])

export const BOOK_TABLE_7 = {
  HR: 1.397,
  '3B': 1.07,
  '2B': 0.776,
  RBOE: 0.508,
  '1B': 0.475,
  INT: 0.392,
  HBP: 0.352,
  NIBB: 0.323,
  PB: 0.269,
  WP: 0.266,
  BK: 0.264,
  IBB: 0.179,
  SB: 0.175,
  DI: 0.12,
  BUNT: 0.042,
  SAC: -0.096,
  PK: -0.281,
  OUT: -0.299,
  K: -0.301,
  CS: -0.467,
}

export const BOOK_EVENT_ORDER = Object.keys(BOOK_TABLE_7)

export const signed = (v) =>
  v == null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}`

export function endingValue(matrix, endKey, runsScored) {
  const endOuts = endKey % 10
  if (endOuts >= 3) return runsScored
  const endRE = matrix[endKey]?.re
  return endRE == null ? null : runsScored + endRE
}

export function eventChoices(stateData) {
  const seen = new Set()
  for (const g of stateData.groups) for (const cat in g.events) seen.add(cat)
  const ordered = BOOK_EVENT_ORDER.filter((cat) => seen.has(cat))
  const rest = [...seen].filter((cat) => !BOOK_EVENT_ORDER.includes(cat)).sort()
  return [...ordered, ...rest]
}

export function computeTransitionEventRows(stateData, sel, matrix, labels) {
  const acc = {}

  for (const g of stateData.groups) {
    if (!matchesSelection(g, sel)) continue
    for (const cat in g.events) {
      const event = g.events[cat]
      if (!acc[cat]) {
        acc[cat] = {
          count: 0,
          sumRuns: 0,
          startWeighted: 0,
          startCount: 0,
          endingWeighted: 0,
          transitionCount: 0,
        }
      }

      const row = acc[cat]
      row.count += event.count
      row.sumRuns += event.sumRuns

      for (const sk in event.states) {
        const startRE = matrix[sk]?.re
        if (startRE == null) continue
        const count = event.states[sk][0]
        row.startWeighted += count * startRE
        row.startCount += count
      }

      for (const key in event.transitions || {}) {
        const [startKeyText, endKeyText] = key.split('>')
        const startRE = matrix[startKeyText]?.re
        if (startRE == null) continue

        const [count, runsScored] = event.transitions[key]
        const ending = endingValue(matrix, Number(endKeyText), runsScored / count)
        if (ending == null) continue

        row.endingWeighted += count * ending
        row.transitionCount += count
      }
    }
  }

  return Object.entries(acc)
    .map(([cat, v]) => {
      const startRE = v.startCount ? v.startWeighted / v.startCount : null
      const ending = v.transitionCount ? v.endingWeighted / v.transitionCount : null
      const empirical = v.count && startRE != null ? v.sumRuns / v.count - startRE : null
      const runValue = ending != null && startRE != null ? ending - startRE : null
      const book = BOOK_TABLE_7[cat]
      return {
        cat,
        label: labels[cat] || cat,
        count: v.count,
        startRE,
        ending,
        empirical,
        runValue,
        book,
        diff: book == null || runValue == null ? null : runValue - book,
        extra: NOT_IN_BOOK.has(cat),
      }
    })
    .filter((r) => r.count > 0)
}

export function computeTransitionStateRows(stateData, sel, matrix, eventCat, baseOrder, outs) {
  const acc = {}
  for (const o of outs) for (const b of baseOrder) acc[b * 10 + o] = stateAccumulator()

  for (const g of stateData.groups) {
    if (!matchesSelection(g, sel)) continue
    const event = g.events[eventCat]
    if (!event) continue

    for (const sk in event.states) {
      if (!acc[sk]) acc[sk] = stateAccumulator()
      const [count, sumRuns] = event.states[sk]
      acc[sk].count += count
      acc[sk].sumRuns += sumRuns
    }

    for (const key in event.transitions || {}) {
      const [startKeyText, endKeyText] = key.split('>')
      if (!acc[startKeyText]) acc[startKeyText] = stateAccumulator()
      const [count, runsScored] = event.transitions[key]
      const ending = endingValue(matrix, Number(endKeyText), runsScored / count)
      if (ending == null) continue
      acc[startKeyText].endingWeighted += count * ending
      acc[startKeyText].transitionCount += count
    }
  }

  const rows = []
  let totalN = 0
  for (const b of baseOrder) {
    for (const o of outs) {
      const k = b * 10 + o
      const state = acc[k]
      const startRE = matrix[k]?.re ?? null
      const avgROI = state.count ? state.sumRuns / state.count : null
      const original = avgROI != null && startRE != null ? avgROI - startRE : null
      const ending = state.transitionCount ? state.endingWeighted / state.transitionCount : null
      const runValue = ending != null && startRE != null ? ending - startRE : null
      totalN += state.count
      rows.push({ base: b, outs: o, count: state.count, original, startRE, ending, runValue })
    }
  }

  return { rows, totalN }
}

function stateAccumulator() {
  return { count: 0, sumRuns: 0, endingWeighted: 0, transitionCount: 0 }
}
