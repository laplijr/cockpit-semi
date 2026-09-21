import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '../infra/db/client'
import { athleteWeekIds } from '../infra/db/plan-gateway'
import { athlete, post, postComment, race, route, session } from '../infra/db/schema'

/**
 * Un identifiant qui vient de l'URL n'appartient à personne tant qu'on ne l'a
 * pas vérifié. Ces portes le font, et rendent 404 plutôt que 403 : dire
 * « cette séance existe mais pas pour toi » serait déjà en dire trop (P8.3).
 */
export async function ownedSession(db: Database, athleteId: number, sessionId: number) {
  const [row] = await db
    .select()
    .from(session)
    .where(and(eq(session.id, sessionId), inArray(session.weekId, athleteWeekIds(db, athleteId))))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Séance inconnue' })
  return row
}

export async function ownedRace(db: Database, athleteId: number, raceId: number) {
  const [row] = await db
    .select()
    .from(race)
    .where(and(eq(race.id, raceId), eq(race.athleteId, athleteId)))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Course inconnue' })
  return row
}

export async function ownedRoute(db: Database, athleteId: number, routeId: number) {
  const [row] = await db
    .select()
    .from(route)
    .innerJoin(session, eq(route.sessionId, session.id))
    .where(and(eq(route.id, routeId), inArray(session.weekId, athleteWeekIds(db, athleteId))))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Itinéraire inconnu' })
  return row.route
}

/**
 * Les portes du cercle (P9). Le mur de P8.3 laisse passer une seule table, et
 * il ne la laisse passer que par ici : toute requête sur `post`,
 * `post_reaction` ou `post_comment` vérifie d'abord qui lit, qui écrit, et à
 * quel post elle touche. L'exemption du test d'isolation n'est pas un trou :
 * c'est ce fichier.
 */
export async function circleMember(db: Database, athleteId: number) {
  const [row] = await db
    .select({ id: athlete.id })
    .from(athlete)
    .where(and(eq(athlete.id, athleteId), eq(athlete.inCircle, true)))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Cercle inconnu' })
  return row.id
}

/**
 * Un post qu'on a le droit de lire, donc de commenter : il suffit d'être du
 * cercle. Un post reste visible quand son auteur le quitte — quitter ferme
 * l'appartenance, ça ne détruit rien (§ 9, P9.2).
 */
export async function visiblePost(db: Database, athleteId: number, postId: number) {
  await circleMember(db, athleteId)

  const [row] = await db.select().from(post).where(eq(post.id, postId)).limit(1)
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Publication inconnue' })
  return row
}

/** Un post qu'on a le droit de retirer : le sien. */
export async function ownedPost(db: Database, athleteId: number, postId: number) {
  const [row] = await db
    .select()
    .from(post)
    .where(and(eq(post.id, postId), eq(post.athleteId, athleteId)))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Publication inconnue' })
  return row
}

/**
 * Un commentaire qu'on a le droit de retirer : le sien, ou celui qu'on a reçu
 * chez soi. Deux raisons pour une même porte — chacun retire ses mots, et
 * l'auteur d'un post reste maître de ce qui s'écrit dessous.
 */
export async function removableComment(db: Database, athleteId: number, commentId: number) {
  const [row] = await db
    .select({ comment: postComment, postAuthorId: post.athleteId })
    .from(postComment)
    .innerJoin(post, eq(postComment.postId, post.id))
    .where(eq(postComment.id, commentId))
    .limit(1)

  const allowed = row && (row.comment.athleteId === athleteId || row.postAuthorId === athleteId)
  if (!allowed) throw createError({ statusCode: 404, statusMessage: 'Commentaire inconnu' })
  return row.comment
}
