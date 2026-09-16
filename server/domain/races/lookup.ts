/** Fiabilité d'un champ trouvé par la recherche automatique (§ 6). */
export enum LookupStatus {
  Sure = 'sur',
  ToConfirm = 'a_confirmer',
  Estimated = 'estime',
}

export interface LookupField {
  /** Valeur trouvée, ou nulle quand la recherche n'a rien donné. */
  value: string | null
  status: LookupStatus
  sources: string[]
}

/** Champs que la recherche renseigne, dans l'ordre d'affichage de la fenêtre. */
export enum LookupKey {
  Name = 'name',
  Date = 'date',
  DistanceM = 'distanceM',
  Location = 'location',
  ElevationGainM = 'elevationGainM',
  Registration = 'registration',
}

export const LOOKUP_LABELS: Record<LookupKey, string> = {
  [LookupKey.Name]: 'Nom officiel',
  [LookupKey.Date]: 'Date',
  [LookupKey.DistanceM]: 'Distance',
  [LookupKey.Location]: 'Lieu',
  [LookupKey.ElevationGainM]: 'Dénivelé positif',
  [LookupKey.Registration]: 'Inscriptions',
}

export type RaceLookupFields = Partial<Record<LookupKey, LookupField>>

/** Une recherche n'est exploitable que si elle a trouvé une date crédible. */
export function hasUsableDate(fields: RaceLookupFields): boolean {
  const date = fields[LookupKey.Date]
  return Boolean(date?.value && /^\d{4}-\d{2}-\d{2}$/.test(date.value))
}

/** Les inscriptions sont ouvertes : la date ne bougera plus, on arrête de vérifier. */
export function registrationOpen(fields: RaceLookupFields): boolean {
  return fields[LookupKey.Registration]?.value === 'ouvertes'
}
