/** Ressentis proposés au retour de séance, dans l'ordre d'affichage. */
export enum Sensation {
  Easy = 'aisance',
  FreshLegs = 'jambes_fraiches',
  HeavyLegs = 'jambes_lourdes',
  Breathless = 'essoufflement',
  Stiff = 'raideur',
  Nauseous = 'nausee',
}

export const SENSATION_LABELS: Record<Sensation, string> = {
  [Sensation.Easy]: 'Aisance',
  [Sensation.FreshLegs]: 'Jambes fraîches',
  [Sensation.HeavyLegs]: 'Jambes lourdes',
  [Sensation.Breathless]: 'Essoufflement',
  [Sensation.Stiff]: 'Raideur',
  [Sensation.Nauseous]: 'Nausée',
}

/** Signaux de fatigue au sens des règles R2 et R4 (§ 5). */
export const FATIGUE_SENSATIONS = [Sensation.HeavyLegs, Sensation.Stiff] as const

export interface Pain {
  zone: string
  /** 0 à 10. Au-delà de 3 sur deux séances, R5 propose une pause. */
  intensity: number
}
