import { Decoder, Stream } from '@garmin/fitsdk'
import type { IsoDate } from '../../domain/plan/calendar'
import { Sport } from '../../domain/shared/sport'

/**
 * Décode une activité `.FIT` écrite par une montre (§ 9, P6.7). Un fichier
 * illisible ou d'un sport inconnu est ignoré, jamais levé en erreur : un lot
 * de vingt fichiers ne doit pas échouer parce que l'un d'eux est corrompu.
 */

/** Sport FIT → sport du cockpit. Ce qui n'est pas là n'est pas importé. */
const SPORTS: Record<string, Sport> = {
  running: Sport.Running,
  cycling: Sport.Cycling,
  training: Sport.Strength,
}

export interface DecodedActivity {
  /** Identifiant stable du fichier : l'import est idempotent grâce à lui. */
  externalId: string
  sport: Sport
  date: IsoDate
  startedAt: Date
  durationS: number
  distanceM: number | null
  elevationGainM: number | null
  averageHr: number | null
  maxHr: number | null
}

interface SessionMesg {
  sport?: string
  startTime?: Date | string
  totalTimerTime?: number
  totalElapsedTime?: number
  totalDistance?: number
  totalAscent?: number
  avgHeartRate?: number
  maxHeartRate?: number
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null
}

/**
 * Deux fichiers différents ne peuvent pas porter le même identifiant : le
 * sport, l'instant de départ et la durée suffisent, et deux exports du même
 * entraînement se reconnaissent donc l'un l'autre.
 */
function identityOf(sport: Sport, startedAt: Date, durationS: number): string {
  return `fit:${sport}:${startedAt.toISOString()}:${durationS}`
}

/**
 * Le résumé d'une activité, lu dans son message `session`. Rien n'est lu des
 * points de trace : la charge se calcule sur la durée et l'effort, pas sur la
 * position.
 */
export function decodeActivity(bytes: Uint8Array): DecodedActivity | undefined {
  let messages
  try {
    const decoder = new Decoder(Stream.fromByteArray(bytes))
    if (!decoder.checkIntegrity()) return undefined
    messages = decoder.read().messages
  } catch {
    return undefined
  }

  const summary = (messages.sessionMesgs ?? [])[0] as SessionMesg | undefined
  if (!summary) return undefined

  const sport = SPORTS[summary.sport ?? '']
  if (!sport) return undefined

  const startedAt = new Date(summary.startTime ?? Number.NaN)
  if (Number.isNaN(startedAt.getTime())) return undefined

  const durationS = Math.round(summary.totalTimerTime ?? summary.totalElapsedTime ?? 0)
  if (durationS <= 0) return undefined

  return {
    externalId: identityOf(sport, startedAt, durationS),
    sport,
    date: startedAt.toISOString().slice(0, 10),
    startedAt,
    durationS,
    distanceM: numberOrNull(summary.totalDistance),
    elevationGainM: numberOrNull(summary.totalAscent),
    averageHr: numberOrNull(summary.avgHeartRate),
    maxHr: numberOrNull(summary.maxHeartRate),
  }
}
