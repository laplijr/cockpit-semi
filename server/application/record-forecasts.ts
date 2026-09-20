import { ForecastTarget } from '../domain/fitness/accuracy'
import { confidence } from '../domain/fitness/confidence'
import { pausedWeeksUntil, project, projectVdot, weeksAhead } from '../domain/fitness/projection'
import { vdotFromRace } from '../domain/fitness/vdot'
import type { IsoDate } from '../domain/plan/calendar'
import type { GeneratedPlan } from '../domain/plan/generate'
import { RunSessionCode } from '../domain/running/session-types'
import type {
  FitnessSnapshot,
  ForecastContext,
  ForecastResolution,
  IssuedForecast,
  PlanGateway,
} from './ports'

/**
 * Date du prochain test 20′ dans le plan généré. Un plan provisoire n'en a
 * pas : ses semaines bougeront à la reprise, et annoncer une date reviendrait
 * à promettre un calendrier qui n'existe pas encore (§ 5).
 */
export function nextTestDate(plan: GeneratedPlan, today: IsoDate): IsoDate | null {
  if (plan.provisional || plan.startDate === null) return null

  const week = plan.weeks.find((item) => item.test && item.endDate >= today)
  if (!week) return null

  const session = week.sessions.find((item) => item.code === RunSessionCode.Test)
  return session?.date ?? week.startDate
}

export interface ForecastInput {
  today: IsoDate
  fitness: FitnessSnapshot | undefined
  gainPerBlock: number
  nextTestDate: IsoDate | null
  openPause: { estimatedEndDate: IsoDate | null } | undefined
}

/**
 * Ce que le cockpit annonce aujourd'hui, une ligne par cible : le prochain
 * test et chaque course encore à courir. Sans point de forme, il n'y a rien à
 * annoncer (§ 9, P6.6).
 */
export function issueForecasts(context: ForecastContext, input: ForecastInput): IssuedForecast[] {
  const { today, fitness, gainPerBlock, openPause } = input
  if (!fitness) return []

  const testHistory = context.tests.map((test) => test.vdot)

  const shared = (targetDate: IsoDate) => ({
    vdot: fitness.vdot,
    isFloor: fitness.isFloor,
    testHistory,
    pausedWeeks: pausedWeeksUntil(today, targetDate, openPause),
    gainPerBlock,
  })

  const forecastFor = (targetDate: IsoDate) =>
    projectVdot({ ...shared(targetDate), weeksAhead: weeksAhead(today, targetDate) })

  const test: IssuedForecast[] = []
  if (input.nextTestDate !== null) {
    const forecast = forecastFor(input.nextTestDate)
    test.push({
      target: ForecastTarget.Test,
      raceId: null,
      issuedDate: today,
      targetDate: input.nextTestDate,
      projectedVdot: forecast.vdot,
      lowVdot: forecast.lowVdot,
      highVdot: forecast.highVdot,
      /** Un test ne vise aucun chrono : il n'y a pas de confiance à en tirer. */
      confidencePct: null,
    })
  }

  const races: IssuedForecast[] = context.races
    .filter((race) => race.resultS === null && race.date > today)
    .map((race) => {
      const forecast = forecastFor(race.date)
      const timed = project({
        ...shared(race.date),
        weeksToRace: weeksAhead(today, race.date),
        distanceM: race.distanceM,
        elevationGainM: race.elevationGainM,
        expectedTempC: race.expectedTempC,
      })

      return {
        target: ForecastTarget.Race,
        raceId: race.id,
        issuedDate: today,
        targetDate: race.date,
        projectedVdot: forecast.vdot,
        lowVdot: forecast.lowVdot,
        highVdot: forecast.highVdot,
        confidencePct: confidence(timed, { targetS: race.targetS }),
      }
    })

  return [...test, ...races]
}

/**
 * Les prévisions que l'échéance a rattrapées. Une prévision de test se résout
 * au premier test passé depuis son émission ; une prévision de course, au
 * chrono de cette course (§ 9, P6.6).
 */
export function resolveForecasts(context: ForecastContext): ForecastResolution[] {
  const racesById = new Map(context.races.map((race) => [race.id, race]))

  return context.open.flatMap((open) => {
    if (open.target === ForecastTarget.Test) {
      const test = context.tests.find((item) => item.date > open.issuedDate)
      return test ? [resolution(open, test.vdot, test.date)] : []
    }

    const race = open.raceId === null ? undefined : racesById.get(open.raceId)
    if (!race || race.resultS === null) return []

    return [resolution(open, vdotFromRace(race.distanceM, race.resultS), race.date)]
  })
}

function resolution(
  open: { id: number; projectedVdot: number },
  actualVdot: number,
  resolvedDate: IsoDate,
): ForecastResolution {
  return {
    id: open.id,
    actualVdot,
    gapVdot: actualVdot - open.projectedVdot,
    resolvedDate,
  }
}

/**
 * Le pas de la boucle de crédibilité, joué à chaque régénération : on confronte
 * ce qui est arrivé, puis on annonce ce qu'on attend. Rien n'est écrasé — c'est
 * l'historique complet des annonces qui dit si le moteur mérite qu'on le croie.
 */
export async function recordForecasts(gateway: PlanGateway, input: ForecastInput): Promise<void> {
  const context = await gateway.loadForecastContext()

  const resolved = resolveForecasts(context)
  const issued = issueForecasts(context, input)

  if (resolved.length === 0 && issued.length === 0) return
  await gateway.saveForecasts(resolved, issued)
}
