import Table1 from './Table1.jsx'
import Table2to4 from './Table2to4.jsx'
import Table5 from './Table5.jsx'

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
]
