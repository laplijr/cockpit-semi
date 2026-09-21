import { and, asc, eq, inArray, lte } from 'drizzle-orm'
import { calibrateWeek, detectAndStoreHabits } from '../server/application/detect-habits'
import { generateDueFuelPlans } from '../server/application/generate-fuel-plan'
import { recordFeedback, skipSession } from '../server/application/record-feedback'
import { recordStrengthSets } from '../server/application/record-strength-sets'
import { recordTest, testDistanceForVdot } from '../server/application/record-test'
import { resumePause } from '../server/application/resume-pause'
import { Sensation, type Pain } from '../server/domain/load/feedback'
import { MONDAY } from '../server/domain/athlete/constraints'
import { addDays, weekday } from '../server/domain/plan/calendar'
import { SessionStatus } from '../server/domain/plan/session'
import { fixedClock } from '../server/domain/shared/clock'
import { Sport } from '../server/domain/shared/sport'
import type { StrengthSetRecord } from '../server/domain/strength/next-load'
import type { Database } from '../server/infra/db/client'
import {
  createFeedbackGateway,
  createFitnessGateway,
  createPauseGateway,
} from '../server/infra/db/feedback-gateway'
import { athleteWeekIds, createPlanGateway } from '../server/infra/db/plan-gateway'
import {
  acceptProposal,
  expireStaleProposals,
  listProposals,
  refuseProposal,
} from '../server/infra/db/proposal-repository'
import { createStrengthGateway } from '../server/infra/db/strength-gateway'
import { project } from '../server/domain/fitness/projection'
import { RaceStatus } from '../server/domain/races/race'
import { fitnessPoint, race, session } from '../server/infra/db/schema'
import { ProposalStatus } from '../server/domain/rules/proposal-status'
import {
  MISSED_FORMAT_RATE,
  PROPOSAL_ACCEPT_RATE,
  RPE_BIAS_BY_CODE,
  SHORT_NIGHT_RATE,
  SHORT_NIGHT_RPE_COST,
  START_LOAD_KG,
} from './athlete-profile'
import { between, createRandom, type Scenario } from './scenarios'

/** Part des séances prévues qui sont manquées, sans ressenti. */
const MISS_RATE = 0.1
/** Zone surveillée à la reprise, dont la douleur décroît sur trois semaines (§ 0). */
const WATCH_ZONE = 'genou droit, face postérieure'
const COMEBACK_DAYS = 21

interface Progress {
  sessionsDone: number
  sessionsMissed: number
  tests: number
  lastVdot: number
  strengthSets: number
  decisions: number
  habits: number
  objectivesSet: number
}

/** Douleur résiduelle du genou : 3/10 au premier jour, nulle au bout de trois semaines. */
function residualPain(dayIndex: number): Pain | null {
  if (dayIndex >= COMEBACK_DAYS) return null
  const intensity = Math.round(3 * (1 - dayIndex / COMEBACK_DAYS))
  return intensity <= 0 ? null : { zone: WATCH_ZONE, intensity }
}

/** Sensations cohérentes avec l'écart entre le RPE réel et le RPE attendu. */
function sensationsFor(delta: number): Sensation[] {
  if (delta >= 2) return [Sensation.HeavyLegs, Sensation.Breathless]
  if (delta >= 1) return [Sensation.HeavyLegs]
  if (delta <= -1) return [Sensation.FreshLegs]
  return [Sensation.Easy]
}

interface PlannedRow {
  id: number
  date: string
  sport: string
  code: string
  key: boolean
  prescription: {
    totalDistanceM: number
    expectedRpe: number
    durationMin?: number
    steps: { paceSecPerKm?: number; exerciseId?: string; reps?: number; repeats?: number }[]
  }
}

async function plannedOn(db: Database, athleteId: number, date: string): Promise<PlannedRow[]> {
  const rows = await db
    .select()
    .from(session)
    .where(
      and(
        eq(session.date, date),
        eq(session.status, SessionStatus.Planned),
        inArray(session.weekId, athleteWeekIds(db, athleteId)),
      ),
    )
    .orderBy(asc(session.id))

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    sport: row.sport,
    code: row.code,
    key: row.key,
    prescription: row.prescription as PlannedRow['prescription'],
  }))
}

/**
 * Durée prévue d'une séance : celle que porte la prescription pour le vélo et
 * la muscu, sinon celle que donnent la distance et l'allure de la course.
 */
function plannedMinutes(row: PlannedRow): number {
  if (row.prescription.durationMin) return row.prescription.durationMin
  const pace = row.prescription.steps.find((step) => step.paceSecPerKm)?.paceSecPerKm ?? 420
  return Math.max(15, Math.round(((row.prescription.totalDistanceM / 1000) * pace) / 60))
}

/** Une séance sans kilométrage n'en déclare pas : le réalisé reste en durée. */
function actualDistanceM(row: PlannedRow, spread: number): number | null {
  if (row.prescription.totalDistanceM === 0) return null
  return Math.round(row.prescription.totalDistanceM * spread)
}

async function currentVdot(db: Database, athleteId: number): Promise<number> {
  const [row] = await db
    .select()
    .from(fitnessPoint)
    .where(eq(fitnessPoint.athleteId, athleteId))
    .orderBy(asc(fitnessPoint.date))
    .limit(50)
    .then((rows) => rows.slice(-1))
  return row?.vdot ?? 33
}

/**
 * Séries d'une séance de renforcement, telles que Ronan les saisirait : le
 * format prescrit, à la charge tenue la fois d'avant, et la dernière série un
 * cran plus dure que les autres.
 */
function strengthSetsFor(
  row: PlannedRow,
  loads: Map<string, number>,
  random: () => number,
): StrengthSetRecord[] {
  const sets: StrengthSetRecord[] = []

  for (const step of row.prescription.steps) {
    if (!step.exerciseId || step.reps === undefined) continue

    const loadKg = loads.get(step.exerciseId) ?? START_LOAD_KG[step.exerciseId] ?? 0
    const count = step.repeats ?? 1
    /** Un jour sur cinq, la dernière série s'arrête court : la charge ne monte pas. */
    const missed = random() < MISSED_FORMAT_RATE

    for (let index = 1; index <= count; index += 1) {
      const last = index === count
      sets.push({
        exerciseId: step.exerciseId,
        index,
        reps: last && missed ? Math.max(1, step.reps - 2) : step.reps,
        loadKg,
        rpe: last ? (missed ? 9 : 8) : 7,
      })
    }
  }

  return sets
}

/**
 * Ronan décide ce qui lui est proposé plutôt que de laisser expirer : il en
 * accepte un peu plus de la moitié. Sans ça, le taux d'acceptation ne mesure
 * que des propositions périmées (§ 9, P3).
 */
async function decidePending(
  db: Database,
  athleteId: number,
  today: string,
  random: () => number,
): Promise<number> {
  const pending = (await listProposals(db, athleteId)).filter(
    (row) => row.status === ProposalStatus.Proposed,
  )

  for (const row of pending) {
    if (random() < PROPOSAL_ACCEPT_RATE) await acceptProposal(db, athleteId, row.id, today)
    else await refuseProposal(db, athleteId, row.id)
  }

  return pending.length
}

const DAY_MS = 86_400_000
const DAYS_PER_WEEK = 7

/**
 * Ce que Ronan fait après son premier test : il pose enfin les trois niveaux
 * de sa course A, là où le seed les laissait à fixer. Le moteur les propose
 * depuis les trois bornes de l'intervalle, il les accepte tels quels (§ 5,
 * objectif à trois niveaux) — c'est la saisie du dialog Course, pas un calcul.
 */
async function setObjectivesFromProjection(
  db: Database,
  athleteId: number,
  today: string,
  vdot: number,
  testHistory: number[],
): Promise<number> {
  const open = await db
    .select()
    .from(race)
    .where(and(eq(race.athleteId, athleteId), eq(race.status, RaceStatus.Planned)))
  const pending = open.filter((row) => row.date > today && row.objectifS === null)

  for (const row of pending) {
    const weeksToRace = Math.max(
      0,
      (Date.parse(row.date) - Date.parse(today)) / DAY_MS / DAYS_PER_WEEK,
    )
    const projection = project({
      vdot,
      isFloor: false,
      testHistory,
      weeksToRace,
      distanceM: row.distanceM,
      elevationGainM: row.elevationGainM,
      expectedTempC: row.expectedTempC,
    })

    await db
      .update(race)
      .set({
        objectifAmbitionS: projection.lowS,
        objectifS: projection.timeS,
        objectifPlancherS: projection.highS,
      })
      .where(and(eq(race.id, row.id), eq(race.athleteId, athleteId)))
  }

  return pending.length
}

/**
 * Rejoue l'historique jour par jour, de la reprise au jour simulé, en passant
 * par les mêmes cas d'usage que l'application : rien n'est inséré à la main.
 */
export async function simulate(
  db: Database,
  athleteId: number,
  scenario: Scenario,
): Promise<Progress> {
  if (!scenario.resumeDate) {
    return {
      sessionsDone: 0,
      sessionsMissed: 0,
      tests: 0,
      lastVdot: 33,
      strengthSets: 0,
      decisions: 0,
      habits: 0,
      objectivesSet: 0,
    }
  }

  const random = createRandom(scenario.seed)
  const plans = createPlanGateway(db, athleteId)
  const feedbackGateway = createFeedbackGateway(db, athleteId)

  await resumePause(createPauseGateway(db, athleteId), plans, fixedClock(scenario.resumeDate))

  const strength = createStrengthGateway(db, athleteId)
  /** Charge tenue au dernier passage, par exercice : elle monte d'une séance à l'autre. */
  const loads = new Map<string, number>()

  const progress: Progress = {
    sessionsDone: 0,
    sessionsMissed: 0,
    tests: 0,
    lastVdot: await currentVdot(db, athleteId),
    strengthSets: 0,
    decisions: 0,
    habits: 0,
    objectivesSet: 0,
  }

  const lastWeekStart = addDays(scenario.simulatedDay, -6)
  /** VDOT des tests successifs : c'est lui qui donne l'intervalle de projection. */
  const testHistory: number[] = []

  for (let date = scenario.resumeDate; date <= scenario.simulatedDay; date = addDays(date, 1)) {
    const clock = fixedClock(date)
    // Le cron quotidien tourne aussi dans la simulation : sans lui, les
    // propositions jamais décidées s'accumuleraient indéfiniment.
    await expireStaleProposals(db, athleteId, date)
    // Les propositions de la dernière semaine restent en attente : l'état final
    // doit montrer un cockpit qui a quelque chose à décider (§ P3.5).
    if (date < lastWeekStart) {
      progress.decisions += await decidePending(db, athleteId, date, random)
    }

    /**
     * Le reste du cron quotidien, sa part déterministe : les plans ravito de
     * J−7, puis la relecture des habitudes et la calibration, hebdomadaires.
     * La revérification des courses en est exclue : elle appelle le réseau.
     */
    await generateDueFuelPlans(db, athleteId, date)
    if (weekday(date) === MONDAY || date === scenario.simulatedDay) {
      progress.habits = await detectAndStoreHabits(db, athleteId, date)
      await calibrateWeek(db, athleteId, date)
    }
    const dayIndex = Math.round((Date.parse(date) - Date.parse(scenario.resumeDate)) / 86_400_000)

    /**
     * Un test régénère le plan et remplace les séances encore prévues : on
     * relit la journée après chaque séance plutôt que de garder des identifiants
     * périmés. Une séance close sort de `plannedOn`, la boucle finit donc.
     */
    for (
      let row = (await plannedOn(db, athleteId, date))[0];
      row;
      row = (await plannedOn(db, athleteId, date))[0]
    ) {
      if (row.code === 'test') {
        const target = progress.lastVdot + scenario.vdotGainPerTest
        const distanceM = testDistanceForVdot(target)

        // La séance est d'abord close, sinon la régénération la remplacerait
        // et le test apparaîtrait comme manqué.
        await recordFeedback(feedbackGateway, clock, {
          sessionId: row.id,
          rpe: row.prescription.expectedRpe,
          sensations: sensationsFor(0),
          sleepHours: 7.5,
          pain: residualPain(dayIndex),
          durationMin: plannedMinutes(row),
          distanceM: row.prescription.totalDistanceM,
          notes: `Test 20′ : ${distanceM} m`,
        })

        const result = await recordTest(createFitnessGateway(db, athleteId), plans, clock, {
          distanceM,
          date,
        })
        progress.lastVdot = result.vdot
        progress.tests += 1
        progress.sessionsDone += 1
        testHistory.push(result.vdot)

        /** Le premier test recale le VDOT : c'est là que les objectifs se posent. */
        if (progress.tests === 1) {
          progress.objectivesSet = await setObjectivesFromProjection(
            db,
            athleteId,
            date,
            result.vdot,
            testHistory,
          )
        }
        continue
      }

      if (random() < MISS_RATE) {
        await skipSession(feedbackGateway, row.id)
        progress.sessionsMissed += 1
        continue
      }

      // Dernière semaine : deux séances clés d'affilée nettement trop dures,
      // pour qu'au moins une règle se déclenche dans l'état final.
      const forceHard = date >= lastWeekStart && row.key

      /** Une nuit courte de temps en temps, et elle se paie le lendemain (§ 5). */
      const shortNight = random() < SHORT_NIGHT_RATE
      const sleepHours = shortNight
        ? Math.round(between(random, 4.5, 5.9) * 2) / 2
        : Math.round(between(random, 6.5, 8) * 2) / 2

      const bias = RPE_BIAS_BY_CODE[row.code] ?? 0
      const raw = forceHard
        ? 2
        : bias + (shortNight ? SHORT_NIGHT_RPE_COST : 0) + between(random, -0.5, 0.5)
      const delta = Math.round(raw)
      const rpe = Math.min(10, Math.max(1, row.prescription.expectedRpe + delta))
      const spread = between(random, 0.95, 1.05)

      await recordFeedback(feedbackGateway, clock, {
        sessionId: row.id,
        rpe,
        sensations: sensationsFor(delta),
        sleepHours,
        pain: residualPain(dayIndex),
        durationMin: Math.round(plannedMinutes(row) * spread),
        distanceM: actualDistanceM(row, spread),
        notes: null,
      })
      progress.sessionsDone += 1

      // Une séance de renforcement se clôt par ses charges : sans elles, la
      // courbe de Progression et la charge suivante n'ont rien à lire (§ 9, P4).
      if (row.sport === Sport.Strength) {
        const sets = strengthSetsFor(row, loads, random)
        if (sets.length > 0) {
          const next = await recordStrengthSets(strength, row.id, sets)
          for (const item of next) loads.set(item.exerciseId, item.loadKg)
          progress.strengthSets += sets.length
        }
      }
    }
  }

  // Les séances passées jamais traitées restent des séances manquées.
  const stale = await db
    .select({ id: session.id })
    .from(session)
    .where(and(lte(session.date, scenario.simulatedDay), eq(session.status, SessionStatus.Planned)))

  for (const row of stale) {
    await skipSession(feedbackGateway, row.id)
    progress.sessionsMissed += 1
  }

  return progress
}
