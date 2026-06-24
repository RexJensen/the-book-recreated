import Table1 from './Table1.jsx'
import Table2to4 from './Table2to4.jsx'
import Table5 from './Table5.jsx'
import Table6 from './Table6.jsx'
import Table7 from './Table7.jsx'

// Add a new table here and it appears in the nav + on the home page automatically.
export const TABLES = [
  {
    path: 'table-1',
    num: '1',
    title: 'Run Expectancy by the 24 Base/Out States',
    blurb:
      'The expected runs scored from each base/out state to the end of the inning — the cornerstone table the rest of the book builds on.',
    Component: Table1,
  },
  {
    path: 'run-value',
    num: '2–4',
    title: 'Runs to End of Inning & Run Value, by Event',
    blurb:
      "Every event type ranked by its average runs to the end of the inning, the run expectancy of where it started, and the difference — the event's run value. Combines the book's Tables 2, 3 and 4.",
    Component: Table2to4,
  },
  {
    path: 'state-run-value',
    num: '5',
    title: 'Runs to End of Inning, by Base/Out State',
    blurb:
      'Pick an event (home run, single, strikeout…) and see its runs to the end of the inning, starting run expectancy, and run value broken out across all 24 base/out states.',
    Component: Table5,
  },
  {
    path: 'hr-run-value',
    num: '6',
    title: 'Transition Run Value, by Base/Out State',
    blurb:
      "A second, cleaner way to value an event: compare the run expectancy of the state it started in with the state it ended in (plus runs scored), instead of averaging actual runs to the end of the inning. Defaults to the home run, matching the book's Table 6.",
    Component: Table6,
  },
  {
    path: 'table-7',
    num: '7',
    title: 'Run Values By Event',
    blurb:
      "The Table 6 transition method applied to every event type, weighted by each event's observed start-to-end states to produce a single run value per event.",
    Component: Table7,
  },
]
