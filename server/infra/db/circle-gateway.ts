import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import type { CircleWeek, PublishedPost } from '../../domain/circle/post'
import type { Database } from './client'
import { athlete, post, postComment, postReaction } from './schema'

export interface CircleIdentity {
  id: number
  firstName: string | null
  avatar: string | null
}

export interface CirclePost {
  id: number
  athleteId: number
  source: string
  sport: string
  code: string | null
  date: string
  label: string | null
  distanceM: number | null
  durationMin: number | null
  note: string | null
  publishedAt: Date
  bravos: CircleIdentity[]
  /** Vrai quand le lecteur a déjà dit bravo : le bouton se lit avant de cliquer. */
  mine: boolean
  comments: number
}

/**
 * Les membres du cercle : ceux dont l'appartenance est ouverte. C'est la
 * seule lecture du dépôt qui traverse les athlètes sans en nommer un, et elle
 * est bornée par `inCircle` — une portée, pas une absence de portée (P9).
 */
export async function circleMembers(db: Database): Promise<CircleIdentity[]> {
  return db
    .select({ id: athlete.id, firstName: athlete.firstName, avatar: athlete.avatar })
    .from(athlete)
    .where(eq(athlete.inCircle, true))
    .orderBy(asc(athlete.id))
}

/**
 * Prénom et avatar des auteurs d'un lot de publications. Les identifiants
 * viennent de posts déjà bornés par le cercle, d'où le nom du paramètre : il
 * est le marqueur que le test d'isolation cherche. Un ancien membre garde son
 * prénom sur ses publications — quitter ne détruit rien.
 */
export async function identitiesOf(db: Database, circleIds: number[]): Promise<CircleIdentity[]> {
  if (circleIds.length === 0) return []
  return db
    .select({ id: athlete.id, firstName: athlete.firstName, avatar: athlete.avatar })
    .from(athlete)
    .where(inArray(athlete.id, circleIds))
}

/** Une semaine de publications, du plus récent au plus ancien. */
export async function postsOfWeek(
  db: Database,
  athleteId: number,
  week: CircleWeek,
): Promise<CirclePost[]> {
  const rows = await db
    .select()
    .from(post)
    .where(and(gte(post.date, week.from), lte(post.date, week.to)))
    .orderBy(desc(post.date), desc(post.publishedAt))

  return decorate(db, athleteId, rows)
}

export async function postById(
  db: Database,
  athleteId: number,
  postId: number,
): Promise<CirclePost | undefined> {
  const rows = await db.select().from(post).where(eq(post.id, postId))
  const [decorated] = await decorate(db, athleteId, rows)
  return decorated
}

export interface CircleComment {
  id: number
  athleteId: number
  text: string
  createdAt: Date
  /** Vrai pour ses propres mots et pour ceux reçus sous sa publication. */
  removable: boolean
}

export async function commentsOf(
  db: Database,
  athleteId: number,
  postId: number,
  postAuthorId: number,
): Promise<CircleComment[]> {
  const rows = await db
    .select()
    .from(postComment)
    .where(eq(postComment.postId, postId))
    .orderBy(asc(postComment.createdAt))

  return rows.map((row) => ({
    id: row.id,
    athleteId: row.athleteId,
    text: row.text,
    createdAt: row.createdAt,
    removable: row.athleteId === athleteId || postAuthorId === athleteId,
  }))
}

export async function insertPost(
  db: Database,
  athleteId: number,
  published: PublishedPost,
): Promise<number> {
  const [row] = await db
    .insert(post)
    .values({ athleteId, ...published })
    .returning({ id: post.id })
  return row!.id
}

export async function deletePost(db: Database, postId: number): Promise<void> {
  await db.delete(post).where(eq(post.id, postId))
}

/** Bravo est une bascule : le redire, c'est le retirer. */
export async function toggleBravo(
  db: Database,
  athleteId: number,
  postId: number,
): Promise<boolean> {
  const where = and(eq(postReaction.postId, postId), eq(postReaction.athleteId, athleteId))
  const [existing] = await db.select().from(postReaction).where(where).limit(1)

  if (existing) {
    await db.delete(postReaction).where(where)
    return false
  }

  await db.insert(postReaction).values({ postId, athleteId })
  return true
}

export async function insertComment(
  db: Database,
  athleteId: number,
  postId: number,
  text: string,
): Promise<number> {
  const [row] = await db
    .insert(postComment)
    .values({ postId, athleteId, text })
    .returning({ id: postComment.id })
  return row!.id
}

export async function deleteComment(db: Database, commentId: number): Promise<void> {
  await db.delete(postComment).where(eq(postComment.id, commentId))
}

/** Rejoindre ou quitter : une colonne, et rien d'autre ne bouge. */
export async function setMembership(
  db: Database,
  athleteId: number,
  member: boolean,
): Promise<void> {
  await db.update(athlete).set({ inCircle: member }).where(eq(athlete.id, athleteId))
}

export async function isMember(db: Database, athleteId: number): Promise<boolean> {
  const [row] = await db
    .select({ inCircle: athlete.inCircle })
    .from(athlete)
    .where(eq(athlete.id, athleteId))
    .limit(1)
  return row?.inCircle ?? false
}

/** Publication déjà faite pour une séance ou une course : le geste ne se répète pas. */
export async function postFor(
  db: Database,
  athleteId: number,
  source: PublishedPost['source'],
  sourceId: number,
): Promise<{ id: number } | undefined> {
  const [row] = await db
    .select({ id: post.id })
    .from(post)
    .where(and(eq(post.athleteId, athleteId), eq(post.source, source), eq(post.sourceId, sourceId)))
    .limit(1)
  return row
}

async function decorate(
  db: Database,
  athleteId: number,
  rows: (typeof post.$inferSelect)[],
): Promise<CirclePost[]> {
  if (rows.length === 0) return []
  const postIds = rows.map((row) => row.id)

  const reactions = await db
    .select()
    .from(postReaction)
    .where(inArray(postReaction.postId, postIds))
    .orderBy(asc(postReaction.createdAt))

  const comments = await db
    .select({ postId: postComment.postId })
    .from(postComment)
    .where(inArray(postComment.postId, postIds))

  const circleIds = [
    ...new Set([...rows.map((r) => r.athleteId), ...reactions.map((r) => r.athleteId)]),
  ]
  const byId = new Map((await identitiesOf(db, circleIds)).map((one) => [one.id, one]))

  return rows.map((row) => {
    const bravos = reactions.filter((reaction) => reaction.postId === row.id)
    return {
      id: row.id,
      athleteId: row.athleteId,
      source: row.source,
      sport: row.sport,
      code: row.code,
      date: row.date,
      label: row.label,
      distanceM: row.distanceM,
      durationMin: row.durationMin,
      note: row.note,
      publishedAt: row.publishedAt,
      bravos: bravos.map((reaction) => byId.get(reaction.athleteId)).filter(isIdentity),
      mine: bravos.some((reaction) => reaction.athleteId === athleteId),
      comments: comments.filter((comment) => comment.postId === row.id).length,
    }
  })
}

function isIdentity(value: CircleIdentity | undefined): value is CircleIdentity {
  return value !== undefined
}
