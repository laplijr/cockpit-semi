/**
 * Le cockpit peut-il appeler le modèle ? Rempli au rendu serveur par
 * `plugins/capabilities.server.ts`. Faux par défaut : une fonction qu'on ne
 * sait pas disponible ne se propose pas.
 */
export function useLlmAvailable() {
  return useState('llm-available', () => false)
}
