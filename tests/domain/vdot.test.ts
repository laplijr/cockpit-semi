import { describe, expect, it } from 'vitest'
import {
  RACE_DISTANCES_M,
  TrainingZone,
  paceFor,
  paceRangeFor,
  raceTimeForVdot,
  vdotFromRace,
} from '~~/server/domain/fitness/vdot'

const mmss = (seconds: number) => {
  const total = Math.round(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

describe('VDOT à partir d’un résultat', () => {
  it('retrouve VDOT 44 sur un semi en 1:42:17 (table Daniels)', () => {
    expect(vdotFromRace(RACE_DISTANCES_M.halfMarathon, 1 * 3600 + 42 * 60 + 17)).toBeCloseTo(44, 1)
  })

  it('retrouve VDOT 45,4 sur un semi en 1:39:35 (scénario de référence)', () => {
    expect(vdotFromRace(RACE_DISTANCES_M.halfMarathon, 1 * 3600 + 39 * 60 + 35)).toBeCloseTo(
      45.4,
      0,
    )
  })

  it('monte quand le temps baisse sur la même distance', () => {
    const slower = vdotFromRace(RACE_DISTANCES_M.tenK, 50 * 60)
    const faster = vdotFromRace(RACE_DISTANCES_M.tenK, 45 * 60)
    expect(faster).toBeGreaterThan(slower)
  })
})

describe('projection d’un temps de course', () => {
  it('projette VDOT 44 sur un semi à 6 s de la table Daniels', () => {
    // La table publiée donne 1:42:17 ; les formules du § 5 donnent 1:42:11,7.
    // L'écart de 5,3 s est celui de la table elle-même, arrondie au VDOT entier.
    const published = 1 * 3600 + 42 * 60 + 17
    const computed = raceTimeForVdot(44, RACE_DISTANCES_M.halfMarathon)
    expect(Math.abs(computed - published)).toBeLessThanOrEqual(6)
  })

  it('donne 4:39 /km de moyenne pour un semi en 1:38:00', () => {
    const paceSecPerKm = (1 * 3600 + 38 * 60) / (RACE_DISTANCES_M.halfMarathon / 1000)
    expect(mmss(paceSecPerKm)).toBe('4:39')
  })

  it('est l’inverse exact de vdotFromRace sur toutes les distances', () => {
    for (const distance of Object.values(RACE_DISTANCES_M)) {
      const time = raceTimeForVdot(45.4, distance)
      expect(vdotFromRace(distance, time)).toBeCloseTo(45.4, 6)
    }
  })

  it('donne un temps plus long sur une distance plus longue', () => {
    expect(raceTimeForVdot(45, RACE_DISTANCES_M.marathon)).toBeGreaterThan(
      raceTimeForVdot(45, RACE_DISTANCES_M.halfMarathon),
    )
  })
})

describe('allures d’entraînement', () => {
  it('donne le seuil à 4:36 /km pour VDOT 45,4 (scénario de référence)', () => {
    expect(mmss(paceFor(45.4, TrainingZone.Threshold))).toBe('4:36')
  })

  it('donne l’intervalle à 4:14 /km pour VDOT 45,4', () => {
    expect(mmss(paceFor(45.4, TrainingZone.Interval))).toBe('4:14')
  })

  it('ordonne les zones de la plus lente à la plus rapide', () => {
    const paces = [
      TrainingZone.Easy,
      TrainingZone.Marathon,
      TrainingZone.Threshold,
      TrainingZone.Interval,
      TrainingZone.Repetition,
    ].map((zone) => paceFor(45.4, zone))

    for (let i = 1; i < paces.length; i++) {
      expect(paces[i]!).toBeLessThan(paces[i - 1]!)
    }
  })

  it('renvoie une fourchette dont la borne lente est plus lente que la rapide', () => {
    const easy = paceRangeFor(45.4, TrainingZone.Easy)
    expect(easy.slowSecPerKm).toBeGreaterThan(easy.fastSecPerKm)
  })
})
