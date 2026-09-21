import { SessionStatus } from '../plan/session'
import { RaceStatus } from '../races/race'
import { Sport } from '../shared/sport'

/** Ce dont une publication est née : une séance faite, une course courue. */
export enum PostSource {
  Session = 'seance',
  Race = 'course',
}

/**
 * La note est une légende, pas un billet : on publie une séance faite, pas un
 * texte (§ 8, P9). La borne n'est pas cosmétique — elle est ce qui empêche le
 * cercle de devenir une messagerie.
 */
export const MAX_NOTE_LENGTH = 280

/**
 * **La liste blanche.** Sept champs, et le post se construit depuis eux — il
 * ne se filtre jamais depuis une séance. La différence n'est pas de style :
 * une liste noire laisse passer la colonne qu'on ajoutera demain, une liste
 * blanche la refuse sans qu'on y pense (§ 1 principe 6, P9).
 */
export interface PostContent {
  sport: Sport
  /** Code de la bibliothèque ; nul pour une course, qui porte son nom. */
  code: string | null
  date: string
  /** Nom de la course ; nul pour une séance, que son code nomme déjà. */
  label: string | null
  distanceM: number | null
  durationMin: number | null
  note: string | null
}

export interface PublishedPost extends PostContent {
  source: PostSource
  sourceId: number
}

export type PublishOutcome = { ok: true; post: PublishedPost } | { ok: false; refusal: string }

/**
 * Séance telle que la publication a le droit de la lire. Les champs qui n'y
 * sont pas ne sont pas oubliés : ils sont refusés — ressenti, douleur,
 * sommeil, fréquence cardiaque, itinéraire, allures prescrites.
 */
export interface PublishableSession {
  id: number
  sport: Sport
  code: string
  date: string
  status: SessionStatus
  actualDistanceM: number | null
  actualDurationMin: number | null
  plannedDistanceM: number | null
  plannedDurationMin: number | null
}

export interface PublishableRace {
  id: number
  name: string
  date: string
  distanceM: number
  status: RaceStatus
  resultatS: number | null
}

export function publishSession(session: PublishableSession, note: string | null): PublishOutcome {
  if (session.status !== SessionStatus.Done) {
    return { ok: false, refusal: 'On ne publie qu’une séance faite.' }
  }

  const refusal = noteRefusal(note)
  if (refusal) return { ok: false, refusal }

  return {
    ok: true,
    post: {
      source: PostSource.Session,
      sourceId: session.id,
      sport: session.sport,
      code: session.code,
      date: session.date,
      label: null,
      /**
       * Le réalisé d'abord, le prévu ensuite : une séance de renforcement
       * n'a que sa durée prescrite, et c'est bien elle qui a eu lieu.
       */
      distanceM: session.actualDistanceM ?? session.plannedDistanceM,
      durationMin: session.actualDurationMin ?? session.plannedDurationMin,
      note: cleanNote(note),
    },
  }
}

export function publishRace(race: PublishableRace, note: string | null): PublishOutcome {
  if (race.status !== RaceStatus.Raced || race.resultatS === null) {
    return { ok: false, refusal: 'On ne publie qu’une course courue, avec son chrono.' }
  }

  const refusal = noteRefusal(note)
  if (refusal) return { ok: false, refusal }

  return {
    ok: true,
    post: {
      source: PostSource.Race,
      sourceId: race.id,
      sport: Sport.Running,
      code: null,
      date: race.date,
      label: race.name,
      distanceM: race.distanceM,
      durationMin: race.resultatS / 60,
      note: cleanNote(note),
    },
  }
}

export function cleanNote(note: string | null): string | null {
  const trimmed = note?.trim() ?? ''
  return trimmed.length === 0 ? null : trimmed
}

export function noteRefusal(note: string | null): string | undefined {
  const trimmed = cleanNote(note)
  if (trimmed && trimmed.length > MAX_NOTE_LENGTH) {
    return `Le mot tient en ${MAX_NOTE_LENGTH} caractères.`
  }
  return undefined
}

/** Un commentaire est une phrase, pas une page. */
export const MAX_COMMENT_LENGTH = 600

export function commentRefusal(text: string): string | undefined {
  const trimmed = text.trim()
  if (trimmed.length === 0) return 'Un commentaire vide ne dit rien.'
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return `Un commentaire tient en ${MAX_COMMENT_LENGTH} caractères.`
  }
  return undefined
}

/**
 * Bornes de la semaine affichée : le cercle est une semaine, pas un flux
 * (§ 8, P9). C'est l'axe qui borne la requête, et c'est pour ça qu'il existe.
 */
export interface CircleWeek {
  from: string
  to: string
}

export function weekOf(date: string): CircleWeek {
  const day = new Date(`${date}T00:00:00Z`)
  const weekday = (day.getUTCDay() + 6) % 7
  const monday = new Date(day.getTime() - weekday * 86_400_000)
  const sunday = new Date(monday.getTime() + 6 * 86_400_000)
  return { from: iso(monday), to: iso(sunday) }
}

export function shiftWeek(week: CircleWeek, weeks: number): CircleWeek {
  return weekOf(iso(new Date(`${week.from}T00:00:00Z`).getTime() + weeks * 7 * 86_400_000))
}

function iso(date: Date | number): string {
  return new Date(date).toISOString().slice(0, 10)
}
