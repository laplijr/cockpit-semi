import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm'
import type {
  AthleteSnapshot,
  FitnessSnapshot,
  ForecastContext,
  ForecastResolution,
  IssuedForecast,
  PauseSnapshot,
  PlanGateway,
  PlanParameters,
} from '../../application/ports'
import {
  DEFAULT_CONSTRAINTS,
  DEFAULT_PEAK_VOLUME_M,
  DEFAULT_START_VOLUME_M,
} from '../../domain/athlete/constraints'
import { STANDARD_INCREASE_PCT, defaultsFor } from '../../domain/athlete/profile'
import type { GeneratedPlan, RecentRun } from '../../domain/plan/generate'
import type { PlannedRace } from '../../domain/plan/periodization'
import { SessionOrigin, SessionStatus, type PlanTrigger } from '../../domain/plan/session'
import type { ForecastTarget } from '../../domain/fitness/accuracy'
import { FitnessOrigin } from '../../domain/fitness/fitness-point'
import { VDOT_GAIN_PER_BLOCK } from '../../domain/fitness/projection'
import { ObjectiveMode, RaceStatus } from '../../domain/races/race'
import { personalRecords, recordFor } from '../../domain/races/records'
import { currentFitnessOf } from '../../domain/fitness/current'
import type { IsoDate } from '../../domain/plan/calendar'
import { Sport } from '../../domain/shared/sport'
import type { Database } from './client'
import {
  activity,
  athlete,
  feedback,
  fitnessPoint,
  forecast,
  pause,
  phase,
  planVersion,
  race,
  session,
  week,
} from './schema'

export function createPlanGateway(db: Database, athleteId: number): PlanGateway {
  return {
    async loadAthlete(): Promise<AthleteSnapshot | undefined> {
      const [row] = await db.select().from(athlete).where(eq(athlete.id, athleteId)).limit(1)
      if (!row) return undefined
      return {
        constraints: row.constraints ?? DEFAULT_CONSTRAINTS,
        startWeeklyVolumeM: row.startWeeklyVolumeM ?? DEFAULT_START_VOLUME_M,
        peakWeeklyVolumeM: row.peakWeeklyVolumeM ?? DEFAULT_PEAK_VOLUME_M,
        maxWeeklyIncreasePct: row.profile
          ? defaultsFor(row.profile).maxWeeklyIncreasePct
          : STANDARD_INCREASE_PCT,
        vdotGainPerBlock: row.vdotGainPerBlock ?? VDOT_GAIN_PER_BLOCK,
        onboarded: row.onboarded,
      }
    },

    async loadRaces(): Promise<PlannedRace[]> {
      const rows = await db
        .select()
        .from(race)
        .where(and(eq(race.athleteId, athleteId), eq(race.status, RaceStatus.Planned)))
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        date: row.date,
        distanceM: row.distanceM,
        priority: row.priority,
        objectiveMode: row.objectiveMode,
      }))
    },

    /**
     * Déclarer puis rouvrir une pause le même jour laisse plusieurs lignes à la
     * même date de début : l'identifiant départage, sinon la pause ouverte peut
     * se faire doubler par la précédente, déjà close.
     */
    async loadLatestPause(): Promise<PauseSnapshot | undefined> {
      const [row] = await db
        .select()
        .from(pause)
        .where(eq(pause.athleteId, athleteId))
        .orderBy(desc(pause.startDate), desc(pause.id))
        .limit(1)
      if (!row) return undefined
      return {
        id: row.id,
        type: row.type,
        zone: row.zone,
        startDate: row.startDate,
        estimatedEndDate: row.estimatedEndDate,
        endDate: row.endDate,
        allowances: row.allowances,
        watchZones: row.watchZones,
        notes: row.notes,
      }
    },

    /** La règle est au domaine : ce n'est pas le plus récent qui gagne (P7.5). */
    async loadCurrentFitness(today: IsoDate): Promise<FitnessSnapshot | undefined> {
      const rows = await db
        .select({ date: fitnessPoint.date, vdot: fitnessPoint.vdot, isFloor: fitnessPoint.isFloor })
        .from(fitnessPoint)
        .where(eq(fitnessPoint.athleteId, athleteId))
        .orderBy(desc(fitnessPoint.date), desc(fitnessPoint.id))

      return currentFitnessOf(rows, today)
    },

    async loadLastTestDate(): Promise<string | null> {
      const [row] = await db
        .select({ date: fitnessPoint.date })
        .from(fitnessPoint)
        .where(
          and(eq(fitnessPoint.athleteId, athleteId), eq(fitnessPoint.origin, FitnessOrigin.Test)),
        )
        .orderBy(desc(fitnessPoint.date))
        .limit(1)
      return row?.date ?? null
    },

    async loadRunsSince(date: IsoDate): Promise<RecentRun[]> {
      const rows = await db
        .select({ date: activity.date, distanceM: activity.distanceM })
        .from(activity)
        .where(
          and(
            eq(activity.athleteId, athleteId),
            eq(activity.sport, Sport.Running),
            gte(activity.date, date),
            isNotNull(activity.distanceM),
          ),
        )
      return rows.map((row) => ({ date: row.date, distanceM: row.distanceM! }))
    },

    async savePlan(
      plan: GeneratedPlan,
      trigger: PlanTrigger,
      parameters: PlanParameters,
    ): Promise<number> {
      /** La version qu'on remplace : c'est d'elle, et d'elle seule, qu'on reprend. */
      const [superseded] = await db
        .select({ id: planVersion.id })
        .from(planVersion)
        .where(eq(planVersion.athleteId, athleteId))
        .orderBy(desc(planVersion.createdAt), desc(planVersion.id))
        .limit(1)

      const [version] = await db
        .insert(planVersion)
        .values({ athleteId, trigger, parameters, startDate: plan.startDate })
        .returning({ id: planVersion.id })

      const planVersionId = version!.id

      if (plan.phases.length > 0) {
        await db.insert(phase).values(
          plan.phases.map((item) => ({
            planVersionId,
            type: item.type,
            startWeek: item.startWeek,
            endWeek: item.endWeek,
            raceId: item.raceId,
          })),
        )
      }

      for (const generated of plan.weeks) {
        const [stored] = await db
          .insert(week)
          .values({
            planVersionId,
            index: generated.index,
            startDate: generated.startDate,
            endDate: generated.endDate,
            phaseType: generated.phaseType,
            raceId: generated.raceId,
            targetRunM: generated.targetRunM,
            longRunMaxM: generated.longRunMaxM,
            light: generated.light,
            comebackRatio: generated.comebackRatio ?? null,
            phaseProgress: generated.phaseProgress,
            test: generated.test,
            runs: generated.runs,
            targetCyclingMin: generated.targetCyclingMin,
            targetStrengthCount: generated.targetStrengthCount,
            volumeCapped: generated.volumeCapped,
          })
          .returning({ id: week.id })

        const rows = [
          ...generated.sessions.map((item) => ({
            date: item.date,
            sport: Sport.Running,
            code: item.code as string,
            prescription: item.prescription as unknown as Record<string, unknown>,
            key: item.key,
          })),
          ...generated.support.map((item) => ({
            date: item.date,
            sport: item.sport,
            code: item.code as string,
            prescription: item.prescription as unknown as Record<string, unknown>,
            key: false,
          })),
        ]

        if (rows.length === 0) continue

        await db.insert(session).values(rows.map((row) => ({ ...row, weekId: stored!.id })))
      }

      // Une régénération ne repose que ce qui n'est encore qu'une prévision (§ 5, P8.5).
      await carryDecidedDays(db, planVersionId, superseded?.id)

      // Une version périmée ne garde que son historique : ses séances encore
      // prévues sont remplacées par celles de la nouvelle version.
      await db.delete(session).where(
        and(
          eq(session.status, SessionStatus.Planned),
          /** Les semaines de l'athlète, et elles seules : la suppression est cloisonnée. */
          inArray(session.weekId, athleteWeekIds(db, athleteId)),
          notInArray(
            session.weekId,
            db.select({ id: week.id }).from(week).where(eq(week.planVersionId, planVersionId)),
          ),
        ),
      )

      return planVersionId
    },

    async withPlanLock<T>(run: () => Promise<T>): Promise<T> {
      await acquirePlanLock(db, athleteId)
      try {
        return await run()
      } finally {
        await db.update(athlete).set({ planLockedUntil: null }).where(eq(athlete.id, athleteId))
      }
    },

    async loadForecastContext(): Promise<ForecastContext> {
      const [tests, races, open] = await Promise.all([
        db
          .select({ date: fitnessPoint.date, vdot: fitnessPoint.vdot })
          .from(fitnessPoint)
          .where(
            and(eq(fitnessPoint.athleteId, athleteId), eq(fitnessPoint.origin, FitnessOrigin.Test)),
          )
          .orderBy(asc(fitnessPoint.date)),
        /** Une course annulée n'annonce rien et ne juge rien : elle sort du lot. */
        db
          .select()
          .from(race)
          .where(and(eq(race.athleteId, athleteId), ne(race.status, RaceStatus.Cancelled)))
          .orderBy(asc(race.date)),
        db
          .select()
          .from(forecast)
          .where(and(eq(forecast.athleteId, athleteId), isNull(forecast.actualVdot)))
          .orderBy(asc(forecast.issuedDate)),
      ])

      /** En mode record, la cible est le meilleur chrono représentatif (§ 5). */
      const records = personalRecords(races)
      const targetOf = (row: (typeof races)[number]) =>
        row.objectiveMode === ObjectiveMode.Record
          ? (recordFor(records, row.distanceM)?.timeS ?? null)
          : row.objectifS

      return {
        tests,
        races: races.map((row) => ({
          id: row.id,
          date: row.date,
          distanceM: row.distanceM,
          elevationGainM: row.elevationGainM,
          expectedTempC: row.expectedTempC,
          targetS: targetOf(row),
          /** Un chrono non représentatif ne dit pas la forme : il ne résout rien. */
          resultS: row.representative ? row.resultatS : null,
        })),
        open: open.map((row) => ({
          id: row.id,
          target: row.target as ForecastTarget,
          raceId: row.raceId,
          issuedDate: row.issuedDate,
          projectedVdot: row.projectedVdot,
        })),
      }
    },

    async saveForecasts(resolved: ForecastResolution[], issued: IssuedForecast[]): Promise<void> {
      for (const item of resolved) {
        await db
          .update(forecast)
          .set({
            actualVdot: item.actualVdot,
            gapVdot: item.gapVdot,
            resolvedDate: item.resolvedDate,
          })
          .where(and(eq(forecast.id, item.id), eq(forecast.athleteId, athleteId)))
      }

      if (issued.length > 0) {
        await db.insert(forecast).values(issued.map((item) => ({ ...item, athleteId })))
      }
    },
  }
}

/** Au-delà, le verrou d'un porteur mort avant de le rendre se reprend. */
const PLAN_LOCK_LEASE_S = 60
/**
 * Une régénération tient en deux à trois secondes — une quarantaine de
 * semaines écrites une par une sur un transport HTTP. Ce budget en laisse
 * donc passer trois à la queue leu leu ; au-delà, la dernière est refusée
 * plutôt que de faire expirer la requête côté plateforme.
 */
const PLAN_LOCK_WAIT_MS = 8_000
const PLAN_LOCK_POLL_MS = 150

/**
 * Le driver `neon-http` n'a pas de transactions et son transport n'a pas de
 * connexion persistante : ni `db.transaction()` ni verrou consultatif de
 * session. Le bail tient donc dans une colonne, pris par un `UPDATE`
 * conditionnel — atomique à lui seul, puisque chaque requête est sa propre
 * transaction implicite.
 *
 * Les deux bornes du bail se lisent sur l'horloge de la base et non sur celle
 * de l'app : `NUXT_COCKPIT_TODAY` déplace le temps du domaine, pas celui d'un
 * verrou.
 */
async function acquirePlanLock(db: Database, athleteId: number) {
  const deadline = Date.now() + PLAN_LOCK_WAIT_MS

  for (;;) {
    const taken = await db
      .update(athlete)
      .set({ planLockedUntil: sql`now() + make_interval(secs => ${PLAN_LOCK_LEASE_S})` })
      .where(
        and(
          eq(athlete.id, athleteId),
          or(isNull(athlete.planLockedUntil), lte(athlete.planLockedUntil, sql`now()`)),
        ),
      )
      .returning({ id: athlete.id })
    if (taken.length > 0) return

    /**
     * Une erreur simple et non un `createError` : cette passerelle sert aussi
     * le seed, qui tourne hors de Nitro et n'a pas ses auto-imports.
     */
    if (Date.now() >= deadline) {
      throw new Error('Une régénération du plan est déjà en cours.')
    }
    await new Promise((resolve) => setTimeout(resolve, PLAN_LOCK_POLL_MS))
  }
}

/**
 * Une régénération ne repose que ce qui n'est encore qu'une prévision (§ 5,
 * P8.5). Toute journée qui porte une séance réalisée, sautée, modifiée,
 * annulée ou posée à la main est reprise telle quelle de la version
 * remplacée, et ce que le générateur vient de produire ce jour-là cède la
 * place. La journée entière suit, pas seulement la séance décidée — sinon la
 * muscu du même jour serait perdue en chemin (§ 5, P6.43).
 */
async function carryDecidedDays(
  db: Database,
  planVersionId: number,
  previousVersionId: number | undefined,
) {
  if (previousVersionId === undefined) return

  /**
   * Seule la version qu'on remplace est reprise. Sans cette borne, une séance
   * orpheline d'une version bien plus ancienne serait ressuscitée sur la même
   * date, et les fantômes s'accumuleraient à chaque régénération.
   */
  const previousWeeks = db
    .select({ id: week.id })
    .from(week)
    .where(eq(week.planVersionId, previousVersionId))

  /**
   * Aucune borne de date : c'est la semaine d'accueil qui filtre plus bas. Une
   * borne à aujourd'hui laissait les jours déjà écoulés de la semaine en cours
   * derrière elle, donc hors du plan actif et invisibles au cockpit.
   */
  const decided = await db
    .select({ date: session.date })
    .from(session)
    .where(
      and(
        inArray(session.weekId, previousWeeks),
        or(ne(session.status, SessionStatus.Planned), eq(session.origin, SessionOrigin.Manual)),
      ),
    )
  if (decided.length === 0) return

  const weeks = await db.select().from(week).where(eq(week.planVersionId, planVersionId))

  for (const date of new Set(decided.map((row) => row.date))) {
    const target = weeks.find((item) => item.startDate <= date && date <= item.endDate)
    if (!target) continue

    // Ce que le générateur vient de poser ce jour-là cède la place.
    await db.delete(session).where(and(eq(session.date, date), eq(session.weekId, target.id)))

    /**
     * Les séances reprises gardent leur propre origine : marquer la journée
     * entière comme manuelle ferait passer pour « posée à la main » une séance
     * que le moteur avait produite, et `clearDay` la supprimerait en rendant la
     * journée au générateur.
     */
    await db
      .update(session)
      .set({ weekId: target.id })
      .where(and(eq(session.date, date), inArray(session.weekId, previousWeeks)))
  }
}

/** Semaines de l'athlète, quelle que soit la version : la borne de toute écriture. */
export function athleteWeekIds(db: Database, athleteId: number) {
  return db
    .select({ id: week.id })
    .from(week)
    .innerJoin(planVersion, eq(week.planVersionId, planVersion.id))
    .where(eq(planVersion.athleteId, athleteId))
}

/** Dernière version générée : c'est elle, le plan actif (§ 4). */
export async function loadActivePlanVersion(db: Database, athleteId: number) {
  const [version] = await db
    .select()
    .from(planVersion)
    .where(eq(planVersion.athleteId, athleteId))
    .orderBy(desc(planVersion.createdAt), desc(planVersion.id))
    .limit(1)
  if (!version) return undefined

  const [phases, weeks] = await Promise.all([
    db.select().from(phase).where(eq(phase.planVersionId, version.id)).orderBy(phase.startWeek),
    db.select().from(week).where(eq(week.planVersionId, version.id)).orderBy(week.index),
  ])

  const sessions =
    weeks.length === 0
      ? []
      : await db
          .select()
          .from(session)
          .innerJoin(week, eq(session.weekId, week.id))
          /** Le RPE réel sert au « prescrit contre réalisé » du dialog de séance (§ 8). */
          .leftJoin(feedback, eq(feedback.sessionId, session.id))
          .where(and(eq(week.planVersionId, version.id)))
          .orderBy(session.date)

  return {
    version,
    phases,
    weeks,
    sessions: sessions.map((row) => ({ ...row.session, feedbackRpe: row.feedback?.rpe ?? null })),
  }
}
