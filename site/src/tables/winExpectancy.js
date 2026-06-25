import { matchesSelection } from '../components/selection.js'
import { BASE_ORDER, OUTS } from '../components/reMatrix.js'

export const SCORE_DIFFS = [-4, -3, -2, -1, 0, 1, 2, 3, 4]
export const MAX_HALF_INNING_RUNS = 20

const STATE_KEYS = BASE_ORDER.flatMap((base) => OUTS.map((outs) => base * 10 + outs))
const STATE_INDEX = Object.fromEntries(STATE_KEYS.map((key, i) => [key, i]))
const EMPTY_STATE_KEY = 0
const EMPTY_STATE_INDEX = STATE_INDEX[EMPTY_STATE_KEY]

export const BOOK_TABLE_10_ANCHORS = [
  { label: 'Top 1, tie, empty/0 out', inning: 1, half: 'top', diff: 0, base: 0, outs: 0, book: 0.5 },
  { label: 'Top 1, tie, bases loaded/0 out', inning: 1, half: 'top', diff: 0, base: 7, outs: 0, book: 0.343 },
  { label: 'Bottom 1, tie, empty/0 out', inning: 1, half: 'bottom', diff: 0, base: 0, outs: 0, book: 0.551 },
  { label: 'Bottom 5, tie, empty/0 out', inning: 5, half: 'bottom', diff: 0, base: 0, outs: 0, book: 0.569 },
  { label: 'Bottom 5, tie, bases loaded/0 out', inning: 5, half: 'bottom', diff: 0, base: 7, outs: 0, book: 0.764 },
  { label: 'Top 9, tie, empty/0 out', inning: 9, half: 'top', diff: 0, base: 0, outs: 0, book: 0.5 },
  { label: 'Top 9, home +1, empty/0 out', inning: 9, half: 'top', diff: 1, base: 0, outs: 0, book: 0.825 },
  { label: 'Bottom 9, tie, empty/0 out', inning: 9, half: 'bottom', diff: 0, base: 0, outs: 0, book: 0.649 },
  { label: 'Bottom 9, home -1, runner on 3B/0 out', inning: 9, half: 'bottom', diff: -1, base: 4, outs: 0, book: 0.583 },
  { label: 'Bottom 9, tie, bases loaded/2 out', inning: 9, half: 'bottom', diff: 0, base: 7, outs: 2, book: 0.665 },
]

function parseMarkovKey(key) {
  const [transition, runsText] = key.split('|')
  const [startText, endText] = transition.split('>')
  return {
    startKey: Number(startText),
    endKey: Number(endText),
    runs: Math.min(5, Number(runsText)),
  }
}

function solveLinearSystem(matrix, rhs) {
  const n = rhs.length
  const a = matrix.map((row, i) => [...row, rhs[i]])

  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null
    if (pivot !== col) [a[col], a[pivot]] = [a[pivot], a[col]]

    const divisor = a[col][col]
    for (let j = col; j <= n; j += 1) a[col][j] /= divisor

    for (let row = 0; row < n; row += 1) {
      if (row === col) continue
      const factor = a[row][col]
      if (Math.abs(factor) < 1e-15) continue
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j]
    }
  }

  return a.map((row) => row[n])
}

function identityMinus(matrix) {
  return matrix.map((row, i) => row.map((value, j) => (i === j ? 1 : 0) - value))
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map((row) => row.reduce((sum, value, i) => sum + value * vector[i], 0))
}

function aggregateMarkovOutcomes(stateData, sel) {
  const n = STATE_KEYS.length
  const outcomeCounts = Array.from({ length: n }, () => new Map())
  const rawTotals = Array(n).fill(0)

  for (const group of stateData.groups) {
    if (!matchesSelection(group, sel) || !group.markov) continue
    for (const key in group.markov) {
      const { startKey, endKey, runs } = parseMarkovKey(key)
      const i = STATE_INDEX[startKey]
      if (i == null) continue
      const count = group.markov[key]
      const outcomeKey = `${endKey}|${runs}`
      outcomeCounts[i].set(outcomeKey, (outcomeCounts[i].get(outcomeKey) || 0) + count)
      rawTotals[i] += count
    }
  }

  return { n, outcomeCounts, rawTotals }
}

function computeHalfInningDistributions(aggregate) {
  const { n, outcomeCounts, rawTotals } = aggregate
  const transientByRuns = Array.from({ length: 6 }, () =>
    Array.from({ length: n }, () => Array(n).fill(0)),
  )
  const absorbExact = Array.from({ length: n }, () => Array(MAX_HALF_INNING_RUNS + 1).fill(0))

  for (let i = 0; i < n; i += 1) {
    if (!rawTotals[i]) continue
    for (const [outcomeKey, count] of outcomeCounts[i]) {
      const [endText, runsText] = outcomeKey.split('|')
      const endKey = Number(endText)
      const runs = Number(runsText)
      const p = count / rawTotals[i]
      const j = STATE_INDEX[endKey]
      if (j == null || endKey % 10 >= 3) {
        if (runs <= MAX_HALF_INNING_RUNS) absorbExact[i][runs] += p
      } else {
        transientByRuns[runs][i][j] += p
      }
    }
  }

  const noRunSystem = identityMinus(transientByRuns[0])
  const exactByRuns = []
  for (let runs = 0; runs <= MAX_HALF_INNING_RUNS; runs += 1) {
    let rhs = absorbExact.map((row) => row[runs])
    for (let scored = 1; scored <= Math.min(5, runs); scored += 1) {
      const shifted = multiplyMatrixVector(transientByRuns[scored], exactByRuns[runs - scored])
      rhs = rhs.map((value, i) => value + shifted[i])
    }
    const solution = solveLinearSystem(noRunSystem, rhs)
    if (!solution) return null
    exactByRuns[runs] = solution
  }

  return STATE_KEYS.map((key, i) => {
    const exact = exactByRuns.map((solution) => Math.max(0, Math.min(1, solution[i])))
    const tail = Math.max(0, Math.min(1, 1 - exact.reduce((sum, value) => sum + value, 0)))
    return {
      key,
      base: Math.floor(key / 10),
      outs: key % 10,
      count: rawTotals[i],
      runs: [...exact, tail],
    }
  })
}

export function scoreDiffLabel(diff) {
  if (diff === 0) return 'Tie'
  return diff > 0 ? `Home +${diff}` : `Home ${diff}`
}

export function isImpossibleBookState(inning, half, diff) {
  return (inning === 1 && half === 'top' && diff > 0) || (inning === 9 && half === 'bottom' && diff > 0)
}

export function makeBookSelection(stateData) {
  const teams = new Set()
  for (const group of stateData.groups) {
    if (group.season >= 1999 && group.season <= 2002) teams.add(group.team)
  }
  return {
    seasons: new Set([1999, 2000, 2001, 2002]),
    league: 'ALL',
    teams,
  }
}

export function computeWinExpectancyModel(stateData, sel) {
  const aggregate = aggregateMarkovOutcomes(stateData, sel)
  const distributions = computeHalfInningDistributions(aggregate)
  const emptyDistribution = distributions?.[EMPTY_STATE_INDEX]?.runs
  const totalTransitions = aggregate.rawTotals.reduce((sum, count) => sum + count, 0)

  if (!distributions || !emptyDistribution || !totalTransitions) {
    return { distributions: [], totalTransitions: 0, winProbability: () => null }
  }

  const distByKey = Object.fromEntries(distributions.map((dist) => [dist.key, dist.runs]))
  const memo = new Map()

  const afterBottom = (inning, diff) => {
    if (inning >= 9) {
      if (diff > 0) return 1
      if (diff < 0) return 0
      return 0.5
    }
    return startTop(inning + 1, diff)
  }

  const startBottom = (inning, diff, runDist = emptyDistribution) => {
    let value = 0
    for (let runs = 0; runs < runDist.length; runs += 1) {
      if (!runDist[runs]) continue
      value += runDist[runs] * afterBottom(inning, diff + runs)
    }
    return value
  }

  const afterTop = (inning, diff) => {
    if (inning >= 9 && diff > 0) return 1
    return startBottom(inning, diff)
  }

  function startTop(inning, diff, runDist = emptyDistribution) {
    if (runDist === emptyDistribution) {
      const key = `${inning}|${diff}`
      if (memo.has(key)) return memo.get(key)
      let value = 0
      for (let runs = 0; runs < runDist.length; runs += 1) {
        if (!runDist[runs]) continue
        value += runDist[runs] * afterTop(inning, diff - runs)
      }
      memo.set(key, value)
      return value
    }

    let value = 0
    for (let runs = 0; runs < runDist.length; runs += 1) {
      if (!runDist[runs]) continue
      value += runDist[runs] * afterTop(inning, diff - runs)
    }
    return value
  }

  const winProbability = ({ inning, half, diff, base, outs }) => {
    const runDist = distByKey[base * 10 + outs]
    if (!runDist) return null
    const value = half === 'top' ? startTop(inning, diff, runDist) : startBottom(inning, diff, runDist)
    return Math.max(0, Math.min(1, value))
  }

  return { distributions, totalTransitions, winProbability }
}
