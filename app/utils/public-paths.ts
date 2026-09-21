/** Chemins joignables sans session : ce sont eux qui l'établissent (§ 9, P8.4). */
const PUBLIC_PATHS = ['/login']
const PUBLIC_PREFIXES = ['/rejoindre/']

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.includes(path) || PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))
}
