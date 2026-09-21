import { z } from 'zod'
import { startRun } from '../../application/record-run'
import { currentAthleteId, runGateway } from '../../utils/context'
import { ISO_DATE } from '../../utils/run-fixes'

const bodySchema = z.object({
  sessionId: z.number().int().positive().nullable().default(null),
  /** Date locale de l'appareil : le serveur tourne en UTC, pas le coureur. */
  date: z.string().regex(ISO_DATE),
})

/**
 * Ouvre la sortie. Une sortie déjà en cours est rendue telle quelle : deux
 * captures en parallèle n'ont aucun sens, et c'est ce qui permet de reprendre
 * là où on en était après un onglet rechargé (§ 9, P10).
 */
export default defineEventHandler(async (event) => {
  const athleteId = await currentAthleteId(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  const run = await startRun(runGateway(athleteId), {
    sessionId: body.sessionId,
    date: body.date,
    startedAt: new Date(),
  })

  return {
    id: run.id,
    sessionId: run.sessionId,
    date: run.date,
    startedAt: run.startedAt,
    fixes: run.fixes.length,
  }
})
