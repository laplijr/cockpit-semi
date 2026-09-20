import type { CycleSessionCode } from '../cycling/session-types'
import { freeCyclingPrescription } from '../cycling/session-types'
import { TrainingZone, paceFor } from '../fitness/vdot'
import type { PauseAllowances } from '../pause/pause'
import { RacePriority } from '../races/race'
import { MIN_HOURS_BETWEEN_KEY_SESSIONS } from '../rules/rules'
import type { RunSessionCode } from '../running/session-types'
import {
  QuotaBasis,
  prescription,
  quotaBasisFor,
  respectsQuota,
  runSessionType,
} from '../running/session-types'
import type { Prescription } from '../shared/prescription'
import { Sport } from '../shared/sport'
import type { IsoDate } from './calendar'
import { addDays } from './calendar'
import { SessionStatus, type PlannedSessionRecord } from './session'

/** Les trois gestes de la main : une séance change, disparaît ou apparaît. */
export enum EditKind {
  Replace = 'remplacer',
  Cancel = 'retirer',
  Add = 'ajouter',
}

/** Durée minimale d'une séance posée à la main : sous ça, rien à poser. */
export const MIN_MANUAL_MIN = 20

/** Ce que Ronan demande : un sport, un type de la bibliothèque, une taille. */
export interface SessionDraft {
  sport: Sport.Running | Sport.Cycling
  code: string
  /** Taille de la séance : une distance pour la course, une durée sinon. */
  distanceM?: number
  durationMin?: number
}

export interface EditTarget {
  kind: EditKind
  date: IsoDate
  today: IsoDate
  /** Séance visée par un remplacement ou un retrait. */
  session?: Pick<PlannedSessionRecord, 'status'>
  /** Vrai quand une semaine du plan actif couvre la date. */
  withinPlan: boolean
}

/**
 * Les seuls refus durs : ils protègent la donnée, jamais l'entraînement. Tout
 * ce qui relève de l'entraînement est un avertissement (§ 5, P6.43).
 */
export function editRefusal(target: EditTarget): string | undefined {
  if (!target.withinPlan) return 'Cette date est hors du plan actif.'

  if (target.kind === EditKind.Add) {
    return target.date < target.today
      ? 'Une séance ne s’ajoute pas dans le passé : une activité déjà faite se déclare dans l’Imprévu.'
      : undefined
  }

  const status = target.session?.status
  if (status === SessionStatus.Done) return 'Une séance déjà faite ne se change pas.'
  if (status === SessionStatus.Cancelled) return 'Cette séance est déjà retirée.'

  return undefined
}

export enum EditWarning {
  OverWeeklyTarget = 'volume_au_dessus_de_la_cible',
  BelowWeeklyTarget = 'volume_sous_la_cible',
  OverWeeklyIncrease = 'montee_hebdomadaire_depassee',
  OverIntensityQuota = 'quota_intensite_depasse',
  KeySessionsTooClose = 'seances_cles_rapprochees',
  RaceDay = 'jour_de_course',
  DayAfterRaceA = 'lendemain_course_a',
  ForbiddenByPause = 'interdit_par_la_pause',
}

export interface EditNotice {
  code: EditWarning
  text: string
}

export interface EditImpact {
  runBeforeM: number
  runAfterM: number
  targetRunM: number
  notices: EditNotice[]
}

export interface ImpactInput {
  date: IsoDate
  /** Séances de la semaine avant l'édition, et après : la différence est le coût. */
  before: PlannedSessionRecord[]
  after: PlannedSessionRecord[]
  targetRunM: number
  /** Volume de course visé la semaine précédente ; la montée se mesure sur lui. */
  previousWeekRunM: number | null
  maxWeeklyIncreasePct: number
  races: { date: IsoDate; priority: RacePriority }[]
  /** Autorisations de la pause en cours, quand il y en a une. */
  allowances?: PauseAllowances
  /** Séance posée ou modifiée par l'édition ; absente pour un retrait. */
  posed?: PlannedSessionRecord
}

/** Marge sous laquelle un écart à la cible ne mérite pas d'être signalé. */
const TARGET_TOLERANCE = 0.05

const HOURS_PER_DAY = 24

function runVolume(sessions: PlannedSessionRecord[]): number {
  return sessions
    .filter((item) => item.sport === Sport.Running)
    .filter((item) => item.status !== SessionStatus.Cancelled)
    .reduce((total, item) => total + item.prescription.totalDistanceM, 0)
}

function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

/** Pourcentage arrondi, pour une phrase lisible plutôt qu'un chiffre exact. */
function percent(value: number, of: number): number {
  return Math.round((value / of - 1) * 100)
}

/**
 * Ce que l'édition coûte, en volume et en règles du § 5 enfreintes. Rien ici
 * ne bloque : le moteur dit, Ronan décide (§ 1, P6.43).
 */
export function editImpact(input: ImpactInput): EditImpact {
  const runBeforeM = runVolume(input.before)
  const runAfterM = runVolume(input.after)
  const notices: EditNotice[] = []

  const add = (code: EditWarning, text: string) => notices.push({ code, text })

  if (runAfterM > input.targetRunM * (1 + TARGET_TOLERANCE)) {
    add(
      EditWarning.OverWeeklyTarget,
      `La semaine passe à ${percent(runAfterM, input.targetRunM)} % au-dessus de son volume de course visé.`,
    )
  } else if (runAfterM < input.targetRunM * (1 - TARGET_TOLERANCE)) {
    add(
      EditWarning.BelowWeeklyTarget,
      `La semaine tombe à ${-percent(runAfterM, input.targetRunM)} % sous son volume de course visé.`,
    )
  }

  const ceiling =
    input.previousWeekRunM === null
      ? null
      : input.previousWeekRunM * (1 + input.maxWeeklyIncreasePct / 100)
  if (ceiling !== null && runAfterM > ceiling && runAfterM > runBeforeM) {
    add(
      EditWarning.OverWeeklyIncrease,
      `La montée dépasse les ${input.maxWeeklyIncreasePct} % par semaine de ton profil.`,
    )
  }

  const posed = input.posed
  if (posed && posed.sport === Sport.Running) {
    const code = posed.code as RunSessionCode
    const measured =
      quotaBasisFor(code) === QuotaBasis.Total
        ? posed.prescription.totalDistanceM
        : posed.prescription.qualityDistanceM
    if (runSessionType(code) && !respectsQuota(code, measured, runAfterM)) {
      add(
        EditWarning.OverIntensityQuota,
        'Cette séance fait dépasser le quota d’intensité de la semaine (§ 5).',
      )
    }

    if (posed.key) {
      const gap = MIN_HOURS_BETWEEN_KEY_SESSIONS / HOURS_PER_DAY
      const crowded = input.after
        .filter((item) => item.key && item.id !== posed.id)
        .filter((item) => item.status !== SessionStatus.Cancelled)
        .some((item) => Math.abs(daysBetween(item.date, posed.date)) < gap)
      if (crowded) {
        add(
          EditWarning.KeySessionsTooClose,
          'Moins de 48 h la séparent d’une autre séance clé de la semaine.',
        )
      }
    }

    if (input.allowances && !input.allowances.running) {
      add(EditWarning.ForbiddenByPause, 'La pause en cours interdit la course à pied.')
    }
  }

  if (posed && input.allowances && posed.sport === Sport.Cycling && !input.allowances.cycling) {
    add(EditWarning.ForbiddenByPause, 'La pause en cours interdit le vélo.')
  }

  if (posed) {
    if (input.races.some((race) => race.date === input.date)) {
      add(
        EditWarning.RaceDay,
        'Une course est prévue ce jour-là : il ne porte aucune séance (§ 5).',
      )
    }

    const afterRaceA = input.races
      .filter((race) => race.priority === RacePriority.A)
      .some((race) => addDays(race.date, 1) === input.date)
    if (afterRaceA) {
      add(EditWarning.DayAfterRaceA, 'C’est le lendemain d’une course A, prévu en repos (§ 5).')
    }
  }

  return { runBeforeM, runAfterM, targetRunM: input.targetRunM, notices }
}

export interface DraftContext {
  vdot: number
  targetRunM: number
}

/**
 * La structure de la séance demandée, toujours construite par la bibliothèque
 * du sport : Ronan choisit le sport, le type et la taille, le § 5 garde la
 * forme. Une durée de course se lit en distance à l'allure E.
 */
export function draftPrescription(draft: SessionDraft, context: DraftContext): Prescription {
  if (draft.sport === Sport.Cycling) {
    return freeCyclingPrescription(
      draft.code as CycleSessionCode,
      draft.durationMin ?? MIN_MANUAL_MIN,
    )
  }

  const easyPace = paceFor(context.vdot, TrainingZone.Easy)
  const distanceM =
    draft.distanceM ?? Math.round(((draft.durationMin ?? MIN_MANUAL_MIN) * 60 * 1000) / easyPace)

  return prescription(draft.code as RunSessionCode, {
    vdot: context.vdot,
    weeklyVolumeM: context.targetRunM,
    targetDistanceM: distanceM,
  })
}

/** Une séance posée à la main est clé quand son type l'est (§ 5). */
export function draftIsKey(draft: SessionDraft): boolean {
  if (draft.sport !== Sport.Running) return false
  return runSessionType(draft.code as RunSessionCode)?.key ?? false
}
