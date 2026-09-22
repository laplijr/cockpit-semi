import { describe, expect, it } from 'vitest'
import { FITNESS_FRESHNESS_WEEKS, currentFitnessOf } from '~~/server/domain/fitness/current'

/**
 * La forme courante n'est pas le point le plus récent (§ 5, P7.5) : une allure
 * d'endurance déclarée aujourd'hui écrasait en silence un chrono de course
 * d'il y a deux mois. Aucun écran ne dit la règle, elle se voit dans la
 * valeur.
 */
const TODAY = '2026-11-24'

const measure = (date: string, vdot: number) => ({ date, vdot, isFloor: false })
const floor = (date: string, vdot: number) => ({ date, vdot, isFloor: true })

describe('forme courante', () => {
  it('ne rend rien sans point', () => {
    expect(currentFitnessOf([], TODAY)).toBeUndefined()
  })

  it('préfère la mesure fraîche la plus récente au plancher déclaré du jour', () => {
    const current = currentFitnessOf([floor(TODAY, 38.2), measure('2026-10-20', 33.7)], TODAY)

    expect(current).toEqual({ date: '2026-10-20', vdot: 33.7, isFloor: false })
  })

  it('prend la plus récente des mesures fraîches', () => {
    const current = currentFitnessOf(
      [measure('2026-09-30', 32), measure('2026-10-20', 33.7)],
      TODAY,
    )

    expect(current?.date).toBe('2026-10-20')
  })

  it('retombe sur le point le plus récent quand aucune mesure n’est fraîche', () => {
    const stale = `2026-05-01`
    const current = currentFitnessOf([measure(stale, 40), floor('2026-11-10', 35)], TODAY)

    expect(current).toEqual({ date: '2026-11-10', vdot: 35, isFloor: true })
  })

  it('relit un point trop vieux comme un plancher, sans toucher à sa valeur', () => {
    const current = currentFitnessOf([measure('2026-01-05', 42)], TODAY)

    expect(current).toEqual({ date: '2026-01-05', vdot: 42, isFloor: true })
  })

  it('tient la mesure pour fraîche jusqu’au dernier jour de la fenêtre', () => {
    const edge = new Date(Date.parse(TODAY) - FITNESS_FRESHNESS_WEEKS * 7 * 86_400_000)
      .toISOString()
      .slice(0, 10)

    expect(currentFitnessOf([measure(edge, 36), floor(TODAY, 30)], TODAY)).toMatchObject({
      vdot: 36,
      isFloor: false,
    })

    const older = new Date(Date.parse(edge) - 86_400_000).toISOString().slice(0, 10)
    expect(currentFitnessOf([measure(older, 36), floor(TODAY, 30)], TODAY)).toMatchObject({
      vdot: 30,
      isFloor: true,
    })
  })
})
