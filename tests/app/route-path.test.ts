import { describe, expect, it } from 'vitest'
import { isoDayBefore, routePath } from '~/utils/route-path'

/** Carré d'un kilomètre de côté, au centre de Madrid. */
const SQUARE = [
  { lat: 40.4155, lon: -3.7074 },
  { lat: 40.4245, lon: -3.7074 },
  { lat: 40.4245, lon: -3.6956 },
  { lat: 40.4155, lon: -3.6956 },
  { lat: 40.4155, lon: -3.7074 },
]

describe('tracé SVG d’un itinéraire (§ 9, P5.5)', () => {
  it('commence par un déplacement et poursuit en lignes', () => {
    const path = routePath(SQUARE, 96, 96)
    expect(path.startsWith('M')).toBe(true)
    expect(path.split('L')).toHaveLength(SQUARE.length)
  })

  it('tient dans la boîte, marge comprise', () => {
    const coordinates = [...routePath(SQUARE, 96, 96).matchAll(/([\d.]+) ([\d.]+)/g)].flatMap(
      (match) => [Number(match[1]), Number(match[2])],
    )

    expect(Math.min(...coordinates)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...coordinates)).toBeLessThanOrEqual(96)
  })

  it('garde les proportions : un carré reste carré malgré la latitude', () => {
    const points = [...routePath(SQUARE, 96, 96).matchAll(/([\d.]+) ([\d.]+)/g)].map((match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
    }))

    const width = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))
    const height = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y))

    expect(Math.abs(width - height)).toBeLessThan(2)
  })

  it('ne dessine rien avec moins de deux points', () => {
    expect(routePath([SQUARE[0]!], 96, 96)).toBe('')
  })

  it('propose la veille de la course comme date d’arrivée', () => {
    expect(isoDayBefore('2027-04-04')).toBe('2027-04-03')
    expect(isoDayBefore('2027-03-01')).toBe('2027-02-28')
  })
})
