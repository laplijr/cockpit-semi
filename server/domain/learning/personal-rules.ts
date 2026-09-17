import { HabitType } from './habit'

/**
 * Ce qu'une habitude acceptée change dans le moteur (§ 5, R100+). Une règle
 * apprise ne peut que **déplacer ou adoucir** : elle ne dépasse jamais une
 * règle de sécurité R1–R8, elle en resserre le déclenchement ou elle se tait.
 */
export interface PersonalAdjustments {
  /** Familles de propositions que le moteur cesse de proposer (R104). */
  suppressed: { ruleId: string; effect: string }[]
  /** Une seule nuit courte suffit à déclencher R3, au lieu de deux (R103). */
  sleepSensitive: boolean
  /** Séances à replacer d'office, du jour prévu au jour réellement tenu (R100). */
  dayShifts: { code: string; fromWeekday: number; toWeekday: number }[]
  /** Jours où le moteur ne pose plus rien (R101). */
  deadWeekdays: number[]
  /** Correction du RPE attendu, par type de séance (R102). */
  rpeBias: { code: string; bias: number }[]
}

export interface AcceptedHabit {
  type: HabitType
  parameters: Record<string, number | string>
}

export const EMPTY_ADJUSTMENTS: PersonalAdjustments = {
  suppressed: [],
  sleepSensitive: false,
  dayShifts: [],
  deadWeekdays: [],
  rpeBias: [],
}

export function adjustmentsFrom(habits: AcceptedHabit[]): PersonalAdjustments {
  const of = (type: HabitType) => habits.filter((habit) => habit.type === type)

  return {
    suppressed: of(HabitType.ProposalRefusal).map((habit) => ({
      ruleId: String(habit.parameters.ruleId),
      effect: String(habit.parameters.effect),
    })),
    sleepSensitive: of(HabitType.SleepSensitivity).length > 0,
    dayShifts: of(HabitType.DayShift).map((habit) => ({
      code: String(habit.parameters.code),
      fromWeekday: Number(habit.parameters.fromWeekday),
      toWeekday: Number(habit.parameters.toWeekday),
    })),
    deadWeekdays: of(HabitType.DeadSlot).map((habit) => Number(habit.parameters.weekday)),
    rpeBias: of(HabitType.RpeBias).map((habit) => ({
      code: String(habit.parameters.code),
      bias: Number(habit.parameters.bias),
    })),
  }
}
