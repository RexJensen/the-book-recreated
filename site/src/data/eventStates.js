// Loads the large event-states dataset (Tables 2-7) as a static asset served
// from /public, instead of importing it as a module. At ~26 MB across all
// Retrosheet seasons (1910-2025), letting Vite transform it into a JS module
// blows the build's heap and ships a giant JS chunk; fetching the raw JSON
// sidesteps both. The promise is cached so moving between Tables 2-7 only
// fetches once.
let promise

export function loadEventStates() {
  if (!promise) {
    promise = fetch(`${import.meta.env.BASE_URL}event_states.json`).then((r) => {
      if (!r.ok) throw new Error(`Failed to load event_states.json (${r.status})`)
      return r.json()
    })
  }
  return promise
}
