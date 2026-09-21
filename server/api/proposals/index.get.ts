import { and, inArray } from 'drizzle-orm'
import { groupDecisions, groupProposals } from '../../application/group-proposals'
import { ProposalStatus } from '../../domain/rules/proposal-status'
import { useDatabase } from '../../infra/db/client'
import { athleteWeekIds } from '../../infra/db/plan-gateway'
import { listProposals } from '../../infra/db/proposal-repository'
import { session } from '../../infra/db/schema'
import { currentAthleteId } from '../../utils/context'

export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const db = useDatabase()
  const rows = await listProposals(db, athleteId)

  const proposed = rows.filter((row) => row.status === ProposalStatus.Proposed)
  const sessionIds = proposed
    .filter((row) => row.targetKind === 'session' && row.targetId !== null)
    .map((row) => row.targetId!)

  const targets =
    sessionIds.length === 0
      ? []
      : await db
          .select({
            id: session.id,
            code: session.code,
            date: session.date,
            sport: session.sport,
          })
          .from(session)
          .where(
            and(
              inArray(session.id, sessionIds),
              inArray(session.weekId, athleteWeekIds(db, athleteId)),
            ),
          )

  const byId = new Map(targets.map((row) => [row.id, row]))

  // La ligne garde tout ce qu'elle portait — le dialog de détail en a besoin —
  // et gagne sa cible nommée : quelle séance, quel jour, quel sport.
  const pending = proposed.map((row) => ({
    ...row,
    target: row.targetId === null ? null : (byId.get(row.targetId) ?? null),
  }))

  return {
    pending,
    /** Une décision par règle et par effet : c'est ce que la cloche compte. */
    groups: groupProposals(pending),
    /** L'historique compte les décisions de Ronan, pas les lignes du moteur. */
    decided: groupDecisions(rows.filter((row) => row.status !== ProposalStatus.Proposed)),
  }
})
