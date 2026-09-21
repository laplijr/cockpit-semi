import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { filesUnder } from './helpers/files'

/**
 * Tables qui portent de la donnée d'athlète. Toute requête qui les touche
 * doit nommer l'athlète, sinon elle rend — ou écrit — les données de tout le
 * monde (§ 11, P8.3).
 */
const SCOPED = [
  'athlete',
  'race',
  'fitnessPoint',
  'planVersion',
  'pause',
  'activity',
  'loadDaily',
  'proposal',
  'unplannedEvent',
  'habit',
  'calibration',
  'raceLookup',
  'mealPlan',
  'forecast',
]

/**
 * Tables filles : elles n'ont pas de clé d'athlète et héritent de leur parent.
 * Une requête qui les touche passe donc par `athleteWeekIds` ou par la course.
 */
const INHERITED = ['week', 'session', 'phase', 'feedback', 'strengthSet', 'raceSegment', 'route']

/**
 * Ce qui prouve qu'une requête sur une table d'athlète est cloisonnée : elle
 * nomme l'athlète, directement ou par la liste de ses semaines.
 */
const SCOPED_MARKERS = /\bathleteId\b|\bathleteWeekIds\b|\bmine\b/

/**
 * Une table fille se cloisonne par son parent : soit elle passe par la même
 * liste de semaines, soit elle est bornée par une clé parente déjà vérifiée
 * dans la même fonction — c'est à ça que servent les portes de `utils/scope`.
 */
const INHERITED_MARKERS =
  /\bathleteId\b|\bathleteWeekIds\b|\bmine\b|planVersionId|weekId|sessionId|previousWeeks|raceId|target\.id|owned/

const TABLES = [...SCOPED, ...INHERITED]

interface Query {
  file: string
  line: number
  table: string
  chain: string
}

/**
 * Chaîne Drizzle partant d'un `.from(x)` / `.insert(x)` / `.update(x)` /
 * `.delete(x)` : on avance tant que la suite du texte enchaîne des appels.
 * Prettier met un appel par ligne, ce qui rend la lecture fiable.
 */
function chainFrom(source: string, start: number): string {
  let depth = 0
  let end = source.indexOf('(', start)

  while (end < source.length) {
    const char = source[end]
    if (char === '(') depth += 1
    if (char === ')') {
      depth -= 1
      if (depth === 0) {
        const next = source.slice(end + 1).match(/^\s*\./)
        if (!next) return source.slice(start, end + 1)
        end += next[0].length
        continue
      }
    }
    end += 1
  }

  return source.slice(start)
}

function queriesIn(file: string): Query[] {
  const source = readFileSync(file, 'utf8')
  const found: Query[] = []
  const pattern = new RegExp(`\\.(from|insert|update|delete)\\((${TABLES.join('|')})\\)`, 'g')

  for (const match of source.matchAll(pattern)) {
    const at = match.index!
    found.push({
      file,
      line: source.slice(0, at).split('\n').length,
      table: match[2]!,
      chain: chainFrom(source, at),
    })
  }

  return found
}

/** Le domaine n'a pas de base : seules l'application et l'infra requêtent. */
const SOURCES = ['server/api', 'server/application', 'server/infra', 'server/utils']

const ALL = SOURCES.flatMap(filesUnder)
  .filter((path) => path.endsWith('.ts'))
  .flatMap(queriesIn)

/**
 * Trois exceptions, et elles se justifient chacune. Le schéma déclare les
 * colonnes sans rien requêter ; la résolution de l'athlète courant est la
 * seule lecture qui ne peut pas déjà le connaître ; le cron n'a pas de
 * session et énumère les athlètes, c'est tout son travail (§ 9, P8.3).
 */
const EXEMPT = new Set([
  'server/infra/db/schema.ts',
  'server/utils/context.ts',
  'server/api/cron/daily.get.ts',
])

describe('cloisonnement par athlète (§ 11, P8.3)', () => {
  it('trouve bien les requêtes à vérifier : le test ne passe pas à vide', () => {
    expect(ALL.length).toBeGreaterThan(50)
  })

  it('nomme l’athlète dans chaque requête sur une table qui porte ses données', () => {
    const unscoped = ALL.filter((query) => !EXEMPT.has(query.file))
      .filter((query) => SCOPED.includes(query.table))
      .filter((query) => !SCOPED_MARKERS.test(query.chain))

    expect(unscoped.map((query) => `${query.file}:${query.line} ${query.table}`)).toEqual([])
  })

  it('borne chaque requête sur une table fille par son parent', () => {
    const unscoped = ALL.filter((query) => !EXEMPT.has(query.file))
      .filter((query) => INHERITED.includes(query.table))
      .filter((query) => !INHERITED_MARKERS.test(query.chain))

    expect(unscoped.map((query) => `${query.file}:${query.line} ${query.table}`)).toEqual([])
  })

  it('ne laisse plus une seule lecture d’athlète non filtrée', () => {
    const offenders = SOURCES.flatMap(filesUnder)
      .filter((path) => path.endsWith('.ts') && !EXEMPT.has(path))
      .filter((path) => /\.from\(athlete\)\s*\.limit\(1\)/.test(readFileSync(path, 'utf8')))

    expect(offenders).toEqual([])
  })
})
