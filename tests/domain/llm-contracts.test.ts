import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LookupKey,
  LookupStatus,
  hasUsableDate,
  registrationOpen,
} from '~~/server/domain/races/lookup'
import { Sport } from '~~/server/domain/shared/sport'
import { UnplannedKind } from '~~/server/domain/unplanned/events'
import { MealEmphasis, MealKind, type MealSlot } from '~~/server/domain/nutrition/meal-timing'
import { parseMeals } from '~~/server/infra/llm/meals'
import { parseInterpretation } from '~~/server/infra/llm/unplanned'
import { parseLookup } from '~~/server/infra/search/race-lookup'

/** Sorties réelles enregistrées : aucun appel réseau en CI (§ 10). */
const fixture = (name: string) => readFileSync(join('tests/fixtures/llm', `${name}.json`), 'utf8')

describe('contrat de l’Imprévu (§ 6)', () => {
  it('lit une activité et une indisponibilité dans la même réponse', () => {
    const events = parseInterpretation(fixture('unplanned-squash'))

    expect(events).toHaveLength(2)
    const [activity, unavailability] = events
    expect(activity).toMatchObject({
      kind: UnplannedKind.Activity,
      sport: Sport.Other,
      durationMin: 60,
      rpeEstimate: 6,
    })
    expect(unavailability).toMatchObject({
      kind: UnplannedKind.Unavailability,
      from: '2026-11-27',
      to: '2026-11-27',
    })
  })

  it('accepte une réponse vide : tout texte ne contient pas un événement', () => {
    expect(parseInterpretation(fixture('unplanned-empty'))).toEqual([])
  })

  it('remet une plage inversée dans l’ordre', () => {
    const [event] = parseInterpretation(fixture('unplanned-reversed-range'))
    expect(event).toMatchObject({ from: '2026-12-01', to: '2026-12-05' })
  })

  it('refuse une réponse illisible plutôt que de deviner', () => {
    expect(() => parseInterpretation('pas du json')).toThrow()
  })

  it('refuse une réponse hors schéma', () => {
    expect(() => parseInterpretation('{"events":[{"kind":"activity"}]}')).toThrow()
    expect(() =>
      parseInterpretation('{"events":[{"kind":"activity","sport":"quidditch"}]}'),
    ).toThrow()
  })
})

describe('contrat de la recherche de course (§ 6)', () => {
  it('lit chaque champ avec son statut et ses sources', () => {
    const fields = parseLookup(fixture('race-lookup-madrid'))

    expect(fields[LookupKey.Date]).toMatchObject({
      value: '2027-04-04',
      status: LookupStatus.ToConfirm,
    })
    expect(fields[LookupKey.Name]!.sources).toHaveLength(1)
    expect(fields[LookupKey.ElevationGainM]!.status).toBe(LookupStatus.Estimated)
    expect(hasUsableDate(fields)).toBe(true)
    expect(registrationOpen(fields)).toBe(false)
  })

  it('accepte une course introuvable, tous champs nuls', () => {
    const fields = parseLookup(fixture('race-lookup-not-found'))

    expect(fields[LookupKey.Date]!.value).toBeNull()
    expect(hasUsableDate(fields)).toBe(false)
  })

  it('refuse une source qui n’est pas une URL', () => {
    const broken = JSON.parse(fixture('race-lookup-madrid'))
    broken.name.sources = ['le site officiel']
    expect(() => parseLookup(JSON.stringify(broken))).toThrow()
  })

  it('refuse une réponse à laquelle il manque un champ', () => {
    const broken = JSON.parse(fixture('race-lookup-madrid'))
    delete broken.registration
    expect(() => parseLookup(JSON.stringify(broken))).toThrow()
  })
})

describe('contrat des repas du jour (§ 6, P6.4)', () => {
  const slots: MealSlot[] = [
    { kind: MealKind.Breakfast, hour: 6, emphasis: MealEmphasis.PreSession },
    { kind: MealKind.Snack, hour: 10.5, emphasis: MealEmphasis.Recovery },
    { kind: MealKind.Lunch, hour: 12.5, emphasis: MealEmphasis.Recovery },
    { kind: MealKind.Dinner, hour: 20, emphasis: MealEmphasis.Normal },
  ]

  it('rend un repas par créneau, à l’heure et au rôle du moteur', () => {
    const meals = parseMeals(fixture('meals-long-run'), slots)

    expect(meals).toHaveLength(4)
    expect(meals[0]).toMatchObject({
      kind: MealKind.Breakfast,
      hour: 6,
      emphasis: MealEmphasis.PreSession,
      name: "Flocons d'avoine au skyr",
    })
    expect(meals.at(-1)).toMatchObject({ hour: 20, emphasis: MealEmphasis.Normal })
  })

  it('refuse une liste qui ne recouvre pas les créneaux', () => {
    expect(() => parseMeals(fixture('meals-long-run'), slots.slice(0, 3))).toThrow()
  })

  it('refuse une réponse illisible ou hors schéma', () => {
    expect(() => parseMeals('pas du json', slots)).toThrow()
    expect(() => parseMeals('{"meals":[{"kind":"diner"}]}', slots)).toThrow()
  })
})
