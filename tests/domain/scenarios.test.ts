import { describe, expect, it } from 'vitest'
import { testDistanceForVdot, vdotFromTest } from '~~/server/application/record-test'
import { HABIT_THRESHOLDS } from '~~/server/domain/learning/habit'
import {
  MISSED_FORMAT_RATE,
  PROPOSAL_ACCEPT_RATE,
  RPE_BIAS_BY_CODE,
  SHORT_NIGHT_RATE,
  SHORT_NIGHT_RPE_COST,
  START_LOAD_KG,
} from '~~/scripts/athlete-profile'
import { SCENARIOS, between, createRandom, resolveScenario } from '~~/scripts/scenarios'

describe('générateur pseudo-aléatoire', () => {
  it('produit exactement la même suite pour une graine donnée', () => {
    const first = Array.from({ length: 20 }, createRandom(42))
    const second = Array.from({ length: 20 }, createRandom(42))
    expect(first).toEqual(second)
  })

  it('produit des suites différentes pour des graines différentes', () => {
    expect(Array.from({ length: 10 }, createRandom(1))).not.toEqual(
      Array.from({ length: 10 }, createRandom(2)),
    )
  })

  it('reste dans [0, 1[', () => {
    const random = createRandom(7)
    for (let i = 0; i < 500; i++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('tire dans les bornes demandées', () => {
    const random = createRandom(9)
    for (let i = 0; i < 200; i++) {
      const value = between(random, 0.95, 1.05)
      expect(value).toBeGreaterThanOrEqual(0.95)
      expect(value).toBeLessThanOrEqual(1.05)
    }
  })
})

describe('scénarios', () => {
  it('prend « pause » par défaut', () => {
    expect(resolveScenario([]).name).toBe('pause')
  })

  it('résout un scénario nommé', () => {
    expect(resolveScenario(['--scenario=bloc-2']).name).toBe('bloc-2')
  })

  it('refuse un scénario inconnu plutôt que de retomber sur le défaut', () => {
    expect(() => resolveScenario(['--scenario=inexistant'])).toThrow(/inconnu/)
  })

  it('donne à chaque scénario un jour simulé postérieur à sa reprise', () => {
    for (const scenario of Object.values(SCENARIOS)) {
      if (!scenario.resumeDate) continue
      expect(scenario.simulatedDay >= scenario.resumeDate).toBe(true)
    }
  })

  it('garde la pause ouverte dans le scénario par défaut', () => {
    expect(SCENARIOS.pause!.resumeDate).toBeNull()
  })

  it('laisse « neuf » seul à vider la base, sans reprise à rejouer', () => {
    const empty = Object.values(SCENARIOS).filter((scenario) => scenario.empty)
    expect(empty.map((scenario) => scenario.name)).toEqual(['neuf'])
    expect(SCENARIOS.neuf!.resumeDate).toBeNull()
  })
})

describe('progression de forme entre deux tests', () => {
  it('fait croître strictement le VDOT test après test', () => {
    let vdot = 33.15
    const seen = [vdot]

    for (let i = 0; i < 4; i++) {
      vdot = vdotFromTest(testDistanceForVdot(vdot + 0.6))
      seen.push(vdot)
    }

    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]!).toBeGreaterThan(seen[i - 1]!)
    }
  })

  it('retrouve le VDOT visé à partir de la distance calculée', () => {
    // La distance est arrondie au mètre : le VDOT retrouvé l'est au centième près.
    for (const target of [30, 33.75, 40, 48]) {
      expect(Math.abs(vdotFromTest(testDistanceForVdot(target)) - target)).toBeLessThan(0.01)
    }
  })

  it('demande une distance plus longue pour un VDOT plus élevé', () => {
    expect(testDistanceForVdot(40)).toBeGreaterThan(testDistanceForVdot(33))
  })
})

describe('profil simulé de l’athlète', () => {
  it('donne un biais assez marqué pour que le détecteur l’accroche', () => {
    const { minBias } = HABIT_THRESHOLDS.rpeBias
    const biases = Object.values(RPE_BIAS_BY_CODE)

    expect(biases.length).toBeGreaterThan(0)
    for (const bias of biases) expect(Math.abs(bias)).toBeGreaterThanOrEqual(minBias)
  })

  it('fait dormir assez court, assez souvent, pour que la sensibilité se mesure', () => {
    const { minCases } = HABIT_THRESHOLDS.sleepSensitivity
    /** Huit semaines de réalisé tournent autour de soixante séances. */
    const nights = 60 * SHORT_NIGHT_RATE

    expect(nights).toBeGreaterThan(minCases)
    expect(SHORT_NIGHT_RPE_COST).toBeGreaterThanOrEqual(1)
  })

  it('décide plus de propositions qu’il n’en refuse, sans les accepter toutes', () => {
    expect(PROPOSAL_ACCEPT_RATE).toBeGreaterThan(0.5)
    expect(PROPOSAL_ACCEPT_RATE).toBeLessThan(1)
  })

  it('part de charges non nulles sur les exercices qui se chargent', () => {
    expect(START_LOAD_KG.squat).toBeGreaterThan(0)
    expect(START_LOAD_KG['developpe-couche']).toBeGreaterThan(0)
    /** Un exercice au poids du corps reste à zéro : il n'a pas de charge à suivre. */
    expect(START_LOAD_KG.nordic).toBe(0)
  })

  it('manque le format assez souvent pour que la charge fasse des paliers', () => {
    expect(MISSED_FORMAT_RATE).toBeGreaterThan(0)
    expect(MISSED_FORMAT_RATE).toBeLessThan(0.5)
  })
})
