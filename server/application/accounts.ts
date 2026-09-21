import { randomBytes } from 'node:crypto'
import type { IsoDate } from '../domain/plan/calendar'

/** Durée de validité d'une invitation : au-delà, Ronan en régénère une. */
export const INVITATION_DAYS = 14

export const MIN_LOGIN_LENGTH = 3
export const MIN_PASSWORD_LENGTH = 10

/** Jeton d'invitation : 32 octets d'aléa, lisibles dans une URL. */
export function newInvitationToken(): string {
  return randomBytes(32).toString('base64url')
}

export function invitationExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITATION_DAYS * 86_400_000)
}

export interface InvitationRow {
  expiresAt: Date
  consumedAt: Date | null
}

/** Une invitation ne vaut qu'une fois, et pas indéfiniment. */
export function invitationRefusal(row: InvitationRow | undefined, now: Date): string | undefined {
  if (!row) return 'Cette invitation n’existe pas.'
  if (row.consumedAt !== null) return 'Cette invitation a déjà servi.'
  if (row.expiresAt <= now) return 'Cette invitation a expiré. Demande-en une autre.'
  return undefined
}

/** Ce que le compte accepte comme identifiant : rien d'exotique dans une URL. */
export function loginRefusal(login: string): string | undefined {
  if (login.length < MIN_LOGIN_LENGTH) {
    return `L’identifiant fait au moins ${MIN_LOGIN_LENGTH} caractères.`
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(login)) {
    return 'L’identifiant n’accepte que des minuscules, des chiffres, un point, un tiret ou un souligné.'
  }
  return undefined
}

export function passwordRefusal(password: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe fait au moins ${MIN_PASSWORD_LENGTH} caractères.`
  }
  return undefined
}

/** Ce que la page « Mes données » énumère, pour que personne n'ait à deviner. */
export interface StoredDataEntry {
  label: string
  why: string
}

export const STORED_DATA: StoredDataEntry[] = [
  {
    label: 'Prénom, date de naissance, poids, fréquence cardiaque maximale',
    why: 'L’âge sert à estimer la FC max, le poids sert aux repères de nutrition.',
  },
  {
    label: 'Adresse de départ des sorties',
    why: 'Point de départ des boucles proposées. Seule l’adresse quitte le serveur, vers le service d’itinéraires.',
  },
  {
    label: 'Jours disponibles, sports pratiqués, volumes, niveau déclaré',
    why: 'Ce dont le générateur a besoin pour poser une semaine type.',
  },
  {
    label: 'Courses, objectifs, résultats et points de forme',
    why: 'Le rétro-planning part de là, et la projection s’y recale.',
  },
  {
    label: 'Séances, ressentis, douleurs, heures de sommeil, séries de renforcement',
    why: 'Le réalisé : c’est lui qui fait bouger le plan et la forme du jour.',
  },
  {
    label: 'Propositions décidées et habitudes détectées',
    why: 'Les décisions sont le signal d’apprentissage ; rien n’est appliqué sans elles.',
  },
]

/** Jour de l'app au format ISO : les dates de quota s'y alignent. */
export type QuotaDay = IsoDate
