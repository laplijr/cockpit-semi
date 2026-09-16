import type { IsoDate } from '../plan/calendar'

export interface Clock {
  today(): IsoDate
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Horloge du cockpit. Une date forcée permet de se placer à un jour simulé
 * pour voir l'application avec un historique ; elle reste réservée au local
 * et n'est jamais définie en production.
 */
export function createClock(forcedDate?: string | null): Clock {
  if (forcedDate && !ISO_DATE.test(forcedDate)) {
    throw new Error(`Date simulée invalide : « ${forcedDate} », attendu AAAA-MM-JJ`)
  }

  return {
    today: () => forcedDate || new Date().toISOString().slice(0, 10),
  }
}

/** Horloge figée, pour les tests et les rejeux de scénario. */
export function fixedClock(date: IsoDate): Clock {
  return createClock(date)
}
