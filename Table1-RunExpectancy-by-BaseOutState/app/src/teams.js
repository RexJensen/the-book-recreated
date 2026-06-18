// Retrosheet team codes -> display names (covers 2021-2025 codes incl. the
// Athletics' ATH/OAK distinction).
export const TEAM_NAMES = {
  ANA: 'Angels', ARI: 'Diamondbacks', ATL: 'Braves', ATH: 'Athletics',
  BAL: 'Orioles', BOS: 'Red Sox', CHA: 'White Sox', CHN: 'Cubs',
  CIN: 'Reds', CLE: 'Guardians', COL: 'Rockies', DET: 'Tigers',
  HOU: 'Astros', KCA: 'Royals', LAN: 'Dodgers', MIA: 'Marlins',
  MIL: 'Brewers', MIN: 'Twins', NYA: 'Yankees', NYN: 'Mets',
  OAK: 'Athletics', PHI: 'Phillies', PIT: 'Pirates', SDN: 'Padres',
  SEA: 'Mariners', SFN: 'Giants', SLN: 'Cardinals', TBA: 'Rays',
  TEX: 'Rangers', TOR: 'Blue Jays', WAS: 'Nationals',
}

export const teamName = (code) => TEAM_NAMES[code] || code
