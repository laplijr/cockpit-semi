import { ProposalTrigger } from '../../domain/rules/proposal-status'
import { useDatabase } from '../../infra/db/client'
import { evaluateAndStore, expireStaleProposals } from '../../infra/db/proposal-repository'
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

  return { today, newProposals: proposals.length }
})
