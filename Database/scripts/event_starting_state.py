#!/usr/bin/env python3
"""
Starting Run Expectancy, By Event  --  Tom Tango, "The Book", Table 3
("Runs To End Of Inning, By Event, Part 2").

Table 3 is Table 2 with one extra column: the average run expectancy of the
base/out state each event STARTED in. You get it by taking the Table 1 run
expectancy matrix, looking up the RE of the state at the start of every event,
and averaging across all occurrences of that event type.

To keep this correct under the site's season/league/team filters, we record --
per (season, team, event) -- the DISTRIBUTION of starting base/out states (a
count per state). In the browser the starting RE for any selection is then

    starting_RE[event] = sum_state( occurrences[event][state] * RE[state] )
                         / sum_state( occurrences[event][state] )

where RE[state] is the Table 1 matrix for that same selection. Both pieces are
additive across (season, team) groups, so any filter combination is exact.

We also record, per state, the SUM of runs to end of inning (not just the count).
That lets the site build Table 5 ("Runs To End Of Inning, By Base/Out State, For
<event>"): for a chosen event, the average runs-to-end-of-inning and run value of
each of the 24 starting states. The per-state [count, sumRuns] pairs are additive
across (season, team), so every filter combination stays exact.

Input : out/events_<year>.csv, out/team_league_all.csv
Output: out/event_states.json   (consumed by the site's Tables 3 and 5)
"""
import csv, glob, json, os, re
from collections import defaultdict

# reuse the exact event classification + helpers from Table 2
from runs_by_event import (OUT, CATS, load_team_league, scored, category)

STATE_KEY = lambda base, outs: base * 10 + outs  # matches the site's matrix keys


def process_season(path, season, groups):
    rows = []
    inn_runs_start, inn_runs_total, inn_outs_total = {}, defaultdict(int), defaultdict(int)

    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            gid = row["game_id"]
            half = (gid, row["inning"], row["bat_home"])
            runs_before = int(row["vis_score"]) + int(row["home_score"])
            runs_play = (scored(row["bat_dest"]) + scored(row["r1_dest"])
                         + scored(row["r2_dest"]) + scored(row["r3_dest"]))
            if half not in inn_runs_start:
                inn_runs_start[half] = runs_before
            inn_runs_total[half] += runs_play
            inn_outs_total[half] += int(row["event_outs"])

            base = (1 if row["r1"] else 0) | (2 if row["r2"] else 0) | (4 if row["r3"] else 0)
            outs = int(row["outs"])
            team = gid[:3] if row["bat_home"] == "1" else row["vis_team"]
            rows.append((half, runs_before, category(row), team, STATE_KEY(base, outs)))

    for half, runs_before, cat, team, skey in rows:
        if inn_outs_total[half] != 3:
            continue
        runs_roi = (inn_runs_start[half] + inn_runs_total[half]) - runs_before
        ev = groups[(season, team)][cat]
        ev["count"] += 1
        ev["sumRuns"] += runs_roi
        st = ev["states"][skey]   # [count, sumRuns] for this starting base/out state
        st[0] += 1
        st[1] += runs_roi


def main():
    team_league = load_team_league()

    def new_event():
        # states maps base/out state -> [count, sumRuns] (runs to end of inning)
        return {"count": 0, "sumRuns": 0.0, "states": defaultdict(lambda: [0, 0])}

    groups = defaultdict(lambda: defaultdict(new_event))

    files = sorted(glob.glob(os.path.join(OUT, "events_*.csv")))
    seasons = []
    for path in files:
        season = int(re.search(r"events_(\d{4})\.csv", os.path.basename(path)).group(1))
        seasons.append(season)
        process_season(path, season, groups)
    seasons.sort()

    group_list = []
    for (season, team) in sorted(groups):
        events = {}
        for cat, ev in groups[(season, team)].items():
            events[cat] = {
                "count": ev["count"],
                "sumRuns": round(ev["sumRuns"], 4),
                # per starting base/out state: [count, runs to end of inning]
                "states": {str(k): [c, int(r)] for k, (c, r) in sorted(ev["states"].items())},
            }
        group_list.append({"season": season, "team": team,
                           "league": team_league.get((season, team), "?"),
                           "events": events})

    dataset = {
        "meta": {
            "title": "Starting Run Expectancy, By Event",
            "source": "Retrosheet event files parsed with Chadwick cwevent, computed locally",
            "method": ("for every occurrence of an event, the run expectancy of the base/out "
                       "state it started in (Table 1 matrix), averaged; complete (3-out) innings only"),
            "seasons": seasons,
            "categories": CATS,
        },
        "groups": group_list,
    }
    path = os.path.join(OUT, "event_states.json")
    with open(path, "w") as f:
        json.dump(dataset, f, separators=(",", ":"))
    size = os.path.getsize(path)
    print(f"Wrote {path}  ({size/1024:.0f} KB, {len(group_list)} groups, seasons {seasons})")


if __name__ == "__main__":
    main()
