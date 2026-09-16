/** Chemins qui doivent rester joignables sans session : ce sont eux qui l'établissent. */
const PUBLIC_PREFIXES = ['/api/auth/', '/api/_auth/']

/** Toutes les autres routes d'API exigent la session. */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return

  await requireUserSession(event)
})
