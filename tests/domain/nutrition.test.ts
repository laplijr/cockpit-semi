import { describe, expect, it } from 'vitest'
import { DAILY_TARGETS, DayKind, dayKindOf, gramsFor } from '~~/server/domain/nutrition/daily'
import {
  FuelProduct,
  FuelTier,
  buildFuelPlan,
  tierOf,
  waterPerHour,
} from '~~/server/domain/nutrition/fuel-plan'
import {
  DEFAULT_HOURS,
  MealEmphasis,
  MealKind,
  defaultStartHour,
  formatHour,
  mealTiming,
  type MealSlot,
} from '~~/server/domain/nutrition/meal-timing'
import { raceWeekProtocol } from '~~/server/domain/nutrition/race-week'
import { trainingFuelFor } from '~~/server/domain/nutrition/training-fuel'
import { RunSessionCode } from '~~/server/domain/running/session-types'
import { Sport } from '~~/server/domain/shared/sport'

const run = (code: string, durationMin: number, key = false) => ({
  sport: Sport.Running,
  code,
  key,
  durationMin,
})

describe('type de journée (§ 5)', () => {
  it('suit la séance la plus exigeante, pas le nombre de séances', () => {
    expect(dayKindOf([])).toBe(DayKind.Rest)
    expect(dayKindOf([run(RunSessionCode.Endurance, 50)])).toBe(DayKind.Easy)
    expect(dayKindOf([run(RunSessionCode.Vma, 55, true)])).toBe(DayKind.Quality)
    expect(dayKindOf([run(RunSessionCode.Endurance, 50), run(RunSessionCode.LongRun, 90)])).toBe(
      DayKind.Long,
    )
  })

  it('compte une journée de muscu seule comme une journée facile', () => {
    expect(dayKindOf([{ sport: Sport.Strength, code: 'legs', key: false, durationMin: 45 }])).toBe(
      DayKind.Easy,
    )
  })

  it('le jour de course l’emporte sur la séance du jour', () => {
    expect(dayKindOf([run(RunSessionCode.Endurance, 20)], true)).toBe(DayKind.Race)
  })

  it('monte les glucides avec la charge, sans toucher aux protéines', () => {
    expect(DAILY_TARGETS[DayKind.Rest].carbsGPerKg[1]).toBeLessThan(
      DAILY_TARGETS[DayKind.Long].carbsGPerKg[1],
    )
    expect(DAILY_TARGETS[DayKind.Rest].proteinGPerKg).toEqual(
      DAILY_TARGETS[DayKind.Long].proteinGPerKg,
    )
  })

  it('ne convertit en grammes que si le poids est connu', () => {
    expect(gramsFor([5, 7], 70)).toEqual([350, 490])
    expect(gramsFor([5, 7], null)).toBeNull()
  })
})

describe('ravito d’entraînement', () => {
  it('ne charge rien sous 75 minutes', () => {
    expect(trainingFuelFor(60).carbsGPerHour).toBeNull()
  })

  it('monte à 60 g/h au-delà de deux heures', () => {
    expect(trainingFuelFor(150).carbsGPerHour).toEqual([60, 80])
  })

  it('dit qu’une sortie à l’allure de course répète le ravito du jour J', () => {
    expect(trainingFuelFor(100, true).advice).toContain('répétition du ravito')
  })
})

describe('ravito et hydratation en course (§ 5)', () => {
  it('sépare les trois régimes sur la durée projetée, pas sur la distance', () => {
    expect(tierOf(50 * 60)).toBe(FuelTier.Short)
    expect(tierOf(75 * 60)).toBe(FuelTier.Medium)
    expect(tierOf(125 * 60)).toBe(FuelTier.Long)
  })

  it('sous une heure, ne prescrit rien pendant la course', () => {
    const plan = buildFuelPlan({
      durationS: 45 * 60,
      distanceM: 10000,
      tempC: 12,
      generatedAt: '2027-03-01',
    })

    expect(plan.intakes).toEqual([])
    expect(plan.carbsGPerHour).toBeNull()
    expect(plan.preRace.carbsGPerKg).toEqual([1, 2])
  })

  it('entre 60 et 90 minutes, de l’eau et un gel optionnel à mi-course', () => {
    const plan = buildFuelPlan({
      durationS: 80 * 60,
      distanceM: 15000,
      tempC: 12,
      generatedAt: '2027-03-01',
    })

    expect(plan.carbsGPerHour).toBeNull()
    expect(plan.intakes.filter((intake) => intake.product === FuelProduct.Gel)).toHaveLength(1)
    expect(plan.intakes.find((intake) => intake.product === FuelProduct.Gel)?.optional).toBe(true)
  })

  it('au-delà de 90 minutes, 30 à 60 g de glucides par heure dès la 20e minute', () => {
    const plan = buildFuelPlan({
      durationS: 125 * 60,
      distanceM: 21097.5,
      tempC: 12,
      generatedAt: '2027-03-01',
    })

    expect(plan.carbsGPerHour).toEqual([30, 60])
    expect(plan.intakes[0]?.minute).toBe(20)
    expect(plan.intakes.every((intake) => intake.minute >= 20)).toBe(true)
  })

  it('situe chaque prise au kilomètre, à l’allure projetée', () => {
    const plan = buildFuelPlan({
      durationS: 120 * 60,
      distanceM: 20000,
      tempC: null,
      generatedAt: '2027-03-01',
    })

    /** 20 km en 120′ : 6′/km, donc la prise de la 60e minute tombe au km 10. */
    expect(plan.intakes.find((intake) => intake.minute === 60)?.km).toBe(10)
  })

  it('n’ajoute le sodium qu’au-dessus de 20 °C, et boit davantage', () => {
    const hot = buildFuelPlan({
      durationS: 125 * 60,
      distanceM: 21097.5,
      tempC: 26,
      generatedAt: '2027-03-01',
    })
    const mild = buildFuelPlan({
      durationS: 125 * 60,
      distanceM: 21097.5,
      tempC: 12,
      generatedAt: '2027-03-01',
    })

    expect(hot.sodiumMgPerHour).toEqual([300, 600])
    expect(mild.sodiumMgPerHour).toBeNull()
    expect(waterPerHour(26)[1]).toBeGreaterThan(waterPerHour(12)[1])
  })

  it('rappelle que rien ne s’essaie le jour de la course', () => {
    const plan = buildFuelPlan({
      durationS: 125 * 60,
      distanceM: 21097.5,
      tempC: 12,
      generatedAt: '2027-03-01',
    })

    expect(plan.notes.some((note) => note.includes('sortie longue'))).toBe(true)
  })
})

describe('protocole de la semaine de course (§ 9, P6)', () => {
  it('couvre les huit jours, de J−7 au jour de la course', () => {
    const days = raceWeekProtocol({ raceDate: '2027-03-07', weightKg: 70, fuelPlan: null })

    expect(days).toHaveLength(8)
    expect(days[0]).toMatchObject({ daysBefore: 7, date: '2027-02-28' })
    expect(days.at(-1)).toMatchObject({ daysBefore: 0, date: '2027-03-07' })
  })

  it('ne charge les glucides que sur les trois derniers jours', () => {
    const days = raceWeekProtocol({ raceDate: '2027-03-07', weightKg: 70, fuelPlan: null })
    const carbsAt = (daysBefore: number) =>
      days.find((day) => day.daysBefore === daysBefore)!.carbsGPerKg

    expect(carbsAt(5)).toEqual([5, 7])
    expect(carbsAt(3)).toEqual([8, 10])
    expect(carbsAt(0)).toEqual([8, 10])
  })

  it('donne les grammes quand le poids est connu, les g/kg sinon', () => {
    const withWeight = raceWeekProtocol({ raceDate: '2027-03-07', weightKg: 70, fuelPlan: null })
    const without = raceWeekProtocol({ raceDate: '2027-03-07', weightKg: null, fuelPlan: null })

    expect(withWeight.at(-1)!.carbsG).toEqual([560, 700])
    expect(without.at(-1)!.carbsG).toBeNull()
    expect(without.at(-1)!.details[0]).toContain('par kilo')
  })
})

describe('horaires des repas (§ 9, P6.4)', () => {
  const timed = (code: string, startHour: number, durationMin: number, key = false) => ({
    ...run(code, durationMin, key),
    startHour,
  })

  const at = (slots: MealSlot[], kind: MealKind) => slots.filter((slot) => slot.kind === kind)

  it('garde trois repas et aucune collation le jour de repos', () => {
    const slots = mealTiming([], DayKind.Rest)

    expect(slots.map((slot) => slot.kind)).toEqual([
      MealKind.Breakfast,
      MealKind.Lunch,
      MealKind.Dinner,
    ])
    expect(slots.every((slot) => slot.emphasis === MealEmphasis.Normal)).toBe(true)
  })

  it('pose une collation une heure et demie avant une séance clé de 18 h', () => {
    const slots = mealTiming([timed(RunSessionCode.Vma, 18, 60, true)], DayKind.Quality)
    const [snack] = at(slots, MealKind.Snack)

    expect(snack?.hour).toBe(16.5)
    expect(snack?.emphasis).toBe(MealEmphasis.PreSession)
  })

  it('avance le petit-déjeuner et renforce le déjeuner autour d’une sortie longue du matin', () => {
    const slots = mealTiming([timed(RunSessionCode.LongRun, 8, 100)], DayKind.Long)

    expect(at(slots, MealKind.Breakfast)[0]).toEqual({
      kind: MealKind.Breakfast,
      hour: 6,
      emphasis: MealEmphasis.PreSession,
    })
    expect(at(slots, MealKind.Lunch)[0]?.emphasis).toBe(MealEmphasis.Recovery)
  })

  it('n’avance pas le petit-déjeuner quand la séance laisse le temps de le prendre', () => {
    const slots = mealTiming([timed(RunSessionCode.Endurance, 9, 45)], DayKind.Easy)

    expect(at(slots, MealKind.Breakfast)[0]?.hour).toBe(DEFAULT_HOURS.breakfast)
  })

  it('décale le dîner après une séance qui finit tard', () => {
    const slots = mealTiming([timed(RunSessionCode.Seuil, 20, 75, true)], DayKind.Quality)

    expect(at(slots, MealKind.Dinner)[0]).toEqual({
      kind: MealKind.Dinner,
      hour: 21.75,
      emphasis: MealEmphasis.Recovery,
    })
  })

  it('recharge tout de suite quand la séance du matin finit loin du déjeuner', () => {
    const slots = mealTiming([timed(RunSessionCode.LongRun, 7, 120)], DayKind.Long)

    expect(at(slots, MealKind.Snack)[0]).toEqual({
      kind: MealKind.Snack,
      hour: 9.5,
      emphasis: MealEmphasis.Recovery,
    })
    expect(slots).toHaveLength(4)
  })

  it('rend les créneaux dans l’ordre de l’horloge, trois à cinq par jour', () => {
    const slots = mealTiming(
      [timed(RunSessionCode.LongRun, 7, 120), timed('legs', 18, 60)],
      DayKind.Long,
    )
    const hours = slots.map((slot) => slot.hour)

    expect(hours).toEqual([...hours].sort((a, b) => a - b))
    expect(slots.length).toBeGreaterThanOrEqual(3)
    expect(slots.length).toBeLessThanOrEqual(5)
  })

  it('écrit l’heure comme on la lit', () => {
    expect(formatHour(7)).toBe('7 h')
    expect(formatHour(16.5)).toBe('16 h 30')
  })

  it('fait partir la sortie longue le matin et le reste après le travail', () => {
    expect(defaultStartHour({ code: RunSessionCode.LongRun })).toBe(9)
    expect(defaultStartHour({ code: RunSessionCode.Vma })).toBe(18)
  })
})
