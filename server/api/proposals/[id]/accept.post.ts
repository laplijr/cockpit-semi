import { z } from 'zod'
import { regeneratePlan } from '../../../application/regenerate-plan'
import { PlanTrigger } from '../../../domain/plan/session'
import { ProposalEffect } from '../../../domain/rules/rules'
import { useDatabase } from '../../../infra/db/client'
import { acceptProposal } from '../../../infra/db/proposal-repository'
import { currentAthleteId, planGateway, systemClock } from '../../../utils/context'

const paramsSchema = z.object({ id: z.coerce.number().int().positive() })

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const applied = await acceptProposal(useDatabase(), athleteId, id, systemClock.today())
  if (!applied) throw createError({ statusCode: 404, statusMessage: 'Proposition inconnue' })

  /** Redater une course change tout le rétro-planning : le plan se régénère. */
  if (applied.effect === ProposalEffect.MoveRace) {
    await regeneratePlan(planGateway(athleteId), systemClock, PlanTrigger.RaceAdded)
  }

  return { ok: true, ruleId: applied.ruleId, effect: applied.effect }
})
