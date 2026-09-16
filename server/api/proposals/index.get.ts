import { useDatabase } from '../../infra/db/client'
import { listProposals } from '../../infra/db/proposal-repository'

export default defineEventHandler(async () => {
  const rows = await listProposals(useDatabase())
  return {
    pending: rows.filter((row) => row.status === 'proposee'),
    decided: rows.filter((row) => row.status !== 'proposee'),
  }
})
