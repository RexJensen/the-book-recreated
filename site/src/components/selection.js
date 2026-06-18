import { useMemo, useState } from 'react'
import { teamName } from '../teams.js'

// Build the canonical (team, league, label) list from a dataset's groups,
// disambiguating display names shared by two codes (OAK vs ATH -> Athletics).
export function buildTeams(groups) {
  const seen = new Map()
  for (const g of groups) if (!seen.has(g.team)) seen.set(g.team, g.league)
  const nameCount = {}
  for (const code of seen.keys()) nameCount[teamName(code)] = (nameCount[teamName(code)] || 0) + 1
  return [...seen.entries()]
    .map(([team, league]) => ({
      team,
      league,
      label: nameCount[teamName(team)] > 1 ? `${teamName(team)} (${team})` : teamName(team),
    }))
    .sort((a, b) =>
      a.league === b.league ? a.label.localeCompare(b.label) : a.league.localeCompare(b.league),
    )
}

// Shared Seasons / League / Teams selection state, used by every table so the
// chosen filter carries across the whole site.
export function useSelection(seasonList, teamList) {
  const [seasons, setSeasons] = useState(() => new Set(seasonList))
  const [league, setLeague] = useState('ALL') // ALL | AL | NL
  const [teams, setTeams] = useState(() => new Set(teamList.map((t) => t.team)))

  const visibleTeams = useMemo(
    () => teamList.filter((t) => league === 'ALL' || t.league === league),
    [league, teamList],
  )

  const toggleSeason = (s) =>
    setSeasons((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next.size ? next : prev // never allow zero seasons
    })

  const changeLeague = (lg) => {
    setLeague(lg)
    setTeams(new Set(teamList.filter((t) => lg === 'ALL' || t.league === lg).map((t) => t.team)))
  }

  const toggleTeam = (team) =>
    setTeams((prev) => {
      const next = new Set(prev)
      next.has(team) ? next.delete(team) : next.add(team)
      return next
    })

  const selectAll = () => setTeams(new Set(visibleTeams.map((t) => t.team)))
  const selectNone = () => setTeams(new Set())

  const allVisibleSelected = visibleTeams.every((t) => teams.has(t.team))

  const seasonLabel =
    seasons.size === seasonList.length
      ? `${seasonList[0]}–${seasonList[seasonList.length - 1]}`
      : [...seasons].sort().join(', ')

  const teamLabel = allVisibleSelected
    ? league === 'ALL'
      ? 'All Teams'
      : `All ${league}`
    : `${teams.size} team${teams.size === 1 ? '' : 's'}`

  return {
    seasonList,
    seasons,
    league,
    teams,
    visibleTeams,
    toggleSeason,
    changeLeague,
    toggleTeam,
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
