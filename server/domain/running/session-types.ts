import { PhaseType } from '../plan/phases'
import { TrainingZone, halfMarathonPace, paceFor, paceRangeFor } from '../fitness/vdot'
import type { Prescription, PrescriptionStep } from '../shared/prescription'

export type { Prescription, PrescriptionStep }

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

export interface PrescriptionContext {
  vdot: number
  /** Volume de course visé sur la semaine, en mètres. */
  weeklyVolumeM: number
  /** Distance visée pour cette séance ; à défaut, dérivée du volume hebdomadaire. */
  targetDistanceM?: number
  /** Position dans la phase, de 0 (début) à 1 (fin) : pilote la progression. */
  phaseProgress?: number
  /** Ajoute 6 × 100 m en fin d'endurance : les lignes droites ne sont plus une séance (§ 5). */
  withStrides?: boolean
  /** Termine la sortie longue par un tiers à allure semi, en phase spécifique (§ 5). */
  withHalfPaceFinish?: boolean
}

/** Distances exactes de l'échauffement et du retour au calme, quand la séance en porte. */
export const WARMUP_M = 2000
export const COOLDOWN_M = 1000

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

/** Dose minimale d'une répétition : en dessous, la séance n'a plus de sens. */
export const MIN_THRESHOLD_REP_S = 4 * 60
export const MIN_VMA_REP_M = 400

export const HILL_MIN_REPEATS = 6
export const HILL_MAX_REPEATS = 10

function clamp01(value: number | undefined): number {
  return Math.min(1, Math.max(0, value ?? 0))
}

/**
 * Palier de progression correspondant à la position dans la phase, borné par
 * le quota d'intensité : un quota est un plafond, pas un veto. Sur une petite
 * semaine on court le plus gros palier qui tient, pas rien du tout.
 */
function stageIndex(
  phaseProgress: number | undefined,
  volumes: readonly number[],
  budgetM: number,
): number {
  const wanted = Math.min(volumes.length - 1, Math.floor(clamp01(phaseProgress) * volumes.length))
  for (let index = wanted; index > 0; index--) {
    if (volumes[index]! <= budgetM) return index
  }
  return 0
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
  {
    vdot,
    weeklyVolumeM,
    targetDistanceM,
    phaseProgress,
    withStrides,
    withHalfPaceFinish,
  }: PrescriptionContext,
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
    case RunSessionCode.Endurance: {
      const steps: PrescriptionStep[] = [
        { label: 'Endurance', distanceM: target(0.15), paceSecPerKm: easy },
      ]
      if (withStrides) {
        steps.push({
          label: 'Lignes droites',
          intense: true,
          repeats: 6,
          distanceM: 100,
          paceSecPerKm: paceFor(vdot, TrainingZone.Repetition),
          recoveryS: 60,
        })
      }
      return steps
    }

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

    case RunSessionCode.LongRun: {
      const total = target(0.3)
      if (!withHalfPaceFinish) {
        return [{ label: 'Sortie longue', distanceM: total, paceSecPerKm: easy }]
      }

      // Le dernier tiers passe à allure semi, borné par le quota de qualité.
      const finish = Math.min(Math.round(total / 3), Math.round(weeklyVolumeM * 0.2))
      return [
        { label: 'Sortie longue', distanceM: total - finish, paceSecPerKm: easy },
        {
          label: 'Fin à allure semi',
          intense: true,
          distanceM: finish,
          paceSecPerKm: halfMarathonPace(vdot),
        },
      ]
    }

    case RunSessionCode.Threshold: {
      const thresholdPace = paceFor(vdot, TrainingZone.Threshold)
      const budget = weeklyVolumeM * 0.1
      const volumes = THRESHOLD_PROGRESSION.map(
        (item) => (item.repeats * item.durationS * 1000) / thresholdPace,
      )
      const stage = THRESHOLD_PROGRESSION[stageIndex(phaseProgress, volumes, budget)]!
      // La dose se réduit pour tenir dans le quota plutôt que de disparaître :
      // une petite semaine mérite un petit seuil, pas aucun.
      const durationS = Math.max(
        MIN_THRESHOLD_REP_S,
        Math.min(stage.durationS, Math.floor((budget * thresholdPace) / (stage.repeats * 1000))),
      )
      return [
        warmup,
        {
          label: 'Seuil',
          intense: true,
          repeats: stage.repeats,
          durationS,
          distanceM: Math.round((durationS * 1000) / thresholdPace),
          paceSecPerKm: thresholdPace,
          recoveryS: stage.repeats > 1 ? 120 : undefined,
        },
        cooldown,
      ]
    }

    case RunSessionCode.Vma: {
      const intervalPace = paceFor(vdot, TrainingZone.Interval)
      const budget = weeklyVolumeM * 0.08
      const volumes = VMA_PROGRESSION.map((item) => item.repeats * item.distanceM)
      const stage = VMA_PROGRESSION[stageIndex(phaseProgress, volumes, budget)]!
      const distanceM = Math.max(
        MIN_VMA_REP_M,
        Math.min(stage.distanceM, Math.floor(budget / stage.repeats / 100) * 100),
      )
      return [
        warmup,
        {
          label: 'Fractions',
          intense: true,
          repeats: stage.repeats,
          distanceM,
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
