import { describe, expect, it } from 'vitest'
import {
  RACE_DISTANCES_M,
  TrainingZone,
  paceFor,
  paceRangeFor,
  halfMarathonPace,
  raceTimeForVdot,
  vdotFromEasyPace,
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

describe('table Daniels autour du plancher (§ 5)', () => {
  const cases = [
    {
      vdot: 30,
      fiveK: '30:41',
      half: '2:21:17',
      easy: '7:39',
      threshold: '6:24',
      interval: '5:54',
    },
    {
      vdot: 35,
      fiveK: '26:59',
      half: '2:04:13',
      easy: '6:48',
      threshold: '5:40',
      interval: '5:13',
    },
  ]

  const toSeconds = (text: string) =>
    text.split(':').reduce((total, part) => total * 60 + Number(part), 0)

  for (const expected of cases) {
    it(`reproduit la ligne VDOT ${expected.vdot} à 2 s près`, () => {
      const within = (actual: number, target: string) =>
        expect(Math.abs(actual - toSeconds(target))).toBeLessThanOrEqual(2)

      within(raceTimeForVdot(expected.vdot, RACE_DISTANCES_M.fiveK), expected.fiveK)
      within(raceTimeForVdot(expected.vdot, RACE_DISTANCES_M.halfMarathon), expected.half)
      within(paceFor(expected.vdot, TrainingZone.Easy), expected.easy)
      within(paceFor(expected.vdot, TrainingZone.Threshold), expected.threshold)
      within(paceFor(expected.vdot, TrainingZone.Interval), expected.interval)
    })
  }
})

describe('allure semi', () => {
  it('dérive de la projection, pas de la zone marathon', () => {
    expect(halfMarathonPace(45.4)).toBeCloseTo(
      raceTimeForVdot(45.4, RACE_DISTANCES_M.halfMarathon) / 21.0975,
      6,
    )
  })

  it('vaut environ 6:10/km au plancher VDOT 33, à 2 s près', () => {
    expect(Math.abs(halfMarathonPace(33) - (6 * 60 + 10))).toBeLessThanOrEqual(2)
  })

  it('se situe entre l’allure marathon et le seuil', () => {
    const half = halfMarathonPace(33)
    expect(half).toBeLessThan(paceFor(33, TrainingZone.Marathon))
    expect(half).toBeGreaterThan(paceFor(33, TrainingZone.Threshold))
  })
})

describe('VDOT déclaré depuis une allure d’endurance (§ 5)', () => {
  it('retrouve les allures E de la table Daniels : 7:39 vaut 30, 6:47 vaut 35', () => {
    expect(vdotFromEasyPace(7 * 60 + 39)).toBeCloseTo(30, 1)
    expect(vdotFromEasyPace(6 * 60 + 47)).toBeCloseTo(35, 1)
  })

  it('inverse exactement l’allure E affichée, quel que soit le VDOT', () => {
    for (const vdot of [30, 35, 40, 45, 50]) {
      expect(vdotFromEasyPace(paceFor(vdot, TrainingZone.Easy))).toBeCloseTo(vdot, 6)
    }
  })

  it('monte quand l’allure déclarée accélère', () => {
    expect(vdotFromEasyPace(6 * 60)).toBeGreaterThan(vdotFromEasyPace(7 * 60))
  })
})
