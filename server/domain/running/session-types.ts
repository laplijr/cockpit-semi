import { PhaseType } from '../plan/phases'
import { TrainingZone, halfMarathonPace, paceFor, paceRangeFor } from '../fitness/vdot'

export enum RunSessionCode {
  Endurance = 'EF',
  Strides = 'droites',
  LongRun = 'SL',
  Threshold = 'seuil',
  Vma = 'VMA',
  HalfPace = 'allure_semi',
  Hills = 'cotes',
  Progressive = 'progressif',
  Test = 'test',
}

/**
 * Assiette du quota. « I ≤ 8 %, T ≤ 10 % » (§ 8) portent sur la portion
 * intense de la séance, pas sur l'échauffement ni le retour au calme ;
 * la sortie longue, elle, est plafonnée dans son ensemble.
 */
export enum QuotaBasis {
  Total = 'total',
  Quality = 'qualite',
}

export interface RunQuota {
  /** Part maximale du volume hebdomadaire de course. */
  maxShareOfWeeklyVolume?: number
  basis?: QuotaBasis
  maxPerWeek?: number
}

export interface RunSessionType {
  code: RunSessionCode
  label: string
  /** Zone d'allure dominante, source des allures prescrites. */
  zone: TrainingZone
  quota: RunQuota
  allowedPhases: PhaseType[]
  expectedRpe: number
  /** Une séance clé structure la semaine et ne se déplace pas librement. */
  key: boolean
}

const ALL_PHASES = Object.values(PhaseType)

const ENDURANCE_PHASES = ALL_PHASES.filter((phase) => phase !== PhaseType.Transition)

export const RUN_SESSION_TYPES: Record<RunSessionCode, RunSessionType> = {
  [RunSessionCode.Endurance]: {
    code: RunSessionCode.Endurance,
    label: 'Endurance fondamentale',
    zone: TrainingZone.Easy,
    quota: {},
    allowedPhases: ENDURANCE_PHASES,
    expectedRpe: 3,
    key: false,
  },
  [RunSessionCode.Strides]: {
    code: RunSessionCode.Strides,
    label: 'Lignes droites et éducatifs',
    zone: TrainingZone.Repetition,
    quota: { maxShareOfWeeklyVolume: 0.03, basis: QuotaBasis.Quality },
    allowedPhases: ENDURANCE_PHASES,
    expectedRpe: 4,
    key: false,
  },
  [RunSessionCode.LongRun]: {
    code: RunSessionCode.LongRun,
    label: 'Sortie longue',
    zone: TrainingZone.Easy,
    quota: { maxShareOfWeeklyVolume: 0.3, basis: QuotaBasis.Total, maxPerWeek: 1 },
    allowedPhases: [
      PhaseType.Base,
      PhaseType.ShortBase,
      PhaseType.Development,
      PhaseType.Specific,
      PhaseType.Speed,
      PhaseType.Taper,
      PhaseType.Rebuild,
    ],
    expectedRpe: 5,
    key: true,
  },
  [RunSessionCode.Threshold]: {
    code: RunSessionCode.Threshold,
    label: 'Seuil',
    zone: TrainingZone.Threshold,
    quota: { maxShareOfWeeklyVolume: 0.1, basis: QuotaBasis.Quality, maxPerWeek: 1 },
    allowedPhases: [
      PhaseType.Development,
      PhaseType.Specific,
      PhaseType.Speed,
      PhaseType.Taper,
      PhaseType.Rebuild,
    ],
    expectedRpe: 7,
    key: true,
  },
  [RunSessionCode.Vma]: {
    code: RunSessionCode.Vma,
    label: 'VMA',
    zone: TrainingZone.Interval,
    quota: { maxShareOfWeeklyVolume: 0.08, basis: QuotaBasis.Quality, maxPerWeek: 1 },
    allowedPhases: [PhaseType.Development, PhaseType.Specific, PhaseType.Speed, PhaseType.Taper],
    expectedRpe: 8,
    key: true,
  },
  [RunSessionCode.HalfPace]: {
    code: RunSessionCode.HalfPace,
    label: 'Allure semi',
    zone: TrainingZone.Marathon,
    quota: { maxShareOfWeeklyVolume: 0.2, basis: QuotaBasis.Quality, maxPerWeek: 1 },
    allowedPhases: [PhaseType.Specific, PhaseType.Taper],
    expectedRpe: 6,
    key: true,
  },
  [RunSessionCode.Hills]: {
    code: RunSessionCode.Hills,
    label: 'Côtes courtes',
    zone: TrainingZone.Repetition,
    quota: { maxShareOfWeeklyVolume: 0.06, basis: QuotaBasis.Quality, maxPerWeek: 1 },
    allowedPhases: [PhaseType.Base, PhaseType.ShortBase, PhaseType.Development, PhaseType.Speed],
    expectedRpe: 8,
    key: true,
  },
  [RunSessionCode.Progressive]: {
    code: RunSessionCode.Progressive,
    label: 'Progressif',
    zone: TrainingZone.Marathon,
    quota: { maxShareOfWeeklyVolume: 0.15, basis: QuotaBasis.Quality, maxPerWeek: 1 },
    allowedPhases: [PhaseType.Base, PhaseType.Development, PhaseType.Specific, PhaseType.Rebuild],
    expectedRpe: 6,
    key: false,
  },
  [RunSessionCode.Test]: {
    code: RunSessionCode.Test,
    label: 'Test 20 minutes',
    zone: TrainingZone.Threshold,
    quota: { maxPerWeek: 1 },
    allowedPhases: ALL_PHASES,
    expectedRpe: 9,
    key: true,
  },
}

export function runSessionType(code: RunSessionCode): RunSessionType {
  return RUN_SESSION_TYPES[code]
}

/** Distance maximale soumise au quota, à volume hebdomadaire donné. */
export function maxDistanceFor(code: RunSessionCode, weeklyVolumeM: number): number | undefined {
  const share = runSessionType(code).quota.maxShareOfWeeklyVolume
  return share === undefined ? undefined : weeklyVolumeM * share
}

export function quotaBasisFor(code: RunSessionCode): QuotaBasis {
  return runSessionType(code).quota.basis ?? QuotaBasis.Total
}

export function respectsQuota(
  code: RunSessionCode,
  distanceM: number,
  weeklyVolumeM: number,
): boolean {
  const max = maxDistanceFor(code, weeklyVolumeM)
  return max === undefined || distanceM <= max + 1e-6
}

export function isAllowedInPhase(code: RunSessionCode, phase: PhaseType): boolean {
  return runSessionType(code).allowedPhases.includes(phase)
}

/**
 * Une semaine trop courte ne peut pas accueillir la dose minimale d'un type :
 * mieux vaut ne pas le programmer que de le prescrire hors quota.
 */
export function fitsInWeek(
  code: RunSessionCode,
  vdot: number,
  weeklyVolumeM: number,
  phaseProgress = 1,
): boolean {
  // Le palier le plus lourd de la progression doit tenir, pas seulement le premier.
  const result = prescription(code, { vdot, weeklyVolumeM, phaseProgress })
  const measured =
    quotaBasisFor(code) === QuotaBasis.Total ? result.totalDistanceM : result.qualityDistanceM
  return respectsQuota(code, measured, weeklyVolumeM)
}

export interface PrescriptionStep {
  label: string
  repeats?: number
  distanceM?: number
  durationS?: number
  paceSecPerKm?: number
  recoveryS?: number
  /** Portion soumise au quota d'intensité (§ 8). */
  intense?: boolean
}

export interface Prescription {
  code: RunSessionCode
  label: string
  totalDistanceM: number
  /** Distance de la portion intense, celle que le quota borne. */
  qualityDistanceM: number
  expectedRpe: number
  steps: PrescriptionStep[]
}

export interface PrescriptionContext {
  vdot: number
  /** Volume de course visé sur la semaine, en mètres. */
  weeklyVolumeM: number
  /** Distance visée pour cette séance ; à défaut, dérivée du volume hebdomadaire. */
  targetDistanceM?: number
  /** Position dans la phase, de 0 (début) à 1 (fin) : pilote la progression. */
  phaseProgress?: number
}

const WARMUP_M = 2000
const COOLDOWN_M = 1000

function easyPace(vdot: number): number {
  return paceFor(vdot, TrainingZone.Easy)
}

/** Progressions des séances clés au fil de la phase (§ 5). */
const THRESHOLD_PROGRESSION = [
  { repeats: 2, durationS: 8 * 60 },
  { repeats: 3, durationS: 8 * 60 },
  { repeats: 1, durationS: 20 * 60 },
] as const

const VMA_PROGRESSION = [
  { repeats: 4, distanceM: 800 },
  { repeats: 6, distanceM: 800 },
  { repeats: 5, distanceM: 1000 },
] as const

export const HILL_MIN_REPEATS = 6
export const HILL_MAX_REPEATS = 10

function clamp01(value: number | undefined): number {
  return Math.min(1, Math.max(0, value ?? 0))
}

/** Palier de progression correspondant à la position dans la phase. */
function stageIndex(phaseProgress: number | undefined, stages: number): number {
  return Math.min(stages - 1, Math.floor(clamp01(phaseProgress) * stages))
}

/** Nombre de répétitions tenant dans le quota, borné par le format de la séance. */
function repeatsWithin(budgetM: number, repeatM: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(budgetM / repeatM)))
}

/**
 * Structure concrète d'une séance : distances, répétitions et allures dérivées
 * du VDOT courant, bornées par le quota du type.
 */
export function prescription(code: RunSessionCode, context: PrescriptionContext): Prescription {
  const type = runSessionType(code)
  const cap = maxDistanceFor(code, context.weeklyVolumeM)
  const steps = buildSteps(code, context)
  const distanceOf = (list: PrescriptionStep[]) =>
    list.reduce((total, step) => total + (step.distanceM ?? 0) * (step.repeats ?? 1), 0)

  const total = distanceOf(steps)
  const quality = distanceOf(steps.filter((step) => step.intense))
  const capped =
    cap === undefined
      ? total
      : quotaBasisFor(code) === QuotaBasis.Total
        ? Math.min(total, cap)
        : total

  return {
    code,
    label: type.label,
    // Arrondi vers le bas : un arrondi supérieur ferait dépasser le quota d'un mètre.
    totalDistanceM: Math.floor(capped),
    qualityDistanceM: Math.floor(quality),
    expectedRpe: type.expectedRpe,
    steps,
  }
}

function buildSteps(
  code: RunSessionCode,
  { vdot, weeklyVolumeM, targetDistanceM, phaseProgress }: PrescriptionContext,
): PrescriptionStep[] {
  const easy = easyPace(vdot)
  /** Distance visée pour cette séance : celle demandée, sinon une part du volume. */
  const target = (fallbackShare: number) =>
    targetDistanceM ?? Math.round(weeklyVolumeM * fallbackShare)
  const warmup: PrescriptionStep = {
    label: 'Échauffement',
    distanceM: WARMUP_M,
    paceSecPerKm: easy,
  }
  const cooldown: PrescriptionStep = {
    label: 'Retour au calme',
    distanceM: COOLDOWN_M,
    paceSecPerKm: easy,
  }

  switch (code) {
    case RunSessionCode.Endurance:
      return [{ label: 'Endurance', distanceM: target(0.15), paceSecPerKm: easy }]

    case RunSessionCode.Strides:
      return [
        {
          label: 'Endurance',
          distanceM: Math.max(1000, target(0.12) - 600),
          paceSecPerKm: easy,
        },
        {
          label: 'Lignes droites',
          intense: true,
          repeats: repeatsWithin(weeklyVolumeM * 0.03, 100, 4, 6),
          distanceM: 100,
          paceSecPerKm: paceFor(vdot, TrainingZone.Repetition),
          recoveryS: 60,
        },
      ]

    case RunSessionCode.LongRun:
      return [{ label: 'Sortie longue', distanceM: target(0.3), paceSecPerKm: easy }]

    case RunSessionCode.Threshold: {
      const thresholdPace = paceFor(vdot, TrainingZone.Threshold)
      const stage = THRESHOLD_PROGRESSION[stageIndex(phaseProgress, THRESHOLD_PROGRESSION.length)]!
      return [
        warmup,
        {
          label: 'Seuil',
          intense: true,
          repeats: stage.repeats,
          durationS: stage.durationS,
          distanceM: Math.round((stage.durationS * 1000) / thresholdPace),
          paceSecPerKm: thresholdPace,
          recoveryS: stage.repeats > 1 ? 120 : undefined,
        },
        cooldown,
      ]
    }

    case RunSessionCode.Vma: {
      const intervalPace = paceFor(vdot, TrainingZone.Interval)
      const stage = VMA_PROGRESSION[stageIndex(phaseProgress, VMA_PROGRESSION.length)]!
      return [
        warmup,
        {
          label: 'Fractions',
          intense: true,
          repeats: stage.repeats,
          distanceM: stage.distanceM,
          paceSecPerKm: intervalPace,
          recoveryS: 150,
        },
        cooldown,
      ]
    }

    case RunSessionCode.HalfPace:
      return [
        warmup,
        {
          label: 'Allure semi',
          intense: true,
          distanceM: Math.max(2000, Math.round(weeklyVolumeM * 0.2) - WARMUP_M - COOLDOWN_M),
          paceSecPerKm: halfMarathonPace(vdot),
        },
        cooldown,
      ]

    case RunSessionCode.Hills:
      return [
        warmup,
        {
          // À l'effort : une côte ne se court pas à une allure de plaine.
          label: 'Côtes courtes, à l’effort',
          intense: true,
          repeats:
            HILL_MIN_REPEATS +
            Math.round((HILL_MAX_REPEATS - HILL_MIN_REPEATS) * clamp01(phaseProgress)),
          durationS: 30,
          distanceM: 150,
          recoveryS: 90,
        },
        cooldown,
      ]

    case RunSessionCode.Progressive: {
      const { slowSecPerKm } = paceRangeFor(vdot, TrainingZone.Easy)
      const third = Math.round(target(0.15) / 3)
      return [
        { label: 'Premier tiers', distanceM: third, paceSecPerKm: slowSecPerKm },
        { label: 'Deuxième tiers', distanceM: third, paceSecPerKm: easy },
        {
          label: 'Dernier tiers',
          intense: true,
          distanceM: third,
          paceSecPerKm: paceFor(vdot, TrainingZone.Marathon),
        },
      ]
    }

    case RunSessionCode.Test:
      return [
        warmup,
        {
          label: 'Test 20 minutes à effort contrôlé',
          durationS: 20 * 60,
          distanceM: Math.round((20 * 60 * 1000) / paceFor(vdot, TrainingZone.Threshold)),
          paceSecPerKm: paceFor(vdot, TrainingZone.Threshold),
        },
        cooldown,
      ]
  }
}
