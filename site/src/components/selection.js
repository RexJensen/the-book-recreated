import { useMemo, useState } from 'react'
import { teamName } from '../teams.js'

const listCodes = (teams) => teams.flatMap((t) => t.codes)

// Build a human-facing team list from Retrosheet team codes. Codes that map to
// the same display name are grouped so relocated/renamed IDs do not show as
// duplicate buttons.
export function buildTeams(groups) {
  const byLabel = new Map()
  for (const g of groups) {
    const label = teamName(g.team)
    if (!byLabel.has(label)) byLabel.set(label, { key: label, label, codes: new Set(), leagues: new Set() })
    const item = byLabel.get(label)
    item.codes.add(g.team)
    item.leagues.add(g.league)
  }

  return [...byLabel.values()]
    .map((t) => ({
      ...t,
      codes: [...t.codes].sort(),
      leagues: [...t.leagues].sort(),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// Shared Seasons / League / Teams selection state, used by every table so the
// chosen filter carries across the whole site.
export function useSelection(seasonList, teamList) {
  const [seasons, setSeasons] = useState(() => {
    const latestSeason = seasonList[seasonList.length - 1]
    return new Set(seasonList.filter((s) => s >= latestSeason - 4 && s <= latestSeason))
  })
  const [league, setLeague] = useState('ALL') // ALL | AL | NL
  const [teams, setTeams] = useState(() => new Set(listCodes(teamList)))

  const visibleTeams = useMemo(
    () => teamList.filter((t) => league === 'ALL' || t.leagues.includes(league)),
    [league, teamList],
  )

  const setSeasonRange = (from, to) => {
    const lo = Math.min(Number(from), Number(to))
    const hi = Math.max(Number(from), Number(to))
    setSeasons(new Set(seasonList.filter((s) => s >= lo && s <= hi)))
  }

  const toggleSeason = (s) =>
    setSeasons((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next.size ? next : prev // never allow zero seasons
    })

  const selectAllSeasons = () => setSeasons(new Set(seasonList))
  const selectBookSeasons = () => setSeasonRange(1999, 2002)
  const latestSeason = seasonList[seasonList.length - 1]
  const selectRecentSeasons = () => setSeasonRange(Math.max(seasonList[0], latestSeason - 9), latestSeason)

  const changeLeague = (lg) => {
    setLeague(lg)
    setTeams(new Set(listCodes(teamList.filter((t) => lg === 'ALL' || t.leagues.includes(lg)))))
  }

  const teamSelected = (team) => team.codes.every((code) => teams.has(code))
  const teamPartial = (team) => team.codes.some((code) => teams.has(code)) && !teamSelected(team)

  const toggleTeam = (team) =>
    setTeams((prev) => {
      const next = new Set(prev)
      const selected = team.codes.every((code) => next.has(code))
      for (const code of team.codes) selected ? next.delete(code) : next.add(code)
      return next
    })

  const selectAll = () => setTeams(new Set(listCodes(visibleTeams)))
  const selectNone = () => setTeams(new Set())

  const allVisibleSelected = visibleTeams.every(teamSelected)
  const selectedVisibleTeams = visibleTeams.filter((t) => t.codes.some((code) => teams.has(code)))
  const seasonValues = [...seasons].sort((a, b) => a - b)
  const seasonStart = seasonValues[0]
  const seasonEnd = seasonValues[seasonValues.length - 1]
  const contiguousSeasonCount = seasonEnd - seasonStart + 1

  const seasonLabel =
    seasons.size === seasonList.length
      ? `${seasonList[0]}–${seasonList[seasonList.length - 1]}`
      : seasons.size === contiguousSeasonCount
        ? `${seasonStart}–${seasonEnd}`
        : seasonValues.join(', ')

  const teamLabel = allVisibleSelected
    ? league === 'ALL'
      ? 'All Teams'
      : `All ${league}`
    : `${selectedVisibleTeams.length} team${selectedVisibleTeams.length === 1 ? '' : 's'}`

  return {
    seasonList,
    seasons,
    seasonStart,
    seasonEnd,
    league,
    teams,
    visibleTeams,
    setSeasonRange,
    toggleSeason,
    selectAllSeasons,
    selectBookSeasons,
    selectRecentSeasons,
    changeLeague,
    toggleTeam,
    teamSelected,
    teamPartial,
    selectAll,
    selectNone,
    seasonLabel,
    teamLabel,
  }
}

// Predicate: does a dataset group match the current selection?
export function matchesSelection(g, sel) {
  return (
    sel.seasons.has(g.season) &&
    (sel.league === 'ALL' || g.league === sel.league) &&
    sel.teams.has(g.team)
  )
}
