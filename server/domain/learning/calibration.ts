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

/**
 * Calibration du ressenti, type de séance par type de séance : de combien le
 * RPE vécu s'écarte du RPE prescrit. C'est la même mesure que celle du
 * détecteur de biais, sans son seuil — ici on montre tout, même le petit écart.
 */
export interface RpeCalibrationRow {
  code: string
  samples: number
  bias: number
}

export function rpeByCode(
  sessions: { code: string; expectedRpe: number; rpe: number | null }[],
): RpeCalibrationRow[] {
  const groups = new Map<string, { expected: number; felt: number }[]>()
  for (const session of sessions) {
    if (session.rpe === null) continue
    const entry = { expected: session.expectedRpe, felt: session.rpe }
    groups.set(session.code, [...(groups.get(session.code) ?? []), entry])
  }

  return [...groups.entries()]
    .map(([code, entries]) => ({
      code,
      samples: entries.length,
      bias:
        Math.round(
          (entries.reduce((sum, entry) => sum + (entry.felt - entry.expected), 0) /
            entries.length) *
            100,
        ) / 100,
    }))
    .sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias))
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
