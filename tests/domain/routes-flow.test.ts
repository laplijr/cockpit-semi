import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SEEDS, generateRoutes } from '~~/server/application/generate-routes'
import type { RouteGateway, RouteVariant, RoutingService } from '~~/server/application/ports'
import { parseGpx } from '~~/server/domain/routes/gpx'
import { RouteKind, type GeoPoint } from '~~/server/domain/routes/route'
import { Sport } from '~~/server/domain/shared/sport'

/** Traces réelles enregistrées : aucun appel réseau en CI (§ 10). */
const fixture = (name: string) => readFileSync(join('tests/fixtures/routes', name), 'utf8')

const LOOP = parseGpx(fixture('loop-madrid.gpx'))
const HILLY = parseGpx(fixture('loop-madrid-hilly.gpx'))

const RACE = {
  id: 9,
  name: 'Semi de Madrid',
  date: '2027-04-04',
  startAddress: 'Paseo del Prado, Madrid',
}

const SESSIONS = [
  { id: 1, date: '2027-03-28', sport: Sport.Running, code: 'EF', distanceM: 9000 },
  { id: 2, date: '2027-04-03', sport: Sport.Running, code: 'EF', distanceM: 5000 },
  { id: 3, date: '2027-04-03', sport: Sport.Strength, code: 'full', distanceM: 0 },
]

/** Le service rend la trace vallonnée pour la graine 1, la plate ensuite. */
function fakeRouting(): RoutingService & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async geocode(address) {
      calls.push(`geocode:${address}`)
      return { lat: 40.4155, lon: -3.7074 }
    },
    async roundTrip(_start: GeoPoint, distanceM: number, seed: number) {
      calls.push(`roundTrip:${distanceM}:${seed}`)
      return seed === 1 ? HILLY : LOOP
    },
    async legTo() {
      calls.push('legTo')
      return LOOP.slice(0, 9)
    },
  }
}

function fakeGateway(): RouteGateway & { saved: RouteVariant[] } {
  const saved: RouteVariant[] = []
  return {
    saved,
    async loadRace() {
      return RACE
    },
    async loadPlannedSessions() {
      return SESSIONS
    },
    async replaceRoutes(_raceId, variants) {
      saved.splice(0, saved.length, ...variants)
    },
  }
}

describe('génération des itinéraires d’un séjour (§ 9, P5.5)', () => {
  it('trace trois variantes par sortie sur place, plus l’aller vers le départ', async () => {
    const routing = fakeRouting()
    const gateway = fakeGateway()

    const variants = await generateRoutes(gateway, routing, {
      race: RACE,
      address: '12 calle Mayor, Madrid',
    })

    expect(routing.calls).toContain('geocode:12 calle Mayor, Madrid')
    expect(routing.calls).toContain('geocode:Paseo del Prado, Madrid')
    expect(variants.filter((variant) => variant.kind === RouteKind.Loop)).toHaveLength(SEEDS.length)
    expect(variants.filter((variant) => variant.kind === RouteKind.Outbound)).toHaveLength(1)
  })

  it('ne retient que les sorties entre l’arrivée par défaut et la course', async () => {
    const variants = await generateRoutes(fakeGateway(), fakeRouting(), {
      race: RACE,
      address: '12 calle Mayor, Madrid',
    })

    expect(new Set(variants.map((variant) => variant.sessionId))).toEqual(new Set([2, null]))
  })

  it('remonte à l’arrivée déclarée quand elle précède la veille', async () => {
    const variants = await generateRoutes(fakeGateway(), fakeRouting(), {
      race: RACE,
      address: '12 calle Mayor, Madrid',
      arrivalDate: '2027-03-28',
    })

    expect(new Set(variants.map((variant) => variant.sessionId))).toEqual(new Set([1, 2, null]))
  })

  it('classe la variante plate devant la vallonnée', async () => {
    const variants = await generateRoutes(fakeGateway(), fakeRouting(), {
      race: RACE,
      address: '12 calle Mayor, Madrid',
    })

    const loops = variants.filter((variant) => variant.kind === RouteKind.Loop)
    expect(loops[0]!.seed).not.toBe(1)
    expect(loops.at(-1)!.seed).toBe(1)
  })

  it('enregistre un GPX relisible pour chaque variante', async () => {
    const gateway = fakeGateway()
    await generateRoutes(gateway, fakeRouting(), {
      race: RACE,
      address: '12 calle Mayor, Madrid',
    })

    expect(gateway.saved).toHaveLength(4)
    for (const variant of gateway.saved) {
      expect(parseGpx(variant.gpx).length).toBeGreaterThan(1)
      expect(variant.address).toBe('12 calle Mayor, Madrid')
    }
  })
})
