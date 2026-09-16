import { PhaseType } from '../plan/phases'
import { TrainingZone, paceFor, paceRangeFor } from '../fitness/vdot'

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

export interface RunQuota {
  /** Part maximale du volume hebdomadaire de course. */
  maxShareOfWeeklyVolume?: number
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
    quota: { maxShareOfWeeklyVolume: 0.03 },
    allowedPhases: ENDURANCE_PHASES,
    expectedRpe: 4,
    key: false,
  },
  [RunSessionCode.LongRun]: {
    code: RunSessionCode.LongRun,
    label: 'Sortie longue',
    zone: TrainingZone.Easy,
    quota: { maxShareOfWeeklyVolume: 0.3, maxPerWeek: 1 },
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
    quota: { maxShareOfWeeklyVolume: 0.1, maxPerWeek: 1 },
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
    quota: { maxShareOfWeeklyVolume: 0.08, maxPerWeek: 1 },
    allowedPhases: [PhaseType.Development, PhaseType.Specific, PhaseType.Speed, PhaseType.Taper],
    expectedRpe: 8,
    key: true,
  },
  [RunSessionCode.HalfPace]: {
    code: RunSessionCode.HalfPace,
    label: 'Allure semi',
    zone: TrainingZone.Marathon,
    quota: { maxShareOfWeeklyVolume: 0.2, maxPerWeek: 1 },
    allowedPhases: [PhaseType.Specific, PhaseType.Taper],
    expectedRpe: 6,
    key: true,
  },
  [RunSessionCode.Hills]: {
    code: RunSessionCode.Hills,
    label: 'Côtes courtes',
    zone: TrainingZone.Repetition,
    quota: { maxShareOfWeeklyVolume: 0.06, maxPerWeek: 1 },
    allowedPhases: [PhaseType.Base, PhaseType.ShortBase, PhaseType.Development, PhaseType.Speed],
    expectedRpe: 8,
    key: true,
  },
  [RunSessionCode.Progressive]: {
    code: RunSessionCode.Progressive,
    label: 'Progressif',
    zone: TrainingZone.Marathon,
    quota: { maxShareOfWeeklyVolume: 0.15, maxPerWeek: 1 },
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

/** Distance maximale autorisée pour un type, à volume hebdomadaire donné. */
export function maxDistanceFor(code: RunSessionCode, weeklyVolumeM: number): number | undefined {
  const share = runSessionType(code).quota.maxShareOfWeeklyVolume
  return share === undefined ? undefined : weeklyVolumeM * share
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

export interface PrescriptionStep {
  label: string
  repeats?: number
  distanceM?: number
  durationS?: number
  paceSecPerKm?: number
  recoveryS?: number
}

export interface Prescription {
  code: RunSessionCode
  label: string
  totalDistanceM: number
  expectedRpe: number
  steps: PrescriptionStep[]
}

export interface PrescriptionContext {
  vdot: number
  /** Volume de course visé sur la semaine, en mètres. */
  weeklyVolumeM: number
}

const WARMUP_M = 2000
const COOLDOWN_M = 1000

function easyPace(vdot: number): number {
  return paceFor(vdot, TrainingZone.Easy)
}

/**
 * Structure concrète d'une séance : distances, répétitions et allures dérivées
 * du VDOT courant, bornées par le quota du type.
 */
export function prescription(code: RunSessionCode, context: PrescriptionContext): Prescription {
  const type = runSessionType(code)
  const cap = maxDistanceFor(code, context.weeklyVolumeM)
  const steps = buildSteps(code, context)
  const raw = steps.reduce((total, step) => total + (step.distanceM ?? 0) * (step.repeats ?? 1), 0)

  return {
    code,
    label: type.label,
    totalDistanceM: cap === undefined ? raw : Math.min(raw, cap),
    expectedRpe: type.expectedRpe,
    steps,
  }
}

function buildSteps(
  code: RunSessionCode,
  { vdot, weeklyVolumeM }: PrescriptionContext,
): PrescriptionStep[] {
  const easy = easyPace(vdot)
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
      return [
        { label: 'Endurance', distanceM: Math.round(weeklyVolumeM * 0.15), paceSecPerKm: easy },
      ]

    case RunSessionCode.Strides:
      return [
        { label: 'Endurance', distanceM: Math.round(weeklyVolumeM * 0.12), paceSecPerKm: easy },
        {
          label: 'Lignes droites',
          repeats: 6,
          distanceM: 100,
          paceSecPerKm: paceFor(vdot, TrainingZone.Repetition),
          recoveryS: 60,
        },
      ]

    case RunSessionCode.LongRun:
      return [
        { label: 'Sortie longue', distanceM: Math.round(weeklyVolumeM * 0.3), paceSecPerKm: easy },
      ]

    case RunSessionCode.Threshold: {
      const thresholdPace = paceFor(vdot, TrainingZone.Threshold)
      const budget = weeklyVolumeM * 0.1 - WARMUP_M - COOLDOWN_M
      const repeats = Math.max(2, Math.min(4, Math.round(budget / 1600)))
      return [
        warmup,
        {
          label: 'Seuil',
          repeats,
          durationS: 8 * 60,
          distanceM: Math.round((8 * 60 * 1000) / thresholdPace),
          paceSecPerKm: thresholdPace,
          recoveryS: 120,
        },
        cooldown,
      ]
    }

    case RunSessionCode.Vma: {
      const intervalPace = paceFor(vdot, TrainingZone.Interval)
      const budget = weeklyVolumeM * 0.08 - WARMUP_M - COOLDOWN_M
      const repeats = Math.max(4, Math.min(8, Math.round(budget / 800)))
      return [
        warmup,
        {
          label: 'Fractions',
          repeats,
          distanceM: 800,
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
          distanceM: Math.round(weeklyVolumeM * 0.2) - WARMUP_M - COOLDOWN_M,
          paceSecPerKm: paceFor(vdot, TrainingZone.Marathon),
        },
        cooldown,
      ]

    case RunSessionCode.Hills:
      return [
        warmup,
        {
          label: 'Côtes courtes',
          repeats: 10,
          durationS: 30,
          distanceM: 150,
          paceSecPerKm: paceFor(vdot, TrainingZone.Repetition),
          recoveryS: 90,
        },
        cooldown,
      ]

    case RunSessionCode.Progressive: {
      const { slowSecPerKm } = paceRangeFor(vdot, TrainingZone.Easy)
      const third = Math.round((weeklyVolumeM * 0.15) / 3)
      return [
        { label: 'Premier tiers', distanceM: third, paceSecPerKm: slowSecPerKm },
        { label: 'Deuxième tiers', distanceM: third, paceSecPerKm: easy },
        {
          label: 'Dernier tiers',
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
