import { and, asc, eq, gte } from 'drizzle-orm'
import { readMealPlans } from '../infra/db/meal-plan-gateway'
import {
  DAILY_TARGETS,
  dayKindOf,
  gramsFor,
  type DaySession,
  type Range,
} from '../domain/nutrition/daily'
import { PROTOCOL_DAYS, raceWeekProtocol } from '../domain/nutrition/race-week'
import { trainingFuelFor } from '../domain/nutrition/training-fuel'
import { addDays } from '../domain/plan/calendar'
import { RaceStatus } from '../domain/races/race'
import { RunSessionCode } from '../domain/running/session-types'
import { prescribedDurationMin, type Prescription } from '../domain/shared/prescription'
import { useDatabase } from '../infra/db/client'
import { loadActivePlanVersion } from '../infra/db/plan-gateway'
import { athlete, race } from '../infra/db/schema'
import { currentAthleteId, systemClock } from '../utils/context'

/**
 * Repères du jour et du lendemain, ravito d'entraînement des séances prévues,
 * et protocole de la semaine de course quand une course est à moins de sept
 * jours (§ 9, P6). Aucun LLM : tout vient du plan et des repères du § 5.
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const db = useDatabase()
  const today = systemClock.today()
  const tomorrow = addDays(today, 1)

  const [[profile], active, upcoming, meals] = await Promise.all([
    db
      .select({ weightKg: athlete.weightKg })
      .from(athlete)
      .where(eq(athlete.id, athleteId))
      .limit(1),
    loadActivePlanVersion(db, athleteId),
    db
      .select()
      .from(race)
      .where(
        and(
          eq(race.athleteId, athleteId),
          eq(race.status, RaceStatus.Planned),
          gte(race.date, today),
        ),
      )
      .orderBy(asc(race.date)),
    /** Lecture seule : la page n'appelle jamais le modèle (§ 1, P6.4). */
    readMealPlans(db, athleteId, [today, tomorrow]),
  ])

  const weightKg = profile?.weightKg ?? null
  const sessionsOn = (date: string): DaySession[] =>
    (active?.sessions ?? [])
      .filter((session) => session.date === date)
      .map((session) => ({
        sport: session.sport,
        code: session.code,
        key: session.key,
        durationMin: prescribedDurationMin(session.prescription as unknown as Prescription),
      }))

  const raceOn = (date: string) => upcoming.some((row) => row.date === date)
  const nextRace = upcoming.at(0)
  const daysToRace = nextRace ? daysBetween(today, nextRace.date) : null

  return {
    today,
    weightKg,
    references: Object.entries(DAILY_TARGETS).map(([kind, targets]) => ({
      kind,
      carbsGPerKg: targets.carbsGPerKg,
      carbsG: gramsFor(targets.carbsGPerKg, weightKg),
      proteinGPerKg: targets.proteinGPerKg,
      proteinG: gramsFor(targets.proteinGPerKg, weightKg),
      fatGPerKg: targets.fatGPerKg,
      fatG: gramsFor(targets.fatGPerKg, weightKg),
    })),
    days: [today, tomorrow].map((date) => ({
      ...dayOf(date, sessionsOn(date), raceOn(date), weightKg),
      mealPlan: meals.get(date)?.meals ?? null,
    })),
    raceWeek:
      nextRace && daysToRace !== null && daysToRace <= PROTOCOL_DAYS
        ? {
            race: { id: nextRace.id, name: nextRace.name, date: nextRace.date },
            daysToRace,
            protocol: raceWeekProtocol({
              raceDate: nextRace.date,
              weightKg,
              fuelPlan: nextRace.fuelPlan,
            }),
            fuelPlan: nextRace.fuelPlan,
          }
        : null,
  }
})

function dayOf(date: string, sessions: DaySession[], isRaceDay: boolean, weightKg: number | null) {
  const kind = dayKindOf(sessions, isRaceDay)
  const targets = DAILY_TARGETS[kind]

  return {
    date,
    kind,
    carbsGPerKg: targets.carbsGPerKg,
    carbsG: gramsFor(targets.carbsGPerKg, weightKg),
    sessions: sessions.map((session) => ({
      code: session.code,
      sport: session.sport,
      durationMin: session.durationMin,
      fuel: trainingFuelFor(
        session.durationMin,
        session.code === RunSessionCode.HalfPace || session.code === RunSessionCode.LongRun,
      ),
    })),
  }
}

const DAY_MS = 86_400_000

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS)
}

export type { Range }
