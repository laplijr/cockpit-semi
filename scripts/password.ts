import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

/**
 * La même empreinte que `hashPassword` de nuxt-auth-utils, qui s'appuie sur
 * ce pilote-là. Les scripts tournent hors de Nitro et n'ont pas ses
 * auto-imports : ils passent par la bibliothèque directement plutôt que de
 * réécrire un format que la vérification devrait deviner (§ 9, P8.4).
 */
const hasher = new Hash(new Scrypt({}))

export function hashPassword(password: string): Promise<string> {
  return hasher.make(password)
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return hasher.verify(hash, password)
}
