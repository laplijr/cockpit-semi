import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { traceFrom } from '~~/server/domain/routes/geometry'
import { parseGpx, toGpx } from '~~/server/domain/routes/gpx'
import type { RouteTarget } from '~~/server/domain/routes/route'
import {
  RouteRejection,
  isValid,
  rankVariants,
  rejectionsOf,
} from '~~/server/domain/routes/validate'
import { pointsOf } from '~~/server/infra/routing/openrouteservice'

/** Traces réelles enregistrées : aucun appel réseau en CI (§ 10). */
const fixture = (name: string) => readFileSync(join('tests/fixtures/routes', name), 'utf8')

const target = (distanceM: number): RouteTarget => ({
  sessionId: 1,
  date: '2027-04-03',
  code: 'EF',
  distanceM,
})

describe('lecture et écriture d’un GPX', () => {
  it('lit les points d’une trace et leur altitude', () => {
    const points = parseGpx(fixture('loop-madrid.gpx'))

    expect(points).toHaveLength(17)
    expect(points[0]).toEqual({ lat: 40.4155, lon: -3.7074, elevationM: 650 })
  })

  it('réécrit ce qu’il a lu, au mètre près', () => {
    const points = parseGpx(fixture('loop-madrid.gpx'))
    expect(parseGpx(toGpx('Boucle', points))).toEqual(points)
  })

  it('échappe le nom de la trace au lieu de casser le XML', () => {
    expect(toGpx('Semi « A & B »', [])).toContain('<name>Semi « A &amp; B »</name>')
  })
})

describe('mesure d’une trace', () => {
  it('mesure la distance de la boucle à quelques mètres près', () => {
    const trace = traceFrom(parseGpx(fixture('loop-madrid.gpx')))
    expect(trace.distanceM).toBeGreaterThan(4950)
    expect(trace.distanceM).toBeLessThan(5050)
  })

  it('ne compte comme dénivelé que les montées, bruit filtré', () => {
    const trace = traceFrom(parseGpx(fixture('loop-madrid.gpx')))
    expect(trace.elevationGainM).toBe(16)
  })

  it('compte un virage à chaque coin du carré', () => {
    const trace = traceFrom(parseGpx(fixture('loop-madrid.gpx')))
    expect(trace.turns).toBe(3)
  })
})

describe('validation d’une boucle (§ 9)', () => {
  it('accepte une boucle plate à la distance de la séance', () => {
    const trace = traceFrom(parseGpx(fixture('loop-madrid.gpx')))
    expect(isValid(trace, target(5000))).toBe(true)
  })

  it('tolère 10 % d’écart, pas davantage', () => {
    const trace = traceFrom(parseGpx(fixture('loop-madrid.gpx')))

    expect(isValid(trace, target(4600))).toBe(true)
    expect(rejectionsOf(trace, target(4000))).toContain(RouteRejection.TooLong)
    expect(rejectionsOf(trace, target(6000))).toContain(RouteRejection.TooShort)
  })

  it('refuse une boucle qui monte plus de 10 m par kilomètre', () => {
    const trace = traceFrom(parseGpx(fixture('loop-madrid-hilly.gpx')))
    expect(rejectionsOf(trace, target(5000))).toContain(RouteRejection.TooHilly)
  })

  it('refuse une trace qui ne revient pas à son départ', () => {
    const points = parseGpx(fixture('loop-madrid.gpx')).slice(0, 12)
    expect(rejectionsOf(traceFrom(points), target(3750))).toContain(RouteRejection.NotClosed)
  })
})

describe('classement des variantes (§ 9)', () => {
  it('met la plus plate devant, puis celle qui tourne le moins', () => {
    const flat = { points: [], distanceM: 5000, elevationGainM: 10, turns: 9 }
    const flatAndStraight = { points: [], distanceM: 5000, elevationGainM: 10, turns: 4 }
    const hilly = { points: [], distanceM: 5000, elevationGainM: 40, turns: 2 }

    const ranked = rankVariants([hilly, flat, flatAndStraight], target(5000))
    expect(ranked).toEqual([flatAndStraight, flat, hilly])
  })

  it('renvoie une trace invalide en queue plutôt que de la perdre', () => {
    const valid = traceFrom(parseGpx(fixture('loop-madrid.gpx')))
    const tooShort = { points: valid.points, distanceM: 2000, elevationGainM: 0, turns: 1 }

    expect(rankVariants([tooShort, valid], target(5000))).toEqual([valid, tooShort])
  })

  /** Sans variante valide, c'est la distance qu'on est venu chercher. */
  it('entre deux boucles hors tolérance, garde la plus proche de la cible', () => {
    const short = { points: [], distanceM: 6365, elevationGainM: 75, turns: 49 }
    const close = { points: [], distanceM: 7516, elevationGainM: 89, turns: 48 }

    expect(rankVariants([short, close], target(7260))).toEqual([close, short])
  })
})

describe('réponse OpenRouteService', () => {
  it('lit une boucle, coordonnées en lon / lat / altitude', () => {
    const points = pointsOf(JSON.parse(fixture('ors-round-trip.json')))

    expect(points).toHaveLength(17)
    expect(points[0]).toEqual({ lat: 40.4155, lon: -3.7074, elevationM: 650 })
  })

  it('lit un point de géocodage comme un point unique', () => {
    expect(pointsOf(JSON.parse(fixture('ors-geocode.json')))).toEqual([
      { lat: 40.4155, lon: -3.7074 },
    ])
  })

  it('rend une liste vide quand le service ne trouve rien', () => {
    expect(pointsOf({ features: [] })).toEqual([])
  })
})
