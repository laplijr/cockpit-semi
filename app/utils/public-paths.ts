/** Chemins joignables sans session : ce sont eux qui l'établissent (§ 9, P8.4). */
const PUBLIC_PATHS = ['/login']
const PUBLIC_PREFIXES = ['/rejoindre/']

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.includes(path) || PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))
}

/**
 * Déjà connecté, la page de connexion n'a plus rien à dire : on retourne au
 * cockpit. Une invitation, si : quelqu'un qui a déjà un compte et clique sur
 * un lien reçu doit lire pourquoi il ne se passe rien, pas se retrouver
 * silencieusement chez lui (§ 9, P8.4).
 */
export function redirectsWhenLoggedIn(path: string): boolean {
  return PUBLIC_PATHS.includes(path)
}
