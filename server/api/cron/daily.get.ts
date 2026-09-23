import { asc } from 'drizzle-orm'
import { calibrateWeek, detectAndStoreHabits } from '../../application/detect-habits'
import { generateDueFuelPlans } from '../../application/generate-fuel-plan'
import { recheckRaces } from '../../application/recheck-races'
import { ProposalTrigger } from '../../domain/rules/proposal-status'
import { useDatabase, type Database } from '../../infra/db/client'
import { hasLlmKey } from '../../infra/llm/client'
import {
  evaluateAndStore,
  expireOutdatedProposals,
  expireStaleProposals,
} from '../../infra/db/proposal-repository'
import { createRecheckGateway } from '../../infra/db/recheck-gateway'
import { athlete } from '../../infra/db/schema'
import { createRaceSearcher } from '../../infra/search/race-lookup'
import { systemClock } from '../../utils/context'

interface AthleteReport {
  athleteId: number
  newProposals: number
  recheckedRaces: number
  fuelPlans: number
  habits: number
}

/**
 * Cron quotidien Vercel. La précision est de ± 59 min sur l'offre Hobby : rien
 * d'affiché ne doit en dépendre, la forme du jour se recalcule à l'ouverture.
 *
 * Il n'a pas de session : il boucle sur les athlètes. Un échec sur l'un
 * n'interrompt pas les autres, et le compte rendu dit lesquels (§ 9, P8.3).
 */
export default defineEventHandler(async (event) => {
  const { cronSecret } = useRuntimeConfig(event)
  const authorization = getRequestHeader(event, 'authorization')

  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Cron non autorisé' })
  }

  const db = useDatabase()
  const today = systemClock.today()
  const athletes = await db.select({ id: athlete.id }).from(athlete).orderBy(asc(athlete.id))

  const done: AthleteReport[] = []
  const failed: { athleteId: number; reason: string }[] = []

  for (const { id } of athletes) {
    try {
      done.push(await runFor(db, id, today))
    } catch (error) {
      failed.push({ athleteId: id, reason: error instanceof Error ? error.message : 'inconnue' })
      console.error(`Cron en échec pour l'athlète ${id}`, error)
    }
  }

  return { today, athletes: athletes.length, done, failed }
})

async function runFor(db: Database, athleteId: number, today: string): Promise<AthleteReport> {
  await expireStaleProposals(db, athleteId, today)
  await expireOutdatedProposals(db, athleteId, today)
  const proposals = await evaluateAndStore(db, athleteId, today, ProposalTrigger.DailyCron)

  /** À J−7, chaque course encore planifiée reçoit son plan ravito (§ 5). */
  const fuelPlans = await generateDueFuelPlans(db, athleteId, today)

  /** Les habitudes se relisent et la semaine se calibre tous les jours (§ 5). */
  const habits = await detectAndStoreHabits(db, athleteId, today)
  await calibrateWeek(db, athleteId, today)

  /**
   * La revérification des dates de course ne doit pas faire tomber le cron, et
   * sans clé elle ne se tente pas : une erreur par athlète et par jour n'est
   * pas un compte rendu (§ 6).
   */
  let recheckedRaces = 0
  if (hasLlmKey()) {
    try {
      const gateway = createRecheckGateway(db, athleteId)
      recheckedRaces = (await recheckRaces(gateway, createRaceSearcher(), today)).length
    } catch (error) {
      console.error('Revérification des courses impossible', error)
    }
  }

  return { athleteId, newProposals: proposals.length, recheckedRaces, fuelPlans, habits }
}
