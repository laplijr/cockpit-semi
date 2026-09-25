import { describe, expect, it } from 'vitest'
import { frozenRamp, restoredRamp, type RampWeek } from '~~/server/domain/plan/ramp'

/** Un bloc de l'escalier de 20 km à +10 % : trois montées, une allégée, la relance. */
const BLOCK: RampWeek[] = [
  { index: 1, targetRunM: 20_000, light: false },
  { index: 2, targetRunM: 22_000, light: false },
  { index: 3, targetRunM: 24_200, light: false },
  { index: 4, targetRunM: 16_940, light: true },
  { index: 5, targetRunM: 24_200, light: false },
  { index: 6, targetRunM: 26_620, light: false },
]

describe('frozenRamp', () => {
  it('garde la semaine suivante au volume de la semaine en cours', () => {
    expect(frozenRamp(BLOCK, 1, 1.1)[0]).toEqual({ index: 2, targetRunM: 20_000 })
  })

  it('borne les semaines suivantes au plafond au lieu de reprendre l’escalier', () => {
    expect(frozenRamp(BLOCK, 1, 1.1)).toEqual([
      { index: 2, targetRunM: 20_000 },
      { index: 3, targetRunM: 22_000 },
      { index: 4, targetRunM: 15_400 },
    ])
  })

  it('s’arrête dès que l’escalier d’origine repasse sous la borne', () => {
    const changed = frozenRamp(BLOCK, 1, 1.1).map((change) => change.index)
    expect(changed).not.toContain(5)
  })

  it('ne ramène pas la semaine pleine au volume d’une semaine allégée', () => {
    expect(frozenRamp(BLOCK, 4, 1.1)).toEqual([])
  })

  it('suit le plafond du profil', () => {
    expect(frozenRamp(BLOCK, 1, 1.05)[1]).toEqual({ index: 3, targetRunM: 21_000 })
  })
})

describe('restoredRamp', () => {
  const frozen: RampWeek[] = BLOCK.map((item) =>
    item.index === 2 ? { ...item, targetRunM: 20_000 } : item,
  )

  it('relève la semaine gelée au plafond du profil', () => {
    expect(restoredRamp(frozen, 1, 1.1)).toEqual([{ index: 2, targetRunM: 22_000 }])
  })

  it('respecte un plafond de 5 %', () => {
    expect(restoredRamp(frozen, 1, 1.05)).toEqual([{ index: 2, targetRunM: 21_000 }])
  })

  it('laisse une semaine allégée allégée', () => {
    expect(restoredRamp(BLOCK, 3, 1.1)).toEqual([])
  })

  it('ne baisse jamais une semaine déjà au-dessus', () => {
    expect(restoredRamp(BLOCK, 1, 1.05)).toEqual([])
  })
})
