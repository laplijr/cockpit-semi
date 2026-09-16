import { vdotFromRace } from '../domain/fitness/vdot'

/** Durée du test de terrain servant à recaler le VDOT (§ 5). */
export const TEST_DURATION_S = 20 * 60

/**
 * VDOT déduit d'un test 20′ : la distance couverte en vingt minutes d'effort
 * contrôlé se lit comme un résultat de course sur cette distance.
 */
export function vdotFromTest(distanceM: number, durationS: number = TEST_DURATION_S): number {
  if (distanceM <= 0) throw new Error('La distance du test doit être positive')
  return vdotFromRace(distanceM, durationS)
}
