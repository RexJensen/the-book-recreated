import reData from '../data/re_dataset.json'
import { matchesSelection } from './selection.js'

export const BASE_ORDER = reData.meta.baseOrder // [0,1,2,4,3,5,6,7]
export const OUTS = [0, 1, 2]
export const reMeta = reData.meta

// Aggregate the Table 1 run-expectancy matrix for the current selection.
// Returns { matrix: {key:{re,count}}, totalPA, lo, hi } keyed by base*10+outs.
export function computeREMatrix(sel) {
  const acc = {}
  for (const o of OUTS) for (const b of BASE_ORDER) acc[b * 10 + o] = { count: 0, sumRuns: 0 }
  for (const g of reData.groups) {
    if (!matchesSelection(g, sel)) continue
    for (const c of g.cells) {
      const k = c.base * 10 + c.outs
      acc[k].count += c.count
      acc[k].sumRuns += c.sumRuns
    }
  }
  let totalPA = 0
  let lo = Infinity
  let hi = -Infinity
  const matrix = {}
  for (const k in acc) {
    const { count, sumRuns } = acc[k]
    totalPA += count
    const re = count ? sumRuns / count : null
    matrix[k] = { re, count }
    if (re != null) {
      lo = Math.min(lo, re)
      hi = Math.max(hi, re)
    }
  }
  return { matrix, totalPA, lo: Number.isFinite(lo) ? lo : 0, hi: Number.isFinite(hi) ? hi : 1 }
}
