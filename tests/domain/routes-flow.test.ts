import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SEEDS, generateRoutes } from '~~/server/application/generate-routes'
import type { RouteGateway, RouteVariant, RoutingService } from '~~/server/application/ports'
import { parseGpx } from '~~/server/domain/routes/gpx'
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
    expect(routing.calls.filter((call) => call.startsWith('roundTrip'))).toHaveLength(SEEDS.length)
    expect(variants).toHaveLength(SEEDS.length)
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

    expect(gateway.saved).toHaveLength(SEEDS.length)
    for (const variant of gateway.saved) {
      expect(variant.sessionId).toBe(TARGET.sessionId)
      expect(variant.code).toBe('SL')
      expect(parseGpx(variant.gpx).length).toBeGreaterThan(1)
    }
  })
})
