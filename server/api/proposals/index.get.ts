import { inArray } from 'drizzle-orm'
import { groupProposals } from '../../application/group-proposals'
import { ProposalStatus } from '../../domain/rules/proposal-status'
import { useDatabase } from '../../infra/db/client'
import { listProposals } from '../../infra/db/proposal-repository'
import { session } from '../../infra/db/schema'

export default defineEventHandler(async () => {
  const db = useDatabase()
  const rows = await listProposals(db)

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
          .where(inArray(session.id, sessionIds))

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
    decided: rows.filter((row) => row.status !== ProposalStatus.Proposed),
  }
})
