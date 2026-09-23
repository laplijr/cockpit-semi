/**
 * Ce que le moteur écrit dans une proposition s'affiche tel quel : il écrit
 * donc en français, virgule décimale et date courte (P19). Écrit à la main
 * plutôt qu'avec `Intl` pour que le texte ne dépende pas des données de
 * locale de la machine qui évalue les règles.
 */

const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]

/** « 5,1 km », « 8 km ». */
export function frenchKm(meters: number): string {
  return `${String(Math.round(meters / 100) / 10).replace('.', ',')} km`
}

/** « 22 nov. » depuis « 2026-11-22 ». */
export function frenchShortDate(iso: string): string {
  const [, month, day] = iso.split('-').map(Number)
  return `${day} ${MONTHS[month! - 1]}`
}
