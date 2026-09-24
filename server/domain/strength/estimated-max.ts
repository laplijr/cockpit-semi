/**
 * Des kilos dès la première séance (P26), sans test de maximum : le maximum
 * s'estime depuis une série tenue, réserve comprise, et la charge du jour en
 * découle par le pourcentage de la phase.
 */

/** Ce qu'on charge : une barre de 20 kg, ou un haltère dans chaque main. */
export enum LoadImplement {
  Barbell = 'barre',
  Dumbbell = 'halteres',
}

/** D'où vient une estimation : d'un calage par paliers, ou d'une séance saisie. */
export enum EstimateSource {
  Calibration = 'calage',
  Session = 'seance',
}

export const EMPTY_BAR_KG = 20
const BARBELL_STEP_KG = 2.5
/** Le pas d'une paire d'haltères, par haltère. */
const DUMBBELL_STEP_KG = 2
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]

/** Les exercices qui se chargent, et avec quoi. Les autres se font au poids de corps ou à l'élastique. */
export const LOAD_IMPLEMENTS: Record<string, LoadImplement> = {
  squat: LoadImplement.Barbell,
  'sdt-roumain': LoadImplement.Barbell,
  'hip-thrust': LoadImplement.Barbell,
  'developpe-couche': LoadImplement.Barbell,
  'goblet-squat': LoadImplement.Dumbbell,
  'sdt-halteres': LoadImplement.Dumbbell,
  'developpe-militaire': LoadImplement.Dumbbell,
  'developpe-halteres': LoadImplement.Dumbbell,
  rowing: LoadImplement.Dumbbell,
  'pont-fessier-leste': LoadImplement.Dumbbell,
  'farmer-walk': LoadImplement.Dumbbell,
}

/**
 * Epley, la réserve ajoutée aux répétitions faites : 60 kg × 5 avec trois en
 * réserve valent une série de 8 à l'échec, soit 76 kg.
 */
export function estimatedMaxKg(loadKg: number, reps: number, reserve: number): number {
  return Math.round(loadKg * (1 + (reps + reserve) / 30) * 10) / 10
}

/** « 70 % » → 0,7 ; « ≥ 85 % » → 0,85 ; nul quand le repère n'est pas un pourcentage. */
export function intensityShare(intensity: string | undefined): number | null {
  const match = intensity?.match(/(\d+(?:[.,]\d+)?)\s*%/)
  return match ? Number(match[1]!.replace(',', '.')) / 100 : null
}

/**
 * La charge de travail : le maximum au pourcentage de la phase, arrondie au
 * pas **inférieur** du matériel — le plan fait foi, on ne force pas au-dessus
 * —, jamais sous la barre à vide.
 */
export function workingLoadKg(
  maxKg: number,
  intensity: string,
  implement: LoadImplement,
): number | null {
  const share = intensityShare(intensity)
  if (share === null) return null
  const step = implement === LoadImplement.Barbell ? BARBELL_STEP_KG : DUMBBELL_STEP_KG
  const floor = implement === LoadImplement.Barbell ? EMPTY_BAR_KG : DUMBBELL_STEP_KG
  return Math.max(floor, Math.floor((maxKg * share + 1e-9) / step) * step)
}

/** Les disques d'un côté de la barre de 20 kg, du plus lourd au plus léger. */
export function plateBreakdown(loadKg: number): number[] {
  let side = Math.max(0, (loadKg - EMPTY_BAR_KG) / 2)
  const plates: number[] = []
  for (const plate of PLATES_KG) {
    while (side >= plate - 1e-9) {
      plates.push(plate)
      side -= plate
    }
  }
  return plates
}

/**
 * Un exercice chargé et dosé en pourcentage : c'est lui qui se cale quand
 * aucune estimation n'existe encore.
 */
export function isCalibratable(exerciseId: string, intensity: string | undefined): boolean {
  return LOAD_IMPLEMENTS[exerciseId] !== undefined && intensityShare(intensity) !== null
}

export interface SetForEstimate {
  loadKg: number
  reps: number
  rpe: number
}

/**
 * L'estimation tirée d'une séance : la meilleure série de l'exercice, avec une
 * réserve de 10 − RPE. Nulle quand rien n'a été chargé.
 */
export function estimateFromSets(sets: readonly SetForEstimate[]): number | null {
  const estimates = sets
    .filter((set) => set.loadKg > 0 && set.reps > 0)
    .map((set) => estimatedMaxKg(set.loadKg, set.reps, Math.max(0, 10 - set.rpe)))
  return estimates.length === 0 ? null : Math.max(...estimates)
}

export interface LoadProposalInput {
  exerciseId: string
  intensity: string | undefined
  /** Le maximum estimé courant ; nul sans calage ni séance saisie. */
  estimateKg: number | null
  /** Ce que la règle de progression propose depuis la dernière séance (§ 9, P4). */
  nextLoadKg: number | null
}

/**
 * La charge proposée (P26) : pour un exercice dosé en pourcentage qui a une
 * estimation, le pourcentage de la phase appliqué au maximum — au changement
 * de phase, la charge suit, ce que la règle de progression d'un pas ne
 * faisait pas. Sinon, la règle de progression.
 */
export function proposedLoadKg(input: LoadProposalInput): number | null {
  const implement = LOAD_IMPLEMENTS[input.exerciseId]
  if (implement && input.estimateKg !== null && input.intensity) {
    const working = workingLoadKg(input.estimateKg, input.intensity, implement)
    if (working !== null) return working
  }
  return input.nextLoadKg
}
