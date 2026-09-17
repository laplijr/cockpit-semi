import { calibrateWeek, detectAndStoreHabits } from '../../application/detect-habits'
import { generateDueFuelPlans } from '../../application/generate-fuel-plan'
import { recheckRaces } from '../../application/recheck-races'
import { ProposalTrigger } from '../../domain/rules/proposal-status'
import { useDatabase } from '../../infra/db/client'
import { evaluateAndStore, expireStaleProposals } from '../../infra/db/proposal-repository'
import { createRecheckGateway } from '../../infra/db/recheck-gateway'
import { createRaceSearcher } from '../../infra/search/race-lookup'
import { systemClock } from '../../utils/context'

/**
 * Cron quotidien Vercel. La précision est de ± 59 min sur l'offre Hobby : rien
 * d'affiché ne doit en dépendre, la forme du jour se recalcule à l'ouverture.
 */
export default defineEventHandler(async (event) => {
  const { cronSecret } = useRuntimeConfig(event)
  const authorization = getRequestHeader(event, 'authorization')

  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Cron non autorisé' })
  }

  const db = useDatabase()
  const today = systemClock.today()

  await expireStaleProposals(db, today)
  const proposals = await evaluateAndStore(db, today, ProposalTrigger.DailyCron)

  /** À J−7, chaque course encore planifiée reçoit son plan ravito (§ 5). */
  const fuelPlans = await generateDueFuelPlans(db, today)

  /** Les habitudes se relisent et la semaine se calibre tous les jours (§ 5). */
  const habits = await detectAndStoreHabits(db, today)
  await calibrateWeek(db, today)

  /** La revérification des dates de course ne doit pas faire tomber le cron. */
  let recheckedRaces = 0
  try {
    const found = await recheckRaces(createRecheckGateway(db), createRaceSearcher(), today)
    recheckedRaces = found.length
  } catch (error) {
    console.error('Revérification des courses impossible', error)
  }

  return { today, newProposals: proposals.length, recheckedRaces, fuelPlans, habits }
})
