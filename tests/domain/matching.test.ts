import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ESTIMATED_RPE,
  estimateRpe,
  matchActivity,
  sportFromStrava,
} from '~~/server/domain/matching/match-activity'
import { Sport } from '~~/server/domain/shared/sport'

const RUN = {
  externalId: '123',
  sport: Sport.Running,
  date: '2026-11-18',
  durationS: 3600,
}

const SESSIONS = [
  { id: 1, date: '2026-11-17', sport: Sport.Running, alreadyMatched: false },
  { id: 2, date: '2026-11-18', sport: Sport.Running, alreadyMatched: false },
  { id: 3, date: '2026-11-18', sport: Sport.Cycling, alreadyMatched: false },
]

describe('rattachement d’une activité', () => {
  it('rattache à la séance du même jour et du même sport', () => {
    expect(matchActivity(RUN, SESSIONS)).toEqual({ kind: 'session', sessionId: 2 })
  })

  it('accepte un écart d’un jour', () => {
    const result = matchActivity({ ...RUN, date: '2026-11-19' }, [SESSIONS[1]!])
    expect(result).toEqual({ kind: 'session', sessionId: 2 })
  })

  it('refuse un écart de deux jours', () => {
    const result = matchActivity({ ...RUN, date: '2026-11-20' }, [SESSIONS[1]!])
    expect(result.kind).toBe('unplanned')
  })

  it('ne rattache jamais à un sport différent', () => {
    const result = matchActivity({ ...RUN, sport: Sport.Cycling }, [SESSIONS[1]!])
    expect(result.kind).toBe('unplanned')
  })

  it('ignore une séance déjà rattachée', () => {
    const result = matchActivity(RUN, [{ ...SESSIONS[1]!, alreadyMatched: true }])
    expect(result.kind).toBe('unplanned')
  })

  it('choisit la séance la plus proche quand plusieurs conviennent', () => {
    expect(matchActivity(RUN, SESSIONS)).toEqual({ kind: 'session', sessionId: 2 })
  })
})

describe('RPE estimé', () => {
  it('retient une valeur neutre sans fréquence cardiaque', () => {
    expect(estimateRpe(null, 185)).toBe(DEFAULT_ESTIMATED_RPE)
    expect(estimateRpe(150, null)).toBe(DEFAULT_ESTIMATED_RPE)
  })

  it('monte avec l’intensité', () => {
    expect(estimateRpe(120, 185)).toBeLessThan(estimateRpe(170, 185))
  })

  it('reste borné entre 1 et 10', () => {
    expect(estimateRpe(60, 185)).toBeGreaterThanOrEqual(1)
    expect(estimateRpe(200, 185)).toBeLessThanOrEqual(10)
  })

  it('accompagne un imprévu non rattaché', () => {
    const result = matchActivity({ ...RUN, date: '2026-11-25', averageHr: 170 }, SESSIONS, 185)
    expect(result).toEqual({ kind: 'unplanned', estimatedRpe: estimateRpe(170, 185) })
  })
})

describe('sports Strava', () => {
  it('reconnaît la course, le vélo et la muscu', () => {
    expect(sportFromStrava('Run')).toBe(Sport.Running)
    expect(sportFromStrava('TrailRun')).toBe(Sport.Running)
    expect(sportFromStrava('Ride')).toBe(Sport.Cycling)
    expect(sportFromStrava('VirtualRide')).toBe(Sport.Cycling)
    expect(sportFromStrava('WeightTraining')).toBe(Sport.Strength)
  })

  it('range l’inconnu dans « autre »', () => {
    expect(sportFromStrava('Kitesurf')).toBe(Sport.Other)
  })
})
