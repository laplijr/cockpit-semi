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

/** « +0,6 », « −0,3 », « 0,0 » : le signe moins typographique, comme à l'écran. */
export function frenchSignedDecimal(value: number, digits: number): string {
  const rounded = Number(value.toFixed(digits))
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  return `${sign}${Math.abs(rounded).toFixed(digits).replace('.', ',')}`
}

/** « 56:40 », « 2:26:00 » : un chrono, au format de la montre. */
export function frenchDuration(seconds: number): string {
  const total = Math.round(Math.abs(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = String(total % 60).padStart(2, '0')
  return hours === 0 ? `${minutes}:${rest}` : `${hours}:${String(minutes).padStart(2, '0')}:${rest}`
}

/** « +0:45 », « −1:02:03 » : un écart de chrono, au format de la montre. */
export function frenchSignedDuration(seconds: number): string {
  const sign = Math.round(seconds) > 0 ? '+' : Math.round(seconds) < 0 ? '−' : ''
  return `${sign}${frenchDuration(seconds)}`
}
