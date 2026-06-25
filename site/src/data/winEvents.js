// Loads the large all-game event transition dataset for Table 11. This stays
// in /public so Vite does not bundle a 90 MiB JSON asset into application JS.
let promise

export function loadWinEvents() {
  if (!promise) {
    promise = fetch(`${import.meta.env.BASE_URL}win_events.json`).then((r) => {
      if (!r.ok) throw new Error(`Failed to load win_events.json (${r.status})`)
      return r.json()
    })
  }
  return promise
}
