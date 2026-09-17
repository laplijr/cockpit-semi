import type { IsoDate } from '../plan/calendar'

/**
 * Calibration hebdomadaire (§ 5) : trois mesures de l'écart entre ce que le
 * moteur annonce et ce qui arrive. Elle ne corrige rien toute seule — elle dit
 * de combien le moteur se trompe, et dans quel sens.
 */
export interface Calibration {
  date: IsoDate
  /** Écart moyen RPE ressenti − RPE prévu ; positif = plus dur que prévu. */
  rpeError: number
  /** Part des propositions acceptées, 0 à 1 ; nulle sans décision. */
  acceptanceRate: number | null
  /** Écart moyen projection − résultat sur les tests, en points de VDOT. */
  projectionGap: number | null
  samples: { rpe: number; decisions: number; tests: number }
}

export interface CalibrationInput {
  date: IsoDate
  /** Un couple (prévu, ressenti) par séance notée de la période. */
  rpe: { expected: number; felt: number }[]
  decisions: { accepted: boolean }[]
  /** Un couple (projeté, mesuré) par test 20′ de la période. */
  tests: { projected: number; measured: number }[]
}

const mean = (values: number[]) =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length

const round = (value: number | null, decimals = 2) =>
  value === null ? null : Math.round(value * 10 ** decimals) / 10 ** decimals

export function calibrate(input: CalibrationInput): Calibration {
  const rpeError = mean(input.rpe.map((entry) => entry.felt - entry.expected))
  const projectionGap = mean(input.tests.map((test) => test.projected - test.measured))

  return {
    date: input.date,
    rpeError: round(rpeError) ?? 0,
    acceptanceRate:
      input.decisions.length === 0
        ? null
        : round(
            input.decisions.filter((decision) => decision.accepted).length / input.decisions.length,
          ),
    projectionGap: round(projectionGap),
    samples: {
      rpe: input.rpe.length,
      decisions: input.decisions.length,
      tests: input.tests.length,
    },
  }
}
