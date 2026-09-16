/** Mise en forme des valeurs du cockpit. Nombres toujours en police `mono`. */

export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm === null || secPerKm === undefined) return '—'
  const total = Math.round(secPerKm)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—'
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60

  if (hours === 0) return `${minutes}:${String(rest).padStart(2, '0')}`
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined) return '—'
  if (meters < 1000) return `${Math.round(meters)} m`
  const km = meters / 1000
  return `${km >= 10 ? Math.round(km) : km.toFixed(1).replace('.', ',')} km`
}

export function formatSignedDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—'
  const sign = seconds > 0 ? '+' : seconds < 0 ? '−' : ''
  return `${sign}${formatDuration(Math.abs(seconds))}`
}

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

const LONG_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(`${iso}T12:00:00Z`))
}

export function formatLongDate(iso: string): string {
  return LONG_DATE_FORMAT.format(new Date(`${iso}T12:00:00Z`))
}

export const WEEKDAY_LABELS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] as const

/** Jours restants avant une date, négatif une fois la date passée. */
export function daysUntil(iso: string, from: string): number {
  return Math.round((Date.parse(iso) - Date.parse(from)) / 86_400_000)
}

export const PHASE_LABELS: Record<string, string> = {
  base: 'Base',
  base_courte: 'Base courte',
  developpement: 'Développement',
  specifique: 'Spécifique',
  vitesse: 'Vitesse',
  affutage: 'Affûtage',
  recup: 'Récupération',
  relance: 'Relance',
  transition: 'Transition',
}

export const SESSION_LABELS: Record<string, string> = {
  EF: 'Endurance',
  droites: 'Lignes droites',
  SL: 'Sortie longue',
  seuil: 'Seuil',
  VMA: 'VMA',
  allure_semi: 'Allure semi',
  cotes: 'Côtes',
  progressif: 'Progressif',
  test: 'Test 20′',
}

export const PRIORITY_LABELS: Record<string, string> = { A: 'A', B: 'B', C: 'C' }
