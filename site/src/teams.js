// Retrosheet team codes -> display names (covers the 1910-2025 range, including
// the Athletics' ATH/OAK distinction and historical franchises).
export const TEAM_NAMES = {
  ANA: 'Angels', ARI: 'Diamondbacks', ATL: 'Braves', ATH: 'Athletics',
  BAL: 'Orioles', BOS: 'Red Sox', CHA: 'White Sox', CHN: 'Cubs',
  CIN: 'Reds', CLE: 'Guardians', COL: 'Rockies', DET: 'Tigers',
  HOU: 'Astros', KCA: 'Royals', LAN: 'Dodgers', LAA: 'Angels', MIA: 'Marlins',
  MIL: 'Brewers', MIN: 'Twins', NYA: 'Yankees', NYN: 'Mets',
  OAK: 'Athletics', PHI: 'Phillies', PIT: 'Pirates', SDN: 'Padres',
  SEA: 'Mariners', SFN: 'Giants', SLN: 'Cardinals', TBA: 'Rays',
  TEX: 'Rangers', TOR: 'Blue Jays', WAS: 'Nationals',
  // historical franchises that appear in the 1980-2025 range
  MON: 'Expos', FLO: 'Marlins', CAL: 'Angels',
  // pre-1980 historical franchises (relocations & defunct clubs)
  BRO: 'Dodgers (Brooklyn)', NY1: 'Giants (New York)',
  BSN: 'Braves (Boston)', MLN: 'Braves (Milwaukee)',
  PHA: 'Athletics (Philadelphia)', KC1: 'Athletics (Kansas City)',
  SLA: 'Browns (St. Louis)', SE1: 'Pilots (Seattle)',
  WS1: 'Senators (1901–60)', WS2: 'Senators (1961–71)',
}

export const teamName = (code) => TEAM_NAMES[code] || code
