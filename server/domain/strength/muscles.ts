/** Les muscles qu'une fiche d'exercice nomme (P25), avec leurs libellés français. */
export enum StrengthMuscle {
  Quadriceps = 'quadriceps',
  Hamstrings = 'ischios',
  Glutes = 'fessiers',
  GluteMedius = 'moyen_fessier',
  Adductors = 'adducteurs',
  Calves = 'mollets',
  Soleus = 'soleaire',
  HipFlexors = 'flechisseurs_hanche',
  Foot = 'pied',
  Abdominals = 'abdominaux',
  Obliques = 'obliques',
  LowerBack = 'lombaires',
  Chest = 'pectoraux',
  Shoulders = 'epaules',
  RearShoulders = 'arriere_epaules',
  Triceps = 'triceps',
  Biceps = 'biceps',
  Lats = 'grand_dorsal',
  UpperBack = 'haut_du_dos',
  RotatorCuff = 'coiffe',
  Forearms = 'avant_bras',
  Diaphragm = 'diaphragme',
}

export const MUSCLE_LABELS: Record<StrengthMuscle, string> = {
  [StrengthMuscle.Quadriceps]: 'Quadriceps',
  [StrengthMuscle.Hamstrings]: 'Ischio-jambiers',
  [StrengthMuscle.Glutes]: 'Grand fessier',
  [StrengthMuscle.GluteMedius]: 'Moyen fessier',
  [StrengthMuscle.Adductors]: 'Adducteurs',
  [StrengthMuscle.Calves]: 'Gastrocnémiens',
  [StrengthMuscle.Soleus]: 'Soléaire',
  [StrengthMuscle.HipFlexors]: 'Fléchisseurs de hanche',
  [StrengthMuscle.Foot]: 'Muscles du pied',
  [StrengthMuscle.Abdominals]: 'Abdominaux',
  [StrengthMuscle.Obliques]: 'Obliques',
  [StrengthMuscle.LowerBack]: 'Lombaires',
  [StrengthMuscle.Chest]: 'Pectoraux',
  [StrengthMuscle.Shoulders]: 'Épaules',
  [StrengthMuscle.RearShoulders]: 'Arrière d’épaule',
  [StrengthMuscle.Triceps]: 'Triceps',
  [StrengthMuscle.Biceps]: 'Biceps',
  [StrengthMuscle.Lats]: 'Grand dorsal',
  [StrengthMuscle.UpperBack]: 'Trapèzes et rhomboïdes',
  [StrengthMuscle.RotatorCuff]: 'Coiffe des rotateurs',
  [StrengthMuscle.Forearms]: 'Avant-bras',
  [StrengthMuscle.Diaphragm]: 'Diaphragme',
}

/**
 * Comment faire un exercice (P25) : les consignes dans l'ordre du geste, les
 * deux erreurs qui comptent, et les muscles. Écrit une fois, relu par Ronan,
 * jamais généré à l'exécution.
 */
export interface ExerciseTechnique {
  /** De trois à cinq consignes, dans l'ordre où le geste se fait. */
  cues: string[]
  mistakes: [string, string]
  primary: StrengthMuscle[]
  secondary: StrengthMuscle[]
}
