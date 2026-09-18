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

const DATE_WITH_YEAR_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
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

export function formatDateWithYear(iso: string): string {
  return DATE_WITH_YEAR_FORMAT.format(new Date(`${iso}T12:00:00Z`))
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
  Z2: 'Endurance Z2',
  SL_velo: 'Sortie longue vélo',
  force_cadence: 'Force basse cadence',
  sweet_spot: 'Sweet spot',
  legs: 'Legs',
  push: 'Push',
  pull: 'Pull',
  mobilite: 'Mobilité',
}

export const STRENGTH_PHASE_LABELS: Record<string, string> = {
  adaptation: 'Adaptation',
  force: 'Force',
  force_puissance: 'Force-puissance',
  entretien: 'Entretien',
  legere: 'Légère',
  mobilite: 'Mobilité',
  arret: 'Arrêt',
}

/** Nombre décimal en français : virgule, et pas de zéro qui traîne. */
export function formatDecimal(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '—'
  const text = value.toFixed(decimals).replace('.', ',')
  return text.includes(',') ? text.replace(/0+$/, '').replace(/,$/, '') : text
}

/** Habitudes détectées (§ 5, P6). */
export const HABIT_LABELS: Record<string, string> = {
  glissement_de_jour: 'Glissement de jour',
  creneau_jamais_honore: 'Créneau jamais honoré',
  biais_rpe: 'Biais de ressenti',
  sensibilite_sommeil: 'Sensibilité au sommeil',
  refus_systematique: 'Refus systématique',
}

/** Types de journée au sens nutritionnel (§ 5, P6). */
export const DAY_KIND_LABELS: Record<string, string> = {
  repos: 'Repos',
  facile: 'Journée facile',
  qualite: 'Journée de qualité',
  sortie_longue: 'Sortie longue',
  course: 'Jour de course',
}

export const FUEL_PRODUCT_LABELS: Record<string, string> = {
  eau: 'Eau',
  gel: 'Gel',
  boisson: 'Boisson',
}

/**
 * Fourchette en grammes ou en millilitres : « 45 à 60 g ». La liste arrive de
 * l'API, où la sérialisation JSON a effacé le tuple : on lit ses deux bornes.
 */
export function formatRange(range: readonly number[] | null | undefined, unit: string): string {
  const [low, high] = range ?? []
  if (low === undefined || high === undefined) return '—'
  const format = (value: number) => String(Math.round(value * 10) / 10).replace('.', ',')
  return low === high ? `${format(low)} ${unit}` : `${format(low)} à ${format(high)} ${unit}`
}

export const BENEFIT_LABELS: Record<string, string> = {
  course: 'Course',
  velo: 'Vélo',
  prevention: 'Prévention',
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—'
  const total = Math.round(minutes)
  if (total < 60) return `${total}′`
  const rest = total % 60
  return rest === 0
    ? `${total / 60} h`
    : `${Math.floor(total / 60)} h ${String(rest).padStart(2, '0')}`
}

export function formatLoad(kilograms: number | null | undefined): string {
  if (kilograms === null || kilograms === undefined) return '—'
  return `${kilograms.toFixed(1).replace('.0', '').replace('.', ',')} kg`
}

export const PRIORITY_LABELS: Record<string, string> = { A: 'A', B: 'B', C: 'C' }

export const SPORT_LABELS: Record<string, string> = {
  course: 'Course à pied',
  velo: 'Vélo',
  muscu: 'Renforcement',
  autre: 'Autre',
}

/** Icône et couleur par sport, pour distinguer les séances d'un même jour. */
export const SPORT_STYLES: Record<
  string,
  { icon: 'run' | 'velo' | 'muscu' | 'gauge'; tone: string }
> = {
  course: { icon: 'run', tone: 'text-accent' },
  velo: { icon: 'velo', tone: 'text-cycling' },
  muscu: { icon: 'muscu', tone: 'text-ok' },
  autre: { icon: 'gauge', tone: 'text-text-dim' },
}

export function sportStyle(sport: string) {
  return SPORT_STYLES[sport] ?? SPORT_STYLES.autre!
}

/**
 * Ce qu'une proposition fait à sa cible, au participe féminin : la ligne
 * nomme son sujet, l'effet le qualifie (§ 9, P5.19).
 */
export const EFFECT_ACTIONS: Record<string, string> = {
  muscu_serie_en_moins: 'allégée',
  faciles_reduites: 'raccourcie',
  sortie_longue_reduite: 'raccourcie',
  repetitions_en_moins: 'allégée',
  seance_replacee: 'replacée',
  conversion_velo: 'convertie en vélo',
  seance_deplacee: 'déplacée',
  seance_retiree: 'retirée',
}

/** Effets qui ne visent pas une séance : ils se nomment tout seuls. */
export const EFFECT_TITLES: Record<string, string> = {
  progression_gelee: 'Progression de bloc gelée',
  progression_retablie: 'Progression de bloc relancée',
  pause_proposee: 'Pause proposée',
  pause_imposee: 'Pause imposée',
  course_redatee: 'Course redatée',
}

/** Noms de sport au singulier court, pour « 4 séances de renfo allégées ». */
export const SHORT_SPORT_LABELS: Record<string, string> = {
  course: 'course',
  velo: 'vélo',
  muscu: 'renfo',
  autre: 'sport',
}

interface PrescriptionLike {
  durationMin?: number
  steps: {
    repeats?: number
    durationS?: number
    distanceM?: number
    paceSecPerKm?: number
    recoveryS?: number
  }[]
}

/** Durée prévue d'une séance : celle de la prescription, ou celle de ses étapes. */
export function prescribedMinutes(prescription: PrescriptionLike): number {
  if (prescription.durationMin) return prescription.durationMin

  const seconds = prescription.steps.reduce((total, step) => {
    const repeats = step.repeats ?? 1
    if (step.durationS) return total + step.durationS * repeats + (step.recoveryS ?? 0) * repeats
    if (step.distanceM && step.paceSecPerKm) {
      return total + (step.distanceM / 1000) * step.paceSecPerKm * repeats
    }
    return total
  }, 0)

  return Math.round(seconds / 60)
}
