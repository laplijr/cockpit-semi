/** La première utilisation réelle de `athlete.onboarded` (§ 9, P8.2). */
export const WELCOME_PATH = '/bienvenue'

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value || isPublicPath(to.path)) return

  const athlete = useAthleteStore()
  await athlete.ensureLoaded()

  if (!athlete.onboarded && to.path !== WELCOME_PATH) return navigateTo(WELCOME_PATH)
  if (athlete.onboarded && to.path === WELCOME_PATH) return navigateTo('/')
})
