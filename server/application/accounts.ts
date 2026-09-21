import { randomBytes } from 'node:crypto'

/**
 * Jeton d'invitation : 32 octets d'aléa, lisibles dans une URL. Il vit ici et
 * non dans le domaine — `node:crypto` n'a rien à faire dans un module que le
 * navigateur peut se retrouver à charger (§ 3).
 */
export function newInvitationToken(): string {
  return randomBytes(32).toString('base64url')
}
