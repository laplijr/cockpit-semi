/** Au-delà de cinq échecs dans la fenêtre, l'identifiant se ferme (P28). */
export const MAX_LOGIN_FAILURES = 5
export const LOGIN_WINDOW_MS = 15 * 60_000

export interface LoginAttempt {
  /** Échecs de la fenêtre, plus la tentative en cours : elle est comptée avant d'être jugée. */
  failures: number
  windowStart: Date
}

/** La fenêtre en cours commence après cette date ; avant, elle est échue et repart à un. */
export function windowCutoff(now: Date): Date {
  return new Date(now.getTime() - LOGIN_WINDOW_MS)
}

/**
 * Minutes à attendre avant de réessayer, ou nul quand la tentative peut être
 * jugée. Compter avant de juger, et non après un échec : des essais lancés en
 * parallèle liraient sinon tous le même compteur, sous la limite.
 */
export function lockedMinutes(attempt: LoginAttempt, now: Date): number | null {
  if (attempt.failures <= MAX_LOGIN_FAILURES) return null
  const remainingMs = attempt.windowStart.getTime() + LOGIN_WINDOW_MS - now.getTime()
  return Math.max(1, Math.ceil(remainingMs / 60_000))
}

export function lockMessage(minutes: number): string {
  return `Trop de tentatives. Réessaie dans ${minutes} minute${minutes > 1 ? 's' : ''}.`
}
