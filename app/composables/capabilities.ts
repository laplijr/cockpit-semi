/**
 * Ce que le cockpit peut appeler dehors, rempli au rendu serveur par
 * `plugins/capabilities.server.ts`. Faux par défaut : une fonction qu'on ne
 * sait pas disponible ne se propose pas. Les clés, elles, restent au serveur.
 */
export function useLlmAvailable() {
  return useState('llm-available', () => false)
}

/** Itinéraires GPX : OpenRouteService, une autre clé et la même règle. */
export function useRoutingAvailable() {
  return useState('routing-available', () => false)
}
