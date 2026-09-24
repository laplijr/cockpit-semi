/**
 * Les répétitions à garder sous le pied à la dernière série (P25). Le
 * pourcentage d'une répétition maximale que le cockpit ne demande pas et ne
 * stocke pas ne dit à personne quel poids prendre ; la réserve, si.
 *
 * Les tables publiées divergent — 3 × 9 à 70 % laisse de une à quatre
 * répétitions en réserve selon la formule —, ces valeurs sont donc un choix,
 * écrit une fois et testé. En force-puissance, l'intention de vitesse s'arrête
 * loin de l'échec : ≥ 85 % garde deux répétitions, pas une.
 */
const RESERVE_BY_INTENSITY: Record<string, number> = {
  '70 %': 2,
  '75 %': 2,
  '85 %': 1,
  '≥ 85 %': 2,
  modérée: 3,
}

/** Nulle quand l'intensité ne se dose pas en réserve : « à vide », « — », le poids de corps. */
export function targetReserve(intensity: string | undefined): number | null {
  if (intensity === undefined) return null
  return RESERVE_BY_INTENSITY[intensity] ?? null
}

/** « 2 en réserve », comme la structure d'une séance l'affiche. */
export function reserveLabel(reserve: number): string {
  return `${reserve} en réserve`
}

/**
 * La charge dite par le format, quand aucun kilo n'est connu : on vise un
 * poids qu'on pourrait soulever `reps + réserve` fois, et on en fait `reps`.
 */
export function loadHint(reps: number, reserve: number): string {
  return `Choisis un poids que tu pourrais soulever ${reps + reserve} fois, fais-en ${reps}.`
}
