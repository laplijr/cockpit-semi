export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  if (!loggedIn.value && !isPublicPath(to.path)) {
    return navigateTo('/login')
  }

  if (loggedIn.value && isPublicPath(to.path)) {
    return navigateTo('/')
  }
})
