declare module '#auth-utils' {
  interface User {
    /** Compte de connexion (§ 9, P8.4). */
    id: number
    login: string
    /** Athlète dont ce compte pilote le cockpit. */
    athleteId: number
  }

  interface UserSession {
    loggedInAt: number
  }
}

export {}
