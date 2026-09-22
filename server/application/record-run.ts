import type { Pain, Sensation } from '../domain/load/feedback'
import { matchActivity } from '../domain/matching/match-activity'
import { addDays, type IsoDate } from '../domain/plan/calendar'
import type { Clock } from '../domain/shared/clock'
import { Sport } from '../domain/shared/sport'
import { FIX_TOLERANCE, type GeoFix } from '../domain/tracking/fix'
import { RunStatus } from '../domain/tracking/run'
import { measureTrack, type Track } from '../domain/tracking/track'

import type { ActivityImportGateway } from './import-activities'
import { recordFeedback, type FeedbackGateway } from './record-feedback'

/**
 * Une sortie courue dans l'app (§ 9, P10). L'enregistrement final ne prend
 * aucun chemin nouveau : l'activité passe par le rattachement de P2 puis par
 * `recordFeedback`, comme un fichier de montre et comme la saisie manuelle.
 */

/** Vitesse plausible selon le sport : c'est elle qui filtre les relevés (§ 9, P10.3). */
export function speedLimitFor(sport: Sport): number {
  return sport === Sport.Cycling ? FIX_TOLERANCE.cyclingMaxSpeedMS : FIX_TOLERANCE.maxSpeedMS
}

/** Préfixe des identifiants d'activité venus d'une capture dans l'app. */
export const RUN_EXTERNAL_PREFIX = 'cockpit:'

export interface StoredRun {
  id: number
  sessionId: number | null
  status: RunStatus
  /** Date locale de la sortie, donnée par l'appareil : lui seul connaît le fuseau. */
  date: IsoDate
  startedAt: Date
  fixes: GeoFix[]
}

export interface RunGateway {
  liveRun(): Promise<StoredRun | undefined>
  openRun(input: { sessionId: number | null; date: IsoDate; startedAt: Date }): Promise<StoredRun>
  loadRun(runId: number): Promise<StoredRun | undefined>
  saveFixes(runId: number, fixes: GeoFix[]): Promise<void>
  closeRun(runId: number, input: ClosedRun): Promise<void>
}

export interface ClosedRun {
  status: RunStatus
  endedAt: Date
  distanceM: number
  durationS: number
  elevationGainM: number
  activityId: number | null
}

export interface FinishRunInput {
  runId: number
  /** Relevés que l'appareil n'avait pas encore envoyés. */
  fixes: GeoFix[]
  rpe: number
  sensations: Sensation[]
  sleepHours: number | null
  pain: Pain | null
  notes: string | null
  /** Réalisé corrigé à la main, quand le GPS s'est trompé (§ 9, P10). */
  correctedDistanceM: number | null
  correctedDurationMin: number | null
}

export interface RunGateways {
  runs: RunGateway
  activities: ActivityImportGateway
  feedback: FeedbackGateway
}

export interface FinishRunResult {
  distanceM: number
  durationS: number
  sessionId: number | null
  sessionCode?: string
}

/** Sortie déjà ouverte, ou nouvelle : deux sorties en cours n'ont aucun sens. */
export async function startRun(
  gateway: RunGateway,
  input: { sessionId: number | null; date: IsoDate; startedAt: Date },
): Promise<StoredRun> {
  const live = await gateway.liveRun()
  if (live) return live
  return gateway.openRun(input)
}

/**
 * Point de reprise : les relevés sont écrits au fil de la sortie pour qu'un
 * onglet rechargé ou une batterie à plat ne perde pas la trace.
 */
export async function checkpointRun(
  gateway: RunGateway,
  runId: number,
  fixes: GeoFix[],
): Promise<Track> {
  const run = await liveOrFail(gateway, runId)
  const merged = mergeFixes(run.fixes, fixes)
  await gateway.saveFixes(runId, merged)
  return measureTrack(merged)
}

/** Sortie abandonnée : rien n'entre dans le réalisé, ni activité ni charge. */
export async function abandonRun(gateway: RunGateway, runId: number): Promise<void> {
  const run = await liveOrFail(gateway, runId)
  const track = measureTrack(run.fixes)

  await gateway.closeRun(runId, {
    status: RunStatus.Abandoned,
    endedAt: new Date(),
    distanceM: track.distanceM,
    durationS: track.elapsedS,
    elevationGainM: track.elevationGainM,
    activityId: null,
  })
}

/**
 * Fin de sortie : la trace devient une activité, la séance passe à « faite »
 * avec son réalisé et son ressenti, la charge se recalcule et les règles
 * s'évaluent. Le ressenti vient de l'écran — un GPS ne le connaît pas.
 */
export async function finishRun(
  gateways: RunGateways,
  clock: Clock,
  input: FinishRunInput,
): Promise<FinishRunResult> {
  const run = await liveOrFail(gateways.runs, input.runId)
  /** Le sport borne la vitesse plausible : une descente à vélo n'est pas un saut. */
  const sport =
    run.sessionId === null
      ? Sport.Running
      : ((await gateways.activities.sessionSport(run.sessionId)) ?? Sport.Running)

  const fixes = mergeFixes(run.fixes, input.fixes)
  const track = measureTrack(fixes, speedLimitFor(sport))

  if (track.distanceM < FIX_TOLERANCE.minRunM) {
    throw new Error('Sortie trop courte pour être enregistrée')
  }

  await gateways.runs.saveFixes(run.id, fixes)

  const distanceM = input.correctedDistanceM ?? track.distanceM
  const durationS = input.correctedDurationMin
    ? Math.round(input.correctedDurationMin * 60)
    : track.elapsedS

  const sessionId = await linkedSession(gateways.activities, run, durationS)
  const activityId = await gateways.activities.saveActivity({
    externalId: `${RUN_EXTERNAL_PREFIX}${run.id}`,
    sport,
    date: run.date,
    startedAt: run.startedAt,
    durationS,
    distanceM,
    elevationGainM: track.elevationGainM,
    averageHr: null,
    maxHr: null,
    rpe: input.rpe,
    sessionId,
  })

  if (sessionId === null) {
    await gateways.activities.recomputeLoad(run.date)
  } else {
    await recordFeedback(gateways.feedback, clock, {
      sessionId,
      rpe: input.rpe,
      sensations: input.sensations,
      sleepHours: input.sleepHours,
      pain: input.pain,
      durationMin: Math.round(durationS / 60),
      distanceM,
      notes: input.notes,
    })
  }

  await gateways.runs.closeRun(run.id, {
    status: RunStatus.Finished,
    endedAt: new Date(run.startedAt.getTime() + durationS * 1000),
    distanceM,
    durationS,
    elevationGainM: track.elevationGainM,
    activityId,
  })

  return {
    distanceM,
    durationS,
    sessionId,
    sessionCode: sessionId === null ? undefined : await gateways.activities.sessionCode(sessionId),
  }
}

/**
 * Séance de la sortie : celle depuis laquelle on est parti, sinon le
 * rattachement de P2 — une sortie libre peut tomber sur une séance prévue.
 */
async function linkedSession(
  gateway: ActivityImportGateway,
  run: StoredRun,
  durationS: number,
): Promise<number | null> {
  if (run.sessionId !== null) return run.sessionId

  const candidates = await gateway.candidateSessions(addDays(run.date, -1), addDays(run.date, 1))
  const result = matchActivity(
    {
      externalId: `${RUN_EXTERNAL_PREFIX}${run.id}`,
      sport: Sport.Running,
      date: run.date,
      durationS,
    },
    candidates,
  )

  return result.kind === 'session' ? result.sessionId : null
}

async function liveOrFail(gateway: RunGateway, runId: number): Promise<StoredRun> {
  const run = await gateway.loadRun(runId)
  if (!run) throw new Error(`Sortie ${runId} inconnue`)
  if (run.status !== RunStatus.Live) throw new Error(`Sortie ${runId} déjà close`)
  return run
}

/**
 * Les relevés se renvoient : un point de reprise qui n'a pas reçu sa réponse
 * repart au suivant. L'horodatage les dédoublonne, et l'ordre les remet en
 * suite — le domaine attend une trace chronologique.
 */
function mergeFixes(stored: GeoFix[], incoming: GeoFix[]): GeoFix[] {
  const byTimestamp = new Map(stored.map((fix) => [fix.at, fix]))
  for (const fix of incoming) byTimestamp.set(fix.at, fix)
  return [...byTimestamp.values()].sort((left, right) => left.at - right.at)
}
