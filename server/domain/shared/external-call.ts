/** Les trois appels que les clés de Ronan paient pour tout le monde (§ 11, P8.4). */
export enum ExternalCall {
  Unplanned = 'imprevu',
  RaceLookup = 'recherche_course',
  Route = 'itineraire',
}

/**
 * Quota quotidien par athlète. Il n'est pas là pour rationner un usage normal
 * — une poignée d'imprévus et deux recherches par jour passent large — mais
 * pour qu'un compte ne puisse pas vider la facture de Ronan à lui seul.
 */
export const DAILY_QUOTA: Record<ExternalCall, number> = {
  [ExternalCall.Unplanned]: 30,
  [ExternalCall.RaceLookup]: 15,
  [ExternalCall.Route]: 20,
}

export const CALL_LABELS: Record<ExternalCall, string> = {
  [ExternalCall.Unplanned]: 'Imprévu',
  [ExternalCall.RaceLookup]: 'Recherche de course',
  [ExternalCall.Route]: 'Itinéraires',
}
