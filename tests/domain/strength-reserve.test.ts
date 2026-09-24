import { describe, expect, it } from 'vitest'
import { loadHint, targetReserve } from '~~/server/domain/strength/reserve'

/** La réserve remplace le pourcentage à l'affichage (P25). */
describe('réserve', () => {
  it('garde deux répétitions à 70 et 75 %, une à 85 %', () => {
    expect(targetReserve('70 %')).toBe(2)
    expect(targetReserve('75 %')).toBe(2)
    expect(targetReserve('85 %')).toBe(1)
  })

  it('en garde deux en force-puissance : l’intention de vitesse s’arrête loin de l’échec', () => {
    expect(targetReserve('≥ 85 %')).toBe(2)
  })

  it('en garde trois à une intensité modérée, et rien à vide', () => {
    expect(targetReserve('modérée')).toBe(3)
    expect(targetReserve('à vide')).toBeNull()
    expect(targetReserve('—')).toBeNull()
    expect(targetReserve(undefined)).toBeNull()
  })

  it('dit la charge par le format quand aucun kilo n’est connu', () => {
    expect(loadHint(9, 2)).toBe('Choisis un poids que tu pourrais soulever 11 fois, fais-en 9.')
  })
})
