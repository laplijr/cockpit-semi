import { estimateRpe, matchActivity } from '../domain/matching/match-activity'
import type { CandidateSession } from '../domain/matching/match-activity'
import { addDays, type IsoDate } from '../domain/plan/calendar'
import type { Sport } from '../domain/shared/sport'
import type { Clock } from '../domain/shared/clock'
import { recordFeedback, type FeedbackGateway } from './record-feedback'

/**
 * Import d'activités déposées depuis une montre (§ 9, P6.7). Chaque fichier
 * passe par le rattachement de P2 puis par `recordFeedback` : le même chemin
 * que la saisie manuelle, aucun écriture directe du statut d'une séance.
 */

/** Ce qu'il est advenu d'un fichier, tel que le compte rendu le dit. */
export enum ImportOutcome {
  Linked = 'rattachee',
  Unplanned = 'hors_plan',
  Duplicate = 'deja_connue',
  Unreadable = 'illisible',
}

/** Une activité telle qu'un décodeur la rend ; le format reste dans l'infra. */
export interface ImportedActivityFile {
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

export interface ActivityRow extends ImportedActivityFile {
  rpe: number
  sessionId: number | null
}

export interface ActivityImportGateway {
  /** Identifiants déjà en base : ils rendent l'import idempotent. */
  knownExternalIds(ids: string[]): Promise<string[]>
  /** FC maximale déclarée, qui sert à déduire l'effort depuis la FC moyenne. */
  maxHeartRate(): Promise<number | null>
  candidateSessions(from: IsoDate, to: IsoDate): Promise<CandidateSession[]>
  saveActivity(row: ActivityRow): Promise<void>
  /** Code de la séance rattachée : l'écran le traduit, le serveur ne le fait pas. */
  sessionCode(sessionId: number): Promise<string | undefined>
  recomputeLoad(date: IsoDate): Promise<void>
}

export interface ImportLine {
  file: string
  outcome: ImportOutcome
  sport?: Sport
  date?: IsoDate
  durationS?: number
  distanceM?: number | null
  /** Séance à laquelle l'activité a été rattachée, quand il y en a une. */
  sessionCode?: string
}

export interface ImportReport {
  lines: ImportLine[]
  linked: number
  unplanned: number
  duplicates: number
  unreadable: number
}

/** Un fichier déposé, et ce que le décodeur en a tiré : rien s'il est illisible. */
export interface DecodedFile {
  name: string
  activity: ImportedActivityFile | undefined
}

function emptyReport(lines: ImportLine[]): ImportReport {
  const count = (outcome: ImportOutcome) => lines.filter((line) => line.outcome === outcome).length

  return {
    lines,
    linked: count(ImportOutcome.Linked),
    unplanned: count(ImportOutcome.Unplanned),
    duplicates: count(ImportOutcome.Duplicate),
    unreadable: count(ImportOutcome.Unreadable),
  }
}

/**
 * Importe un lot de fichiers déjà décodés. Un fichier illisible ne fait pas
 * échouer le lot, et un fichier déjà connu est reconnu et ignoré : on peut
 * vider le dossier `GARMIN/ACTIVITY/` entier sans y réfléchir.
 */
export async function importActivities(
  gateway: ActivityImportGateway,
  feedback: FeedbackGateway,
  clock: Clock,
  files: DecodedFile[],
): Promise<ImportReport> {
  const readable = files.filter(
    (file): file is DecodedFile & { activity: ImportedActivityFile } => file.activity !== undefined,
  )

  const lines: ImportLine[] = files
    .filter((file) => file.activity === undefined)
    .map((file) => ({ file: file.name, outcome: ImportOutcome.Unreadable }))

  if (readable.length === 0) return emptyReport(lines)

  const known = new Set(
    await gateway.knownExternalIds(readable.map((file) => file.activity.externalId)),
  )
  const dates = readable.map((file) => file.activity.date).sort()
  const [maxHr, candidates] = await Promise.all([
    gateway.maxHeartRate(),
    gateway.candidateSessions(addDays(dates[0]!, -1), addDays(dates.at(-1)!, 1)),
  ])

  const matched = new Set<number>()
  const touched = new Set<IsoDate>()

  for (const file of readable) {
    const activity = file.activity

    if (known.has(activity.externalId)) {
      lines.push({ file: file.name, outcome: ImportOutcome.Duplicate, ...summary(activity) })
      continue
    }
    known.add(activity.externalId)

    const result = matchActivity(
      activity,
      candidates.map((session) => ({
        ...session,
        alreadyMatched: session.alreadyMatched || matched.has(session.id),
      })),
      maxHr,
    )

    /** L'effort se déduit de la FC : l'import remplit le réalisé, pas le ressenti. */
    const rpe = estimateRpe(activity.averageHr, maxHr)
    const sessionId = result.kind === 'session' ? result.sessionId : null
    if (sessionId !== null) matched.add(sessionId)

    await gateway.saveActivity({ ...activity, rpe, sessionId })

    if (sessionId === null) {
      await gateway.recomputeLoad(activity.date)
      touched.add(activity.date)
      lines.push({ file: file.name, outcome: ImportOutcome.Unplanned, ...summary(activity) })
      continue
    }

    await recordFeedback(feedback, clock, {
      sessionId,
      rpe,
      /** Ni sensations ni sommeil ni douleur : un fichier ne les connaît pas. */
      sensations: [],
      sleepHours: null,
      pain: null,
      durationMin: Math.round(activity.durationS / 60),
      distanceM: activity.distanceM,
      notes: `Importé depuis la montre (${file.name})`,
    })

    touched.add(activity.date)
    lines.push({
      file: file.name,
      outcome: ImportOutcome.Linked,
      ...summary(activity),
      sessionCode: await gateway.sessionCode(sessionId),
    })
  }

  return emptyReport(lines)
}

function summary(activity: ImportedActivityFile) {
  return {
    sport: activity.sport,
    date: activity.date,
    durationS: activity.durationS,
    distanceM: activity.distanceM,
  }
}
