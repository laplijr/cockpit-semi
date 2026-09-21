import { z } from 'zod'
import { shiftWeek, weekOf } from '../../domain/circle/post'
import { circleMembers, identitiesOf, postsOfWeek } from '../../infra/db/circle-gateway'
import { useDatabase } from '../../infra/db/client'
import { currentAthleteId, systemClock } from '../../utils/context'
import { circleMember } from '../../utils/scope'

const querySchema = z.object({
  semaine: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

/**
 * Une semaine du cercle, et rien de plus : l'axe borne la requête, il n'y a
 * pas de flux à faire défiler (§ 8, P9). La semaine à venir ne s'ouvre pas —
 * on ne publie que du passé, il n'y aurait rien à y lire.
 */
export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const athleteId = await currentAthleteId(event)
  await circleMember(db, athleteId)

  const { semaine } = await getValidatedQuery(event, querySchema.parse)
  const current = weekOf(systemClock.today())
  const week = semaine ? weekOf(semaine) : current

  const posts = await postsOfWeek(db, athleteId, week)

  return {
    week,
    today: systemClock.today(),
    isCurrent: week.from === current.from,
    previous: shiftWeek(week, -1).from,
    next: week.from < current.from ? shiftWeek(week, 1).from : null,
    me: athleteId,
    members: await circleMembers(db),
    /**
     * Les auteurs des publications de la semaine, membres ou non : quitter le
     * cercle ne retire pas son prénom de ce qu'on y a laissé (§ 9, P9.2).
     */
    authors: await identitiesOf(db, [...new Set(posts.map((one) => one.athleteId))]),
    posts,
  }
})
