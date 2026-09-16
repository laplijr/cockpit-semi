import { describe, expect, it } from 'vitest'
import {
  MIN_HISTORY_DAYS,
  arbitraryUnits,
  dailyLoads,
  loadRatio,
  monotony,
} from '~~/server/domain/load/load'
import { addDays } from '~~/server/domain/plan/calendar'
import { Sport } from '~~/server/domain/shared/sport'

const TODAY = '2026-11-18'

/** Une entrée par jour sur `days` jours, en remontant depuis `TODAY`. */
function steady(days: number, rpe: number, durationMin: number, sport = Sport.Running) {
  return Array.from({ length: days }, (_, offset) => ({
    date: addDays(TODAY, -offset),
    sport,
    rpe,
    durationMin,
  }))
}

describe('unités arbitraires', () => {
  it('multiplie le RPE par la durée', () => {
    expect(arbitraryUnits({ rpe: 6, durationMin: 50 })).toBe(300)
  })

  it('agrège par jour et par sport', () => {
    const loads = dailyLoads([
      { date: TODAY, sport: Sport.Running, rpe: 5, durationMin: 60 },
      { date: TODAY, sport: Sport.Strength, rpe: 7, durationMin: 40 },
      { date: addDays(TODAY, -1), sport: Sport.Cycling, rpe: 4, durationMin: 90 },
    ])

    expect(loads).toHaveLength(2)
    const today = loads.at(-1)!
    expect(today.bySport[Sport.Running]).toBe(300)
    expect(today.bySport[Sport.Strength]).toBe(280)
    expect(today.total).toBe(580)
  })

  it('trie les jours du plus ancien au plus récent', () => {
    const loads = dailyLoads(steady(3, 5, 60))
    expect(loads.map((day) => day.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18'])
  })
})

describe('ratio de charge 7 j / 21 j', () => {
  it('reste indisponible sous 28 jours d’historique', () => {
    const loads = dailyLoads(steady(27, 5, 60))
    expect(loadRatio(loads, TODAY, 27)).toBeUndefined()
    expect(loadRatio(loads, TODAY, MIN_HISTORY_DAYS)).toBeDefined()
  })

  it('vaut 1 quand la charge est stable', () => {
    const loads = dailyLoads(steady(40, 5, 60))
    expect(loadRatio(loads, TODAY, 40)!.ratio).toBeCloseTo(1, 2)
  })

  it('découple les fenêtres : la semaine récente ne se compare pas à elle-même', () => {
    const recent = steady(7, 8, 60)
    const older = Array.from({ length: 21 }, (_, offset) => ({
      date: addDays(TODAY, -(7 + offset)),
      sport: Sport.Running,
      rpe: 4,
      durationMin: 60,
    }))

    const result = loadRatio(dailyLoads([...recent, ...older]), TODAY, 40)!
    expect(result.ratio).toBeCloseTo(2, 1)
    expect(result.inReferenceZone).toBe(false)
  })

  it('signale la zone de référence entre 0,8 et 1,3', () => {
    const loads = dailyLoads(steady(40, 5, 60))
    expect(loadRatio(loads, TODAY, 40)!.inReferenceZone).toBe(true)
  })

  it('ne renvoie rien quand la période chronique est vide', () => {
    const loads = dailyLoads(steady(5, 5, 60))
    expect(loadRatio(loads, TODAY, 40)).toBeUndefined()
  })

  it('additionne les sports dans la charge combinée', () => {
    const running = steady(40, 5, 60, Sport.Running)
    const cycling = steady(40, 3, 60, Sport.Cycling)
    const combined = loadRatio(dailyLoads([...running, ...cycling]), TODAY, 40)!
    const alone = loadRatio(dailyLoads(running), TODAY, 40)!
    expect(combined.acute).toBeGreaterThan(alone.acute)
  })
})

describe('monotonie', () => {
  it('n’est pas définie quand la semaine est vide', () => {
    expect(monotony(dailyLoads([]), TODAY)).toBeUndefined()
  })

  it('n’est pas définie quand tous les jours sont identiques', () => {
    expect(monotony(dailyLoads(steady(7, 5, 60)), TODAY)).toBeUndefined()
  })

  it('baisse quand la semaine a du relief', () => {
    const varied = [
      { date: TODAY, sport: Sport.Running, rpe: 8, durationMin: 60 },
      { date: addDays(TODAY, -1), sport: Sport.Running, rpe: 3, durationMin: 40 },
      { date: addDays(TODAY, -3), sport: Sport.Running, rpe: 9, durationMin: 70 },
      { date: addDays(TODAY, -5), sport: Sport.Running, rpe: 3, durationMin: 30 },
    ]
    expect(monotony(dailyLoads(varied), TODAY)!).toBeLessThan(1.5)
  })
})
