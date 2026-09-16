declare module '#auth-utils' {
  interface User {
    name: string
  }

  interface UserSession {
    loggedInAt: number
  }
}

export {}
