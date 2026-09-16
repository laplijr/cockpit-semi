/** Ce qu'un exercice apporte, affiché tel quel sur la page Muscu. */
export enum StrengthBenefit {
  Running = 'course',
  Cycling = 'velo',
  Prevention = 'prevention',
}

export enum StrengthGroup {
  Legs = 'legs',
  Push = 'push',
  Pull = 'pull',
  Prevention = 'prevention',
  Mobility = 'mobilite',
}

export interface StrengthExercise {
  id: string
  label: string
  group: StrengthGroup
  sets: number
  /** Répétitions par série ; pour un isométrique, des secondes tenues. */
  reps: number
  /** Vrai quand les répétitions sont des secondes de maintien. */
  isometric?: boolean
  benefits: StrengthBenefit[]
  /** Vrai quand l'exercice charge les jambes : gelé sur blessure basse (§ 5). */
  lowerBody: boolean
  /** Progression sur plusieurs semaines : première et dernière marche. */
  progression?: {
    fromSets: number
    fromReps: number
    toSets: number
    toReps: number
    weeks: number
  }
  why: string
}

/** Bibliothèque des exercices, reprise des maquettes (§ 8). */
export const STRENGTH_EXERCISES: StrengthExercise[] = [
  {
    id: 'squat',
    label: 'Squat arrière (ou goblet)',
    group: StrengthGroup.Legs,
    sets: 4,
    reps: 4,
    benefits: [StrengthBenefit.Running, StrengthBenefit.Cycling],
    lowerBody: true,
    why: 'Force maximale : économie de course et puissance de pédalage. Descente contrôlée 2 s, montée à intention maximale.',
  },
  {
    id: 'sdt-roumain',
    label: 'Soulevé de terre roumain',
    group: StrengthGroup.Legs,
    sets: 3,
    reps: 6,
    benefits: [StrengthBenefit.Running, StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Ischios et fessiers en charge : chaîne postérieure, assurance ischios pour les fractionnés.',
  },
  {
    id: 'fente-bulgare',
    label: 'Fente bulgare',
    group: StrengthGroup.Legs,
    sets: 3,
    reps: 6,
    benefits: [StrengthBenefit.Running, StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Unilatéral comme la foulée : asymétries, stabilité genou-hanche.',
  },
  {
    id: 'mollet-unipodal',
    label: 'Mollet unipodal, genou tendu puis fléchi',
    group: StrengthGroup.Legs,
    sets: 3,
    reps: 10,
    benefits: [StrengthBenefit.Prevention, StrengthBenefit.Running],
    lowerBody: true,
    why: 'Genou tendu pour le tendon d’Achille, fléchi pour le soléaire, le muscle qui encaisse le plus en course. Lent et lourd : 3 s / 3 s.',
  },
  {
    id: 'nordic',
    label: 'Nordic hamstring curl',
    group: StrengthGroup.Legs,
    sets: 1,
    reps: 4,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    progression: { fromSets: 1, fromReps: 4, toSets: 3, toReps: 8, weeks: 6 },
    why: 'Progression sur six semaines pour éviter les courbatures de 48 h. Une assurance ischios, pas une priorité.',
  },
  {
    id: 'pliometrie',
    label: 'Pliométrie : sauts et pogos',
    group: StrengthGroup.Legs,
    sets: 3,
    reps: 5,
    benefits: [StrengthBenefit.Running],
    lowerBody: true,
    why: 'Le stimulus le mieux démontré pour l’économie de course. En début de séance, frais, sol dur, contacts courts.',
  },
  {
    id: 'developpe-couche',
    label: 'Développé couché',
    group: StrengthGroup.Push,
    sets: 4,
    reps: 5,
    benefits: [],
    lowerBody: false,
    why: 'Exercice principal du haut du corps, sans interférence avec la course.',
  },
  {
    id: 'developpe-militaire',
    label: 'Développé militaire haltères',
    group: StrengthGroup.Push,
    sets: 3,
    reps: 8,
    benefits: [StrengthBenefit.Running],
    lowerBody: false,
    why: 'Épaules solides : bras relâchés et posture qui tient en fin de semi.',
  },
  {
    id: 'dips',
    label: 'Dips (ou écarté incliné)',
    group: StrengthGroup.Push,
    sets: 3,
    reps: 8,
    benefits: [],
    lowerBody: false,
    why: 'Volume pectoraux et triceps. Premier exercice retiré en phase spécifique.',
  },
  {
    id: 'pallof',
    label: 'Pallof press',
    group: StrengthGroup.Push,
    sets: 3,
    reps: 10,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: false,
    why: 'Anti-rotation du tronc : stabilité du bassin en course. Preuve modeste, coût faible.',
  },
  {
    id: 'planche-laterale',
    label: 'Planche latérale et abduction',
    group: StrengthGroup.Push,
    sets: 3,
    reps: 40,
    isometric: true,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: false,
    why: 'Obliques et moyen fessier. Utile sur les douleurs de genou du coureur, preuve modérée.',
  },
  {
    id: 'tractions',
    label: 'Tractions (ou tirage vertical)',
    group: StrengthGroup.Pull,
    sets: 4,
    reps: 5,
    benefits: [],
    lowerBody: false,
    why: 'Exercice principal du dos. Lesté quand 4 × 8 passent proprement.',
  },
  {
    id: 'rowing',
    label: 'Rowing haltère unilatéral',
    group: StrengthGroup.Pull,
    sets: 3,
    reps: 8,
    benefits: [StrengthBenefit.Cycling, StrengthBenefit.Prevention],
    lowerBody: false,
    why: 'Grand dorsal et tronc en appui : tient la position sur le vélo, protège le bas du dos.',
  },
  {
    id: 'face-pull',
    label: 'Face pull à l’élastique',
    group: StrengthGroup.Pull,
    sets: 3,
    reps: 12,
    benefits: [StrengthBenefit.Cycling, StrengthBenefit.Prevention],
    lowerBody: false,
    why: 'Rééquilibre les épaules enroulées par les heures de guidon. Coiffe des rotateurs.',
  },
  {
    id: 'hip-thrust',
    label: 'Hip thrust, charge modérée',
    group: StrengthGroup.Pull,
    sets: 3,
    reps: 8,
    benefits: [StrengthBenefit.Cycling, StrengthBenefit.Running],
    lowerBody: true,
    why: 'Grand fessier isolé : puissance assise sur le vélo. Modéré, car le seuil est le lendemain.',
  },
  {
    id: 'farmer-walk',
    label: 'Farmer walk',
    group: StrengthGroup.Pull,
    sets: 3,
    reps: 30,
    isometric: true,
    benefits: [StrengthBenefit.Running],
    lowerBody: false,
    why: 'Gainage debout sous charge : posture haute quand la fatigue arrive.',
  },
  {
    id: 'monster-walk',
    label: 'Monster walk élastique',
    group: StrengthGroup.Prevention,
    sets: 2,
    reps: 15,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Moyen fessier : genou fémoro-patellaire et syndrome de l’essuie-glace.',
  },
  {
    id: 'squat-espagnol',
    label: 'Squat espagnol isométrique',
    group: StrengthGroup.Prevention,
    sets: 3,
    reps: 30,
    isometric: true,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Tendon rotulien du coureur et du cycliste, bien documenté.',
  },
  {
    id: 'fente-basse',
    label: 'Fente basse tenue et relevé de genou lesté',
    group: StrengthGroup.Prevention,
    sets: 2,
    reps: 10,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Amplitude d’extension de hanche pour la foulée, après les heures assis.',
  },
  {
    id: 'genou-au-mur',
    label: 'Mobilité genou-au-mur',
    group: StrengthGroup.Mobility,
    sets: 2,
    reps: 10,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Amplitude de cheville pour la foulée et le pédalage.',
  },
  {
    id: 'short-foot',
    label: 'Short foot et toe yoga',
    group: StrengthGroup.Mobility,
    sets: 2,
    reps: 30,
    isometric: true,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Aponévrose plantaire.',
  },
]

export function exercisesOf(group: StrengthGroup): StrengthExercise[] {
  return STRENGTH_EXERCISES.filter((exercise) => exercise.group === group)
}

export function strengthExercise(id: string): StrengthExercise | undefined {
  return STRENGTH_EXERCISES.find((exercise) => exercise.id === id)
}
