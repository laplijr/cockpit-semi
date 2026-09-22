import { describe, expect, it } from 'vitest'
import { acceptFix, FIX_TOLERANCE, type GeoFix } from '~~/server/domain/tracking/fix'
import {
  flattenWorkout,
  paceGap,
  paceOffBand,
  stepRemaining,
} from '~~/server/domain/tracking/steps'
import {
  averagePace,
  measureTrack,
  offTrackM,
  smoothedPace,
  splits,
} from '~~/server/domain/tracking/track'
import { WorkoutStepKind, type StructuredWorkout } from '~~/server/domain/watch/workout'

const START = { lat: 47.6586, lon: -2.7599 }
const T0 = Date.parse('2027-03-01T08:00:00Z')

/** Un degré de latitude fait 111 320 m : de quoi poser des distances exactes. */
const METRE_IN_LAT = 1 / 111_320

/**
 * Une ligne droite vers le nord, un relevé par seconde à l'allure demandée.
 * C'est la trace la plus simple qui soit, et elle suffit à vérifier tout ce
 * qui se mesure : distance, temps, allure, splits.
 */
function straightRun(seconds: number, paceSecPerKm: number, accuracyM = 6): GeoFix[] {
  const metresPerSecond = 1000 / paceSecPerKm

  return Array.from({ length: seconds + 1 }, (_, index) => ({
    lat: START.lat + index * metresPerSecond * METRE_IN_LAT,
    lon: START.lon,
    accuracyM,
    at: T0 + index * 1000,
  }))
}

describe('relevés retenus (§ 9, P10)', () => {
  it('écarte un relevé trop imprécis', () => {
    const fix = { ...START, accuracyM: 40, at: T0 }
    expect(acceptFix(fix)).toBe(false)
    expect(acceptFix({ ...fix, accuracyM: FIX_TOLERANCE.accuracyM })).toBe(true)
  })

  it('écarte un saut de position impossible à la course', () => {
    const previous = { ...START, accuracyM: 5, at: T0 }
    const jump = {
      lat: START.lat + 200 * METRE_IN_LAT,
      lon: START.lon,
      accuracyM: 5,
      at: T0 + 1000,
    }

    expect(acceptFix(jump, previous)).toBe(false)
  })

  /**
   * Le vélo prend le même écran que la course (§ 9, P10.3) : sans une borne
   * de vitesse à lui, une descente à 50 km/h passerait pour un saut et la
   * moitié de la sortie serait jetée.
   */
  it('accepte à vélo ce qu’il écarte à la course', () => {
    const previous = { ...START, accuracyM: 5, at: T0 }
    const fast = {
      lat: START.lat + 15 * METRE_IN_LAT,
      lon: START.lon,
      accuracyM: 5,
      at: T0 + 1000,
    }

    expect(acceptFix(fast, previous)).toBe(false)
    expect(acceptFix(fast, previous, FIX_TOLERANCE.cyclingMaxSpeedMS)).toBe(true)

    const track = measureTrack([previous, fast], FIX_TOLERANCE.cyclingMaxSpeedMS)
    expect(track.distanceM).toBeGreaterThan(14)
    expect(track.rejected).toBe(0)
  })

  it('écarte un relevé qui remonte dans le temps', () => {
    const previous = { ...START, accuracyM: 5, at: T0 }
    expect(acceptFix({ ...START, accuracyM: 5, at: T0 - 1000 }, previous)).toBe(false)
  })
})

describe('mesure d’une trace (§ 9, P10)', () => {
  it('mesure la distance et le temps d’une ligne droite', () => {
    const track = measureTrack(straightRun(600, 300))

    expect(track.elapsedS).toBe(600)
    expect(track.distanceM).toBeGreaterThan(1980)
    expect(track.distanceM).toBeLessThan(2020)
  })

  it('ne fabrique pas de distance à l’arrêt', () => {
    const stationary: GeoFix[] = Array.from({ length: 31 }, (_, index) => ({
      /** Dérive d'un mètre de part et d'autre, comme à un feu rouge. */
      lat: START.lat + (index % 2 === 0 ? 1 : -1) * METRE_IN_LAT,
      lon: START.lon,
      accuracyM: 8,
      at: T0 + index * 1000,
    }))

    const track = measureTrack(stationary)

    expect(track.distanceM).toBe(0)
    expect(track.elapsedS).toBe(30)
  })

  it('ne compte pas le temps d’un trou : pause déclarée ou signal perdu', () => {
    const before = straightRun(60, 300)
    const after = straightRun(60, 300).map((fix) => ({
      ...fix,
      lat: fix.lat + 200 * METRE_IN_LAT,
      at: fix.at + 600_000,
    }))

    const track = measureTrack([...before, ...after])

    expect(track.elapsedS).toBe(120)
  })

  it('compte les relevés écartés au lieu de les taire', () => {
    const noisy = straightRun(30, 300).map((fix, index) =>
      index === 10 ? { ...fix, accuracyM: 90 } : fix,
    )

    expect(measureTrack(noisy).rejected).toBe(1)
  })

  it('rend une trace vide sans lever', () => {
    const track = measureTrack([])
    expect(track).toMatchObject({ distanceM: 0, elapsedS: 0, points: [] })
  })
})

describe('allure affichée (§ 9, P10)', () => {
  it('lisse l’allure sur la fenêtre', () => {
    const track = measureTrack(straightRun(300, 300))
    expect(smoothedPace(track)).toBeGreaterThan(290)
    expect(smoothedPace(track)).toBeLessThan(310)
  })

  it('ne dit rien tant que la fenêtre ne porte pas de quoi calculer', () => {
    expect(smoothedPace(measureTrack(straightRun(3, 300)))).toBeNull()
    expect(averagePace(measureTrack([]))).toBeNull()
  })

  it('rend l’allure moyenne de la sortie', () => {
    const track = measureTrack(straightRun(600, 330))
    expect(averagePace(track)).toBeGreaterThan(320)
    expect(averagePace(track)).toBeLessThan(340)
  })
})

describe('splits au kilomètre (§ 9, P10)', () => {
  it('rend un temps par kilomètre plein', () => {
    const found = splits(measureTrack(straightRun(950, 300)))

    expect(found.map((split) => split.km)).toEqual([1, 2, 3])
    for (const split of found) {
      expect(split.seconds).toBeGreaterThan(290)
      expect(split.seconds).toBeLessThan(310)
    }
  })

  it('ne rend rien avant le premier kilomètre', () => {
    expect(splits(measureTrack(straightRun(120, 300)))).toEqual([])
  })
})

describe('écart à la boucle proposée (§ 9, P10)', () => {
  const guide = [START, { lat: START.lat + 1000 * METRE_IN_LAT, lon: START.lon }]

  it('mesure la distance à la trace, projection comprise', () => {
    const beside = { lat: START.lat + 500 * METRE_IN_LAT, lon: START.lon + 0.0004 }
    const gap = offTrackM(beside, guide)

    expect(gap).toBeGreaterThan(20)
    expect(gap).toBeLessThan(40)
  })

  it('ne dit rien sans trace à suivre', () => {
    expect(offTrackM(START, [])).toBeNull()
  })
})

describe('progression dans la séance (§ 9, P10)', () => {
  const workout: StructuredWorkout = {
    name: 'Seuil',
    code: 'seuil',
    blocks: [
      {
        repeats: 1,
        steps: [
          {
            kind: WorkoutStepKind.Warmup,
            label: 'Échauffement',
            distanceM: 2000,
            paceSecPerKm: 408,
          },
        ],
      },
      {
        repeats: 3,
        steps: [
          { kind: WorkoutStepKind.Active, label: 'Seuil', durationS: 480, paceSecPerKm: 340 },
          { kind: WorkoutStepKind.Recovery, label: 'Récupération', durationS: 120 },
        ],
      },
    ],
  }

  it('déplie les répétitions en étapes à courir une à une', () => {
    const targets = flattenWorkout(workout)

    expect(targets).toHaveLength(7)
    expect(targets.map((target) => target.label)).toEqual([
      'Échauffement',
      'Seuil',
      'Récupération',
      'Seuil',
      'Récupération',
      'Seuil',
      'Récupération',
    ])
  })

  it('décompte une étape en durée depuis sa marque de départ', () => {
    const targets = flattenWorkout(workout)
    const since = { distanceM: 2600, elapsedS: 1000 }

    const remaining = stepRemaining(targets[1]!, since, { distanceM: 3000, elapsedS: 1228 })

    expect(remaining).toEqual({
      remainingM: null,
      remainingS: 252,
      overM: null,
      overS: 0,
      complete: false,
    })
  })

  it('décompte une étape en distance et la déclare finie', () => {
    const targets = flattenWorkout(workout)
    const since = { distanceM: 0, elapsedS: 0 }

    expect(stepRemaining(targets[0]!, since, { distanceM: 1200, elapsedS: 500 })).toEqual({
      remainingM: 800,
      remainingS: null,
      overM: 0,
      overS: null,
      complete: false,
    })
    expect(stepRemaining(targets[0]!, since, { distanceM: 2000, elapsedS: 820 })).toMatchObject({
      remainingM: 0,
      complete: true,
    })
  })

  it('compte le dépassement au lieu de rester à zéro', () => {
    const targets = flattenWorkout(workout)
    const since = { distanceM: 0, elapsedS: 0 }

    expect(stepRemaining(targets[0]!, since, { distanceM: 2380, elapsedS: 980 })).toMatchObject({
      remainingM: 0,
      overM: 380,
      complete: true,
    })

    expect(
      stepRemaining(targets[1]!, { distanceM: 0, elapsedS: 0 }, { distanceM: 3200, elapsedS: 615 }),
    ).toMatchObject({ remainingS: 0, overS: 135, complete: true })
  })

  it('dit l’écart à l’allure visée, et quand il sort de la bande', () => {
    const targets = flattenWorkout(workout)

    expect(paceGap(targets[1]!, 352)).toBe(12)
    expect(paceOffBand(paceGap(targets[1]!, 352))).toBe(true)
    expect(paceOffBand(paceGap(targets[1]!, 344))).toBe(false)
  })

  it('ne compare rien quand l’étape ne vise pas d’allure', () => {
    const targets = flattenWorkout(workout)

    expect(paceGap(targets[2]!, 400)).toBeNull()
    expect(paceOffBand(null)).toBe(false)
  })
})
