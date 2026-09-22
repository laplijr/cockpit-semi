import {
  PostSource,
  publishRace,
  publishSession,
  type PublishableSession,
} from '../domain/circle/post'
import { prescribedDurationS, type Prescription } from '../domain/shared/prescription'
import { insertPost, isMember, postFor } from '../infra/db/circle-gateway'
import type { Database } from '../infra/db/client'
import { ownedRace, ownedSession } from './scope'

/** Ce que la séance donne au domaine : son réalisé, et son prévu en repli. */
export function publishableSession(
  row: Awaited<ReturnType<typeof ownedSession>>,
): PublishableSession {
  const prescription = row.prescription as unknown as Prescription
  const plannedMin = Math.round(prescribedDurationS(prescription) / 60)

  return {
    id: row.id,
    sport: row.sport,
    code: row.code,
    date: row.date,
    status: row.status,
    actualDistanceM: row.actualDistanceM,
    actualDurationMin: row.actualDurationMin,
    plannedDistanceM: prescription.totalDistanceM || null,
    plannedDurationMin: plannedMin || prescription.durationMin || null,
  }
}

/**
 * Une séance faite va au cercle d'elle-même (§ 9, P12) : le choix s'est pris
 * une fois, en entrant dans le cercle, et ne se redemande pas à chaque séance.
 * Le post passe par la liste blanche de `domain/circle`, comme le geste manuel
 * qu'il remplace — c'est toujours la seule porte du mur (§ 1 principe 6).
 *
 * Appelée au moment où la séance passe « faite », et jamais sur une correction :
 * une séance masquée ne revient pas d'elle-même.
 */
export async function shareDoneSession(
  db: Database,
  athleteId: number,
  sessionId: number,
): Promise<void> {
  if (!(await isMember(db, athleteId))) return
  if (await postFor(db, athleteId, PostSource.Session, sessionId)) return

  const outcome = publishSession(
    publishableSession(await ownedSession(db, athleteId, sessionId)),
    null,
  )
  if (!outcome.ok) return

  await insertPost(db, athleteId, outcome.post)
}

/**
 * Une course courue suit la même règle que la séance : elle va au cercle
 * d'elle-même, une fois son chrono enregistré (§ 9, P12).
 */
export async function shareRacedRace(
  db: Database,
  athleteId: number,
  raceId: number,
): Promise<void> {
  if (!(await isMember(db, athleteId))) return
  if (await postFor(db, athleteId, PostSource.Race, raceId)) return

  const outcome = publishRace(await ownedRace(db, athleteId, raceId), null)
  if (!outcome.ok) return

  await insertPost(db, athleteId, outcome.post)
}
