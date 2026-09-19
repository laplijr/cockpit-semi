/**
 * Ce que le simulateur suppose de Ronan, au-delà du plan lui-même : les charges
 * qu'il pousse, le sommeil qu'il dort, et la façon dont il ressent chaque type
 * de séance. Rien ici n'est du moteur — ce sont les données qu'un athlète réel
 * produirait, et sans lesquelles la moitié des écrans reste vide (§ P3.5).
 */

/**
 * Charge de départ par exercice, en kilos, telle qu'elle serait saisie à la
 * première séance. Zéro = poids du corps ; un exercice absent n'est pas chargé.
 */
export const START_LOAD_KG: Record<string, number> = {
  squat: 60,
  'goblet-squat': 20,
  'sdt-roumain': 50,
  'fente-bulgare': 12,
  'hip-thrust': 60,
  'mollet-unipodal': 10,
  'mollet-soleaire': 20,
  'mollet-bipodal': 30,
  'developpe-couche': 45,
  'developpe-militaire': 30,
  rowing: 40,
  tractions: 0,
  dips: 0,
  'face-pull': 15,
  'farmer-walk': 24,
  nordic: 0,
  pliometrie: 0,
  'saut-unipodal': 0,
  'pont-fessier': 0,
}

/**
 * Biais de ressenti par type de séance : de combien de points de RPE Ronan
 * s'écarte de ce que la prescription attend. Le seuil accroche à partir d'un
 * demi-point (§ 5, biais de RPE) — le seuil et le fractionné lui coûtent plus
 * cher que prévu, l'endurance moins.
 */
export const RPE_BIAS_BY_CODE: Record<string, number> = {
  seuil: 1,
  VMA: 1,
  SL: 0.5,
  EF: -0.5,
  Z2: -0.5,
}

/** Part des nuits sous six heures : assez pour que la sensibilité se mesure. */
export const SHORT_NIGHT_RATE = 0.18
/** Ce qu'une nuit courte coûte, en points de RPE, le lendemain. */
export const SHORT_NIGHT_RPE_COST = 1.5

/** Part des propositions que Ronan accepte quand il les décide. */
export const PROPOSAL_ACCEPT_RATE = 0.55

/**
 * Part des exercices où le format prescrit n'est pas tenu : la dernière série
 * s'arrête court. Sans ça, la charge monte à chaque séance et la courbe de
 * Progression est une droite — le palier et la décharge de `nextLoadKg` ne se
 * voient jamais.
 */
export const MISSED_FORMAT_RATE = 0.18
