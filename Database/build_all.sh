#!/usr/bin/env bash
# Build the full Retrosheet -> run-expectancy pipeline for a range of seasons.
#
#   ./build_all.sh [START_YEAR] [END_YEAR]      (defaults: 1980 2025)
#
# For each season it downloads the Retrosheet event zip (if not already present),
# extracts it, converts the event files to a flat CSV with Chadwick `cwevent`,
# then runs the three Python aggregators to (re)build the JSON datasets the site
# consumes. Re-running is safe: existing downloads/extractions are reused.
set -uo pipefail
cd "$(dirname "$0")"
DB="$(pwd)"

START="${1:-1980}"
END="${2:-2025}"

FIELDS="0,1,2,3,4,8,9,26,27,28,34,35,38,40,48,58,59,60,61"
HDR="game_id,vis_team,inning,bat_home,outs,vis_score,home_score,r1,r2,r3,event_cd,bat_event_fl,sh_fl,event_outs,bunt_fl,bat_dest,r1_dest,r2_dest,r3_dest"

mkdir -p out
: > out/team_league_all.csv   # rebuilt fresh every run

for ((y=START; y<=END; y++)); do
  mkdir -p "raw/$y"
  # download + extract if we don't already have this season's event files
  if ! ls "raw/$y/${y}"*.EV? >/dev/null 2>&1; then
    echo "[$y] downloading…"
    curl -s -m 240 -o "raw/$y/${y}eve.zip" "https://www.retrosheet.org/events/${y}eve.zip"
    ( cd "raw/$y" && unzip -o -q "${y}eve.zip" && rm -f "${y}eve.zip" )
  fi

  # convert to flat CSV
  echo "$HDR" > "out/events_${y}.csv"
  ( cd "raw/$y" && cwevent -y "$y" -f "$FIELDS" "${y}"*.EVA "${y}"*.EVN 2>/dev/null ) >> "out/events_${y}.csv" || true

  # team -> league map (file extension encodes the home team's league)
  for f in "raw/$y/${y}"*.EVA; do [ -e "$f" ] && echo "${y},$(basename "$f" | cut -c5-7),AL"; done >> "$DB/out/team_league_all.csv"
  for f in "raw/$y/${y}"*.EVN; do [ -e "$f" ] && echo "${y},$(basename "$f" | cut -c5-7),NL"; done >> "$DB/out/team_league_all.csv"

  n=$(( $(wc -l < "out/events_${y}.csv") - 1 ))
  echo "[$y] $n events"
done

echo "=== aggregating ==="
python3 scripts/run_expectancy.py
python3 scripts/runs_by_event.py
python3 scripts/event_starting_state.py
echo "=== done ($START-$END) ==="
