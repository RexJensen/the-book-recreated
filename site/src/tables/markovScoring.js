import { matchesSelection } from '../components/selection.js'
import { BASE_ORDER, OUTS } from '../components/reMatrix.js'

export const SCORE_BUCKETS = [0, 1, 2, 3, 4, 5]
export const BOOK_TABLE_9_RUNS_PER_GAME = 3.2

const stateKeys = () => BASE_ORDER.flatMap((base) => OUTS.map((outs) => base * 10 + outs))

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
  const keys = stateKeys()
  const index = Object.fromEntries(keys.map((key, i) => [key, i]))
  const n = keys.length
  const outcomeCounts = Array.from({ length: n }, () => new Map())
  const rawTotals = Array(n).fill(0)

  for (const group of stateData.groups) {
    if (!matchesSelection(group, sel) || !group.markov) continue
    for (const key in group.markov) {
      const { startKey, endKey, runs } = parseMarkovKey(key)
      const i = index[startKey]
      if (i == null) continue
      const count = group.markov[key]
      const outcomeKey = `${endKey}|${runs}`
      outcomeCounts[i].set(outcomeKey, (outcomeCounts[i].get(outcomeKey) || 0) + count)
      rawTotals[i] += count
    }
  }

  return { keys, index, n, outcomeCounts, rawTotals }
}

function solveMarkovScoring(aggregate, weight = () => 1) {
  const { keys, index, n, outcomeCounts, rawTotals } = aggregate
  const weightedTotals = Array(n).fill(0)
  const transientByRuns = Array.from({ length: 5 }, () =>
    Array.from({ length: n }, () => Array(n).fill(0)),
  )
  const transientAny = Array.from({ length: n }, () => Array(n).fill(0))
  const absorbExact = Array.from({ length: n }, () => Array(5).fill(0))
  const immediateRuns = Array(n).fill(0)

  for (let i = 0; i < n; i += 1) {
    if (!rawTotals[i]) continue
    const startKey = keys[i]
    let total = 0
    for (const [outcomeKey, count] of outcomeCounts[i]) {
      const [endText, runsText] = outcomeKey.split('|')
      const endKey = Number(endText)
      const runs = Number(runsText)
      total += count * weight(startKey, endKey, runs)
    }
    weightedTotals[i] = total
    if (!total) continue

    for (const [outcomeKey, count] of outcomeCounts[i]) {
      const [endText, runsText] = outcomeKey.split('|')
      const endKey = Number(endText)
      const runs = Number(runsText)
      const p = (count * weight(startKey, endKey, runs)) / total
      immediateRuns[i] += p * runs

      const endOuts = endKey % 10
      const j = index[endKey]
      if (endOuts >= 3 || j == null) {
        if (runs < 5) absorbExact[i][runs] += p
      } else {
        transientAny[i][j] += p
        if (runs < 5) transientByRuns[runs][i][j] += p
      }
    }
  }

  const expected = solveLinearSystem(identityMinus(transientAny), immediateRuns)
  const noRunSystem = identityMinus(transientByRuns[0])
  const exact = Array.from({ length: 5 }, () => Array(n).fill(0))

  for (let runs = 0; runs < 5; runs += 1) {
    let rhs = absorbExact.map((row) => row[runs])
    for (let scored = 1; scored <= runs; scored += 1) {
      const shifted = multiplyMatrixVector(transientByRuns[scored], exact[runs - scored])
      rhs = rhs.map((value, i) => value + shifted[i])
    }
    const solution = solveLinearSystem(noRunSystem, rhs)
    if (!solution) return { rows: [], totalTransitions: 0 }
    exact[runs] = solution
  }

  const rows = []
  let totalTransitions = 0
  for (const base of BASE_ORDER) {
    for (const outs of OUTS) {
      const key = base * 10 + outs
      const i = index[key]
      totalTransitions += rawTotals[i]
      if (!rawTotals[i] || !weightedTotals[i]) {
        rows.push({
          base,
          outs,
          count: 0,
          re: null,
          probs: SCORE_BUCKETS.map(() => null),
        })
        continue
      }

      const probs = exact.map((col) => Math.max(0, Math.min(1, col[i])))
      const fivePlus = Math.max(0, Math.min(1, 1 - probs.reduce((sum, value) => sum + value, 0)))
      rows.push({
        base,
        outs,
        count: rawTotals[i],
        re: expected ? expected[i] : null,
        probs: [...probs, fivePlus],
      })
    }
  }

  return { rows, totalTransitions }
}

export function computeMarkovScoringRows(stateData, sel) {
  return solveMarkovScoring(aggregateMarkovOutcomes(stateData, sel))
}

function emptyStartRE(result) {
  return result.rows.find((row) => row.base === 0 && row.outs === 0)?.re ?? null
}

export function computeAdjustedMarkovScoringRows(stateData, sel, runsPerGame) {
  const targetRE = runsPerGame / 9
  const aggregate = aggregateMarkovOutcomes(stateData, sel)
  const totalTransitions = aggregate.rawTotals.reduce((sum, count) => sum + count, 0)

  if (!totalTransitions) return { rows: [], totalTransitions: 0, actualRunsPerGame: null, theta: 0 }

  const solveForTheta = (theta) =>
    solveMarkovScoring(aggregate, (startKey, endKey) =>
      endKey % 10 === startKey % 10 ? Math.exp(theta) : 1,
    )

  let lo = -8
  let hi = 8
  let loRE = emptyStartRE(solveForTheta(lo))
  let hiRE = emptyStartRE(solveForTheta(hi))
  if (loRE == null || hiRE == null) {
    return { rows: [], totalTransitions: 0, actualRunsPerGame: null, theta: 0 }
  }

  if (loRE > hiRE) {
    ;[lo, hi] = [hi, lo]
    ;[loRE, hiRE] = [hiRE, loRE]
  }

  const clampedTarget = Math.max(loRE, Math.min(hiRE, targetRE))
  for (let i = 0; i < 36; i += 1) {
    const mid = (lo + hi) / 2
    const midRE = emptyStartRE(solveForTheta(mid))
    if (midRE == null) break
    if (midRE < clampedTarget) lo = mid
    else hi = mid
  }

  const theta = (lo + hi) / 2
  const result = solveForTheta(theta)
  const actualRE = emptyStartRE(result)
  return {
    ...result,
    actualRunsPerGame: actualRE == null ? null : actualRE * 9,
    theta,
  }
}
