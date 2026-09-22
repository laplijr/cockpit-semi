import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { VARIANTS_PER_DRAW, generateRoutes } from '~~/server/application/generate-routes'
import type { RouteGateway, RouteVariant, RoutingService } from '~~/server/application/ports'
import { parseGpx } from '~~/server/domain/routes/gpx'
import { CURRENT_POSITION_LABEL } from '~~/server/domain/routes/route'
import type { GeoPoint, RouteTarget } from '~~/server/domain/routes/route'

/** Traces réelles enregistrées : aucun appel réseau en CI (§ 10). */
const fixture = (name: string) => readFileSync(join('tests/fixtures/routes', name), 'utf8')

const LOOP = parseGpx(fixture('loop-madrid.gpx'))
const HILLY = parseGpx(fixture('loop-madrid-hilly.gpx'))

const TARGET: RouteTarget = {
  sessionId: 12,
  date: '2026-11-29',
  code: 'SL',
  distanceM: 5000,
}

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
      return LOOP
    },
  }
}

function fakeGateway(homeAddress: string | null = '3 rue des Lilas, Vannes') {
  const saved: RouteVariant[] = []
  const gateway: RouteGateway & { saved: RouteVariant[] } = {
    saved,
    async loadTarget() {
      return TARGET
    },
    async loadHomeAddress() {
      return homeAddress
    },
    async loadLastDraw() {
      const [first] = saved
      if (!first) return null
      return {
        address: first.address,
        origin: { lat: first.lat, lon: first.lon },
        lastSeed: Math.max(...saved.map((variant) => variant.seed)),
      }
    },
    async replaceRoutes(_sessionId, variants) {
      saved.splice(0, saved.length, ...variants)
    },
  }
  return gateway
}

describe('itinéraire proposé pour une séance (§ 9, P5.5)', () => {
  it('demande une boucle par graine, à la distance de la séance', async () => {
    const routing = fakeRouting()

    const variants = await generateRoutes(fakeGateway(), routing, {
      target: TARGET,
      address: '3 rue des Lilas, Vannes',
    })

    expect(routing.calls).toContain('geocode:3 rue des Lilas, Vannes')
    expect(routing.calls.filter((call) => call.startsWith('roundTrip'))).toHaveLength(
      VARIANTS_PER_DRAW,
    )
    expect(variants).toHaveLength(VARIANTS_PER_DRAW)
  })

  it('classe la variante plate devant la vallonnée', async () => {
    const variants = await generateRoutes(fakeGateway(), fakeRouting(), {
      target: TARGET,
      address: '3 rue des Lilas, Vannes',
    })

    expect(variants[0]!.seed).not.toBe(1)
    expect(variants.at(-1)!.seed).toBe(1)
  })

  it('enregistre un GPX relisible, rattaché à la séance', async () => {
    const gateway = fakeGateway()
    await generateRoutes(gateway, fakeRouting(), {
      target: TARGET,
      address: '3 rue des Lilas, Vannes',
    })

    expect(gateway.saved).toHaveLength(VARIANTS_PER_DRAW)
    for (const variant of gateway.saved) {
      expect(variant.sessionId).toBe(TARGET.sessionId)
      expect(variant.code).toBe('SL')
      expect(parseGpx(variant.gpx).length).toBeGreaterThan(1)
    }
  })

  /**
   * « Autre boucle » ne peut pas reproposer ce qu'on vient de voir : depuis la
   * même origine, une graine déjà tirée redonne exactement la même trace (P15).
   */
  it('reprend les graines après le tirage précédent', async () => {
    const routing = fakeRouting()

    await generateRoutes(fakeGateway(), routing, {
      target: TARGET,
      address: '3 rue des Lilas, Vannes',
      seedBase: 4,
    })

    const seeds = routing.calls
      .filter((call) => call.startsWith('roundTrip'))
      .map((call) => Number(call.split(':').at(-1)))

    expect(seeds).toEqual([4, 5, 6])
  })

  /** Une origine donnée se suffit : rien ne part au géocodage (P10.3, P15). */
  it('ne géocode pas quand le départ est déjà connu', async () => {
    const routing = fakeRouting()

    await generateRoutes(fakeGateway(), routing, {
      target: TARGET,
      address: CURRENT_POSITION_LABEL,
      origin: { lat: 40.4155, lon: -3.7074 },
    })

    expect(routing.calls.some((call) => call.startsWith('geocode'))).toBe(false)
  })
})
