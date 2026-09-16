/** Toutes les routes d'API exigent la session, sauf celles qui l'établissent. */
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/') || path.startsWith('/api/auth/')) return

  await requireUserSession(event)
})
