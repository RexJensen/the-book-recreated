// Retrosheet team codes -> display names (covers the 1980-2025 range, including
// the Athletics' ATH/OAK distinction and historical franchises).
export const TEAM_NAMES = {
  ANA: 'Angels', ARI: 'Diamondbacks', ATL: 'Braves', ATH: 'Athletics',
  BAL: 'Orioles', BOS: 'Red Sox', CHA: 'White Sox', CHN: 'Cubs',
  CIN: 'Reds', CLE: 'Guardians', COL: 'Rockies', DET: 'Tigers',
  HOU: 'Astros', KCA: 'Royals', LAN: 'Dodgers', MIA: 'Marlins',
  MIL: 'Brewers', MIN: 'Twins', NYA: 'Yankees', NYN: 'Mets',
  OAK: 'Athletics', PHI: 'Phillies', PIT: 'Pirates', SDN: 'Padres',
  SEA: 'Mariners', SFN: 'Giants', SLN: 'Cardinals', TBA: 'Rays',
  TEX: 'Rangers', TOR: 'Blue Jays', WAS: 'Nationals',
  // historical franchises that appear in the 1980-2025 range
  MON: 'Expos', FLO: 'Marlins', CAL: 'Angels',
}

export const teamName = (code) => TEAM_NAMES[code] || code
