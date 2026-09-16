export enum PauseType {
  Injury = 'blessure',
  Illness = 'maladie',
  Travel = 'voyage',
  Other = 'autre',
}

/** Ce qui reste autorisé pendant la pause (§ 4). */
export interface PauseAllowances {
  running: boolean
  cycling: boolean
  upperBodyStrength: boolean
  legStrength: boolean
  /** Conditions posées par l'athlète (« seulement si la chaussure ne fait pas mal »). */
  conditions?: string[]
}

export interface ActivePause {
  type: PauseType
  zone: string | null
  startDate: string
  endDate: string | null
  allowances: PauseAllowances
}

export function isPauseOpen(pause: { endDate: string | null }): boolean {
  return pause.endDate === null
}

/** Nombre de jours écoulés depuis le début de la pause, aujourd'hui inclus. */
export function pauseDay(startDate: string, today: string): number {
  const day = 86_400_000
  return Math.floor((Date.parse(today) - Date.parse(startDate)) / day) + 1
}
