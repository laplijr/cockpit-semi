import { and, eq, inArray, ne, or } from 'drizzle-orm'
import { SessionOrigin, SessionStatus } from '../../domain/plan/session'
import type { Database } from './client'
import { session, week } from './schema'

/**
 * Une régénération ne repose que ce qui n'est encore qu'une prévision (§ 5,
 * P8.5). Toute journée qui porte une séance réalisée, sautée, modifiée,
 * annulée ou posée à la main est reprise telle quelle de la version
 * remplacée, et ce que le générateur vient de produire ce jour-là cède la
 * place. La journée entière suit, pas seulement la séance décidée — sinon la
 * muscu du même jour serait perdue en chemin (§ 5, P6.43).
 */
export async function carryDecidedDays(
  db: Database,
  planVersionId: number,
  previousVersionId: number | undefined,
) {
  if (previousVersionId === undefined) return

  /**
   * Seule la version qu'on remplace est reprise. Sans cette borne, une séance
   * orpheline d'une version bien plus ancienne serait ressuscitée sur la même
   * date, et les fantômes s'accumuleraient à chaque régénération.
   */
  const previousWeeks = db
    .select({ id: week.id })
    .from(week)
    .where(eq(week.planVersionId, previousVersionId))

  /**
   * Aucune borne de date : c'est la semaine d'accueil qui filtre plus bas. Une
   * borne à aujourd'hui laissait les jours déjà écoulés de la semaine en cours
   * derrière elle, donc hors du plan actif et invisibles au cockpit.
   */
  const decided = await db
    .select({ date: session.date })
    .from(session)
    .where(
      and(
        inArray(session.weekId, previousWeeks),
        or(ne(session.status, SessionStatus.Planned), eq(session.origin, SessionOrigin.Manual)),
      ),
    )
  if (decided.length === 0) return

  const weeks = await db.select().from(week).where(eq(week.planVersionId, planVersionId))

  for (const date of new Set(decided.map((row) => row.date))) {
    const target = weeks.find((item) => item.startDate <= date && date <= item.endDate)
    if (!target) continue

    // Ce que le générateur vient de poser ce jour-là cède la place.
    await db.delete(session).where(and(eq(session.date, date), eq(session.weekId, target.id)))

    /**
     * Les séances reprises gardent leur propre origine : marquer la journée
     * entière comme manuelle ferait passer pour « posée à la main » une séance
     * que le moteur avait produite, et `clearDay` la supprimerait en rendant la
     * journée au générateur.
     */
    await db
      .update(session)
      .set({ weekId: target.id })
      .where(and(eq(session.date, date), inArray(session.weekId, previousWeeks)))
  }
}
