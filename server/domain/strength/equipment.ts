/**
 * Matériel disponible (§ 5, P11.3). Orthogonal à l'intention : l'intention
 * choisit les séances, le matériel résout les exercices. Sans valeur, `salle`
 * — c'est l'hypothèse tacite de tout ce qui a été généré jusqu'ici.
 */
export enum StrengthEquipment {
  /** Un mur, une marche, une chaise. */
  None = 'aucun',
  /** Élastiques et une charge qui se tient à la main. */
  Home = 'maison',
  /** Barre, rack, poulie. */
  Gym = 'salle',
}

export const EQUIPMENT_LABELS: Record<StrengthEquipment, string> = {
  [StrengthEquipment.None]: 'Poids de corps',
  [StrengthEquipment.Home]: 'Élastiques et haltères',
  [StrengthEquipment.Gym]: 'Salle',
}

/** Ce qu'il faut avoir, du plus nu au plus fourni : la chaîne descend d'un cran. */
export const EQUIPMENT_RANK: Record<StrengthEquipment, number> = {
  [StrengthEquipment.None]: 0,
  [StrengthEquipment.Home]: 1,
  [StrengthEquipment.Gym]: 2,
}

export function equipmentCovers(
  available: StrengthEquipment,
  required: StrengthEquipment,
): boolean {
  return EQUIPMENT_RANK[available] >= EQUIPMENT_RANK[required]
}
