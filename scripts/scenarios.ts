/** Scénarios de simulation du seed de développement (§ P3.5). */
export interface Scenario {
  name: string
  description: string
  /** Date à laquelle la reprise est marquée ; nulle pour garder la pause ouverte. */
  resumeDate: string | null
  /** Jour simulé final, à exporter dans NUXT_COCKPIT_TODAY. */
  simulatedDay: string
  /** Graine du générateur pseudo-aléatoire : deux exécutions sont identiques. */
  seed: number
  /** Progression de forme estimée entre deux tests 20′. */
  vdotGainPerTest: number
  /** Base vidée et laissée telle quelle : ni athlète, ni course, ni historique. */
  empty?: boolean
  /** Un second athlète, avec ses propres courses : il sert à voir le cloisonnement. */
  second?: boolean
  /** Des publications, des bravos et des commentaires entre les deux (P9). */
  circle?: boolean
}

export const SCENARIOS: Record<string, Scenario> = {
  pause: {
    name: 'pause',
    description: 'État réel du 16 sept. : pause ouverte, plan non daté, aucun historique.',
    resumeDate: null,
    simulatedDay: '2026-09-16',
    seed: 1,
    vdotGainPerTest: 0.6,
  },
  'reprise-s2': {
    name: 'reprise-s2',
    description: 'Reprise le 28 sept., deux semaines de réalisé. Charge encore indisponible.',
    resumeDate: '2026-09-28',
    simulatedDay: '2026-10-08',
    seed: 2,
    vdotGainPerTest: 0.6,
  },
  'bloc-2': {
    name: 'bloc-2',
    description: 'Test de semaine 4 fait, ratio de charge disponible, deux points de forme.',
    resumeDate: '2026-09-28',
    simulatedDay: '2026-11-22',
    seed: 3,
    vdotGainPerTest: 0.6,
  },
  'affutage-paris': {
    name: 'affutage-paris',
    description: 'Veille de Paris : quatre tests, semaine d’affûtage, Madrid à cinq semaines.',
    resumeDate: '2026-09-28',
    simulatedDay: '2027-03-01',
    seed: 4,
    vdotGainPerTest: 0.6,
  },
  /** Jour de Paris : le seul état où la saisie d'un résultat est ouverte (§ 9, P6.41). */
  'paris-jour-j': {
    name: 'paris-jour-j',
    description: 'Jour de Paris : même historique que l’affûtage, la course attend son chrono.',
    resumeDate: '2026-09-28',
    simulatedDay: '2027-03-07',
    seed: 4,
    vdotGainPerTest: 0.6,
  },
  /** Deux athlètes sur la même base : chacun son plan, sa charge, ses courses (§ 9, P8.3). */
  'deux-athletes': {
    name: 'deux-athletes',
    description: 'Deux athlètes : Ronan au bloc 2, et une seconde personne à ses côtés.',
    resumeDate: '2026-09-28',
    simulatedDay: '2026-11-22',
    seed: 3,
    vdotGainPerTest: 0.6,
    second: true,
  },
  /** Le cercle rempli : sans publications, la page ne montrerait rien (§ 9, P9.1). */
  cercle: {
    name: 'cercle',
    description: 'Deux athlètes du même cercle : des publications, des bravos, des commentaires.',
    resumeDate: '2026-09-28',
    simulatedDay: '2026-11-22',
    seed: 3,
    vdotGainPerTest: 0.6,
    second: true,
    circle: true,
  },
  /** Base vide : le seul état où l'onboarding de P8.2 se déroule (§ 9, P8.1). */
  neuf: {
    name: 'neuf',
    description: 'Base vide : aucun athlète, aucune course, aucun historique.',
    resumeDate: null,
    simulatedDay: '2026-09-16',
    seed: 5,
    vdotGainPerTest: 0.6,
    empty: true,
  },
}

export const DEFAULT_SCENARIO = 'pause'

export function resolveScenario(argv: string[]): Scenario {
  const flag = argv.find((argument) => argument.startsWith('--scenario='))
  const name = flag?.slice('--scenario='.length) ?? DEFAULT_SCENARIO
  const scenario = SCENARIOS[name]

  if (!scenario) {
    const known = Object.keys(SCENARIOS).join(', ')
    throw new Error(`Scénario inconnu : « ${name} ». Disponibles : ${known}.`)
  }

  return scenario
}

/**
 * Générateur pseudo-aléatoire déterministe (mulberry32). Deux exécutions avec
 * la même graine produisent exactement les mêmes données.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Tire un nombre dans [min, max]. */
export function between(random: () => number, min: number, max: number): number {
  return min + random() * (max - min)
}
