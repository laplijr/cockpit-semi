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
  Core = 'core',
  Prevention = 'prevention',
  Mobility = 'mobilite',
}

/**
 * Nature de l'effort. C'est elle qui fixe le repos entre séries, pas le rang
 * de l'exercice dans la séance (§ 5, Musculation).
 */
export enum StrengthEffort {
  MaxStrength = 'force_max',
  SpeedStrength = 'force_vitesse',
  Hypertrophy = 'hypertrophie',
  Core = 'gainage',
  Prevention = 'prevention',
  AntalgicIsometry = 'isometrie_antalgique',
  Mobility = 'mobilite',
}

export const EFFORT_RECOVERY_S: Record<StrengthEffort, number> = {
  [StrengthEffort.MaxStrength]: 180,
  [StrengthEffort.SpeedStrength]: 150,
  [StrengthEffort.Hypertrophy]: 90,
  [StrengthEffort.Core]: 45,
  [StrengthEffort.Prevention]: 45,
  [StrengthEffort.AntalgicIsometry]: 120,
  [StrengthEffort.Mobility]: 20,
}

export const EFFORT_LABELS: Record<StrengthEffort, string> = {
  [StrengthEffort.MaxStrength]: 'Force maximale',
  [StrengthEffort.SpeedStrength]: 'Force-vitesse',
  [StrengthEffort.Hypertrophy]: 'Hypertrophie',
  [StrengthEffort.Core]: 'Gainage',
  [StrengthEffort.Prevention]: 'Prévention',
  [StrengthEffort.AntalgicIsometry]: 'Isométrie antalgique',
  [StrengthEffort.Mobility]: 'Mobilité',
}

export interface StrengthProgression {
  fromSets: number
  fromReps: number
  toSets: number
  toReps: number
  weeks: number
}

export interface StrengthExercise {
  id: string
  label: string
  group: StrengthGroup
  effort: StrengthEffort
  sets: number
  /** Répétitions par série ; pour un isométrique, des secondes tenues. */
  reps: number
  isometric?: boolean
  /** Vrai quand la série se fait côté par côté : la durée compte les deux. */
  unilateral?: boolean
  /** Tempo en quatre temps, quand il est prescrit : « 2-0-X-0 ». */
  tempo?: string
  /** Durée d'une répétition, en secondes : c'est elle qui donne la durée réelle. */
  repDurationS: number
  /** Repère de charge propre à l'exercice, quand il ne suit pas la dose de phase. */
  defaultIntensity?: string
  /**
   * Repos propre à l'exercice, quand la façon de le faire l'impose : les
   * mollets s'alternent d'une jambe à l'autre, la récupération d'un côté se
   * prend pendant que l'autre travaille (§ 5).
   */
  recoveryOverrideS?: number
  /** Excentrique lourd : soumis à l'écart de 48 h avant une séance clé (§ 5, G3). */
  eccentricLoad?: boolean
  /** Contacts au sol d'une série de pliométrie. */
  contacts?: number
  /**
   * Rang de retrait quand le volume de course monte : 1 part en premier.
   * Sans valeur, l'exercice n'est jamais retiré (§ 5, ordre de retrait).
   */
  dropOrder?: number
  /** Exercices qui partagent une clé s'enchaînent en superset antagoniste. */
  superset?: string
  benefits: StrengthBenefit[]
  /** Vrai quand l'exercice charge les jambes : gelé sur blessure basse (§ 5, G5). */
  lowerBody: boolean
  progression?: StrengthProgression
  why: string
}

/** Bibliothèque des exercices (§ 5, Musculation et § 8). */
export const STRENGTH_EXERCISES: StrengthExercise[] = [
  {
    id: 'squat',
    label: 'Squat arrière',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.MaxStrength,
    sets: 4,
    reps: 5,
    tempo: '2-0-X-0',
    repDurationS: 3,
    defaultIntensity: '85 %',
    benefits: [StrengthBenefit.Running, StrengthBenefit.Cycling],
    lowerBody: true,
    why: 'La charge lourde devance nettement la pliométrie sur l’économie de course. Descente contrôlée deux secondes, montée à intention maximale : c’est la vitesse d’intention qui transfère.',
  },
  {
    id: 'goblet-squat',
    label: 'Goblet squat',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.Hypertrophy,
    sets: 3,
    reps: 10,
    repDurationS: 3,
    defaultIntensity: 'modérée',
    benefits: [StrengthBenefit.Running],
    lowerBody: true,
    why: 'Même schéma que le squat, charge devant et dos vertical : la version qui se dose sans barre, pour une séance courte ou une reprise.',
  },
  {
    id: 'sdt-roumain',
    label: 'Soulevé de terre roumain',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.MaxStrength,
    sets: 3,
    reps: 6,
    tempo: '3-0-1-0',
    repDurationS: 4,
    defaultIntensity: '75 %',
    eccentricLoad: true,
    benefits: [StrengthBenefit.Running, StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Ischios et fessiers en charge sur toute l’amplitude : chaîne postérieure, assurance ischios pour les fractionnés.',
  },
  {
    id: 'fente-bulgare',
    label: 'Fente bulgare',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.Hypertrophy,
    sets: 3,
    reps: 8,
    unilateral: true,
    repDurationS: 3,
    eccentricLoad: true,
    dropOrder: 4,
    benefits: [StrengthBenefit.Running, StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Unilatéral comme la foulée : asymétries, stabilité genou-hanche.',
  },
  {
    id: 'mollet-unipodal',
    label: 'Mollet unipodal, genou tendu',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.Hypertrophy,
    sets: 3,
    reps: 8,
    unilateral: true,
    tempo: '3-1-2-0',
    repDurationS: 6,
    recoveryOverrideS: 30,
    benefits: [StrengthBenefit.Prevention, StrengthBenefit.Running],
    lowerBody: true,
    why: 'Genou tendu, c’est le tendon d’Achille et les gastrocnémiens qui travaillent. Lent et lourd, trois secondes dans chaque sens.',
  },
  {
    id: 'mollet-soleaire',
    label: 'Mollet unipodal, genou fléchi',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.Hypertrophy,
    sets: 3,
    reps: 10,
    unilateral: true,
    repDurationS: 4,
    recoveryOverrideS: 30,
    benefits: [StrengthBenefit.Prevention, StrengthBenefit.Running],
    lowerBody: true,
    why: 'Genou fléchi pour isoler le soléaire, qui porte plus de la moitié du soutien vertical en course. Ce n’est pas un accessoire.',
  },
  {
    id: 'nordic',
    label: 'Nordic hamstring curl',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.Hypertrophy,
    sets: 1,
    reps: 4,
    repDurationS: 5,
    eccentricLoad: true,
    dropOrder: 3,
    progression: { fromSets: 1, fromReps: 4, toSets: 3, toReps: 8, weeks: 6 },
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Progression sur six semaines pour éviter les courbatures de 48 h. Effet non concluant hors football : une assurance, pas une priorité.',
  },
  {
    id: 'pliometrie',
    label: 'Pliométrie : pogos puis sauts',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.SpeedStrength,
    sets: 4,
    reps: 5,
    contacts: 5,
    repDurationS: 2,
    benefits: [StrengthBenefit.Running],
    lowerBody: true,
    why: 'Complément pour la raideur tendineuse, moins puissant que la charge lourde sur l’économie de course. À froid, en début de séance, sol dur, contacts courts.',
  },
  {
    id: 'saut-unipodal',
    label: 'Saut unipodal',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.SpeedStrength,
    sets: 3,
    reps: 6,
    unilateral: true,
    contacts: 6,
    repDurationS: 2,
    benefits: [StrengthBenefit.Running],
    lowerBody: true,
    why: 'La foulée est une suite d’appuis sur une jambe : le saut unipodal s’en approche plus que le saut à deux pieds.',
  },
  {
    id: 'hip-thrust',
    label: 'Hip thrust',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.Hypertrophy,
    sets: 4,
    reps: 8,
    repDurationS: 3,
    defaultIntensity: '75 %',
    benefits: [StrengthBenefit.Cycling, StrengthBenefit.Running],
    lowerBody: true,
    why: 'Grand fessier isolé : c’est le moteur de la poussée assise sur le vélo. Démontré en sprint, transfert au fond probable mais peu mesuré.',
  },
  {
    id: 'pont-fessier',
    label: 'Pont fessier bipodal',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.Prevention,
    sets: 3,
    reps: 12,
    repDurationS: 3,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Réveil des fessiers sans charge externe : la première marche d’une reprise.',
  },
  {
    id: 'mollet-bipodal',
    label: 'Mollet bipodal',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.Prevention,
    sets: 3,
    reps: 15,
    repDurationS: 3,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Version à deux pieds, sans charge : de quoi entretenir le mollet quand l’unipodal est encore trop.',
  },
  {
    id: 'developpe-couche',
    label: 'Développé couché',
    group: StrengthGroup.Push,
    effort: StrengthEffort.MaxStrength,
    sets: 4,
    reps: 5,
    repDurationS: 3,
    defaultIntensity: '85 %',
    benefits: [],
    lowerBody: false,
    why: 'Aucun apport à la course : il est là pour l’équilibre du haut du corps, et c’est assumé.',
  },
  {
    id: 'developpe-militaire',
    label: 'Développé militaire haltères',
    group: StrengthGroup.Push,
    effort: StrengthEffort.Hypertrophy,
    sets: 3,
    reps: 8,
    repDurationS: 3,
    superset: 'push',
    benefits: [StrengthBenefit.Running],
    lowerBody: false,
    why: 'Épaules solides : bras relâchés et posture qui tient en fin de semi.',
  },
  {
    id: 'dips',
    label: 'Dips',
    group: StrengthGroup.Push,
    effort: StrengthEffort.Hypertrophy,
    sets: 3,
    reps: 8,
    repDurationS: 3,
    dropOrder: 1,
    benefits: [],
    lowerBody: false,
    why: 'Volume pectoraux et triceps. Premier exercice retiré quand le volume de course monte.',
  },
  {
    id: 'tractions',
    label: 'Tractions',
    group: StrengthGroup.Pull,
    effort: StrengthEffort.MaxStrength,
    sets: 4,
    reps: 5,
    repDurationS: 3,
    benefits: [],
    lowerBody: false,
    why: 'Exercice principal du dos. Lesté dès que 4 × 8 passent proprement.',
  },
  {
    id: 'rowing',
    label: 'Rowing haltère unilatéral',
    group: StrengthGroup.Pull,
    effort: StrengthEffort.Hypertrophy,
    sets: 3,
    reps: 8,
    unilateral: true,
    repDurationS: 3,
    superset: 'pull',
    benefits: [StrengthBenefit.Cycling, StrengthBenefit.Prevention],
    lowerBody: false,
    why: 'Grand dorsal et tronc en appui : tient la position sur le vélo, protège le bas du dos.',
  },
  {
    id: 'face-pull',
    label: 'Face pull à l’élastique',
    group: StrengthGroup.Pull,
    effort: StrengthEffort.Prevention,
    sets: 3,
    reps: 15,
    repDurationS: 2,
    dropOrder: 2,
    benefits: [StrengthBenefit.Cycling, StrengthBenefit.Prevention],
    lowerBody: false,
    why: 'Rééquilibre les épaules enroulées par les heures de guidon. Coiffe des rotateurs.',
  },
  {
    id: 'farmer-walk',
    label: 'Farmer walk',
    group: StrengthGroup.Pull,
    effort: StrengthEffort.Core,
    sets: 3,
    reps: 30,
    isometric: true,
    repDurationS: 1,
    benefits: [StrengthBenefit.Running],
    lowerBody: false,
    why: 'Gainage debout sous charge : posture haute quand la fatigue arrive.',
  },
  {
    id: 'pallof',
    label: 'Pallof press',
    group: StrengthGroup.Core,
    effort: StrengthEffort.Core,
    sets: 3,
    reps: 10,
    unilateral: true,
    repDurationS: 3,
    superset: 'push',
    benefits: [StrengthBenefit.Prevention],
    lowerBody: false,
    why: 'Anti-rotation du tronc : stabilité du bassin en course. Preuve modeste, coût faible.',
  },
  {
    id: 'planche-laterale',
    label: 'Planche latérale',
    group: StrengthGroup.Core,
    effort: StrengthEffort.Core,
    sets: 3,
    reps: 30,
    isometric: true,
    unilateral: true,
    repDurationS: 1,
    superset: 'pull',
    benefits: [StrengthBenefit.Prevention],
    lowerBody: false,
    why: 'Obliques et moyen fessier. Utile sur les douleurs de genou du coureur, preuve modérée.',
  },
  {
    id: 'dead-bug',
    label: 'Dead bug',
    group: StrengthGroup.Core,
    effort: StrengthEffort.Core,
    sets: 3,
    reps: 10,
    unilateral: true,
    repDurationS: 3,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: false,
    why: 'Gainage antéro-postérieur au sol, sans charge sur le rachis : la variante qui passe un jour de fatigue.',
  },
  {
    id: 'monster-walk',
    label: 'Monster walk élastique',
    group: StrengthGroup.Prevention,
    effort: StrengthEffort.Prevention,
    sets: 2,
    reps: 15,
    unilateral: true,
    repDurationS: 2,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Moyen fessier : genou fémoro-patellaire et syndrome de l’essuie-glace.',
  },
  {
    id: 'squat-espagnol',
    label: 'Squat espagnol isométrique',
    group: StrengthGroup.Prevention,
    effort: StrengthEffort.AntalgicIsometry,
    sets: 4,
    reps: 45,
    isometric: true,
    repDurationS: 1,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Antalgique tendineux à effet immédiat sur le tendon rotulien. Un soulagement, pas une prévention universelle.',
  },
  {
    id: 'fente-basse',
    label: 'Fente basse tenue et relevé de genou',
    group: StrengthGroup.Prevention,
    effort: StrengthEffort.Mobility,
    sets: 2,
    reps: 10,
    unilateral: true,
    repDurationS: 4,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Amplitude d’extension de hanche pour la foulée, après les heures assis.',
  },
  {
    id: 'copenhagen',
    label: 'Copenhagen court',
    group: StrengthGroup.Prevention,
    effort: StrengthEffort.Prevention,
    sets: 2,
    reps: 20,
    isometric: true,
    unilateral: true,
    repDurationS: 1,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Adducteurs en appui latéral : la zone que le coureur néglige jusqu’à ce qu’elle tire.',
  },
  {
    id: 'genou-au-mur',
    label: 'Mobilité genou-au-mur',
    group: StrengthGroup.Mobility,
    effort: StrengthEffort.Mobility,
    sets: 2,
    reps: 10,
    unilateral: true,
    repDurationS: 4,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Amplitude de cheville pour la foulée et le pédalage.',
  },
  {
    id: 'short-foot',
    label: 'Short foot et toe yoga',
    group: StrengthGroup.Mobility,
    effort: StrengthEffort.Mobility,
    sets: 2,
    reps: 30,
    isometric: true,
    unilateral: true,
    repDurationS: 1,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Aponévrose plantaire et voûte active.',
  },
  {
    id: 'etirement-psoas',
    label: 'Étirement psoas actif',
    group: StrengthGroup.Mobility,
    effort: StrengthEffort.Mobility,
    sets: 2,
    reps: 45,
    isometric: true,
    unilateral: true,
    repDurationS: 1,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Fléchisseurs de hanche raccourcis par la position assise : ils bornent l’extension en fin de foulée.',
  },
  {
    id: 'mobilite-thoracique',
    label: 'Mobilité thoracique',
    group: StrengthGroup.Mobility,
    effort: StrengthEffort.Mobility,
    sets: 2,
    reps: 10,
    unilateral: true,
    repDurationS: 4,
    benefits: [StrengthBenefit.Cycling, StrengthBenefit.Prevention],
    lowerBody: false,
    why: 'Rotation du haut du dos : ce que les heures de guidon enlèvent en premier.',
  },
  {
    id: 'respiration',
    label: 'Respiration diaphragmatique',
    group: StrengthGroup.Mobility,
    effort: StrengthEffort.Mobility,
    sets: 1,
    reps: 180,
    isometric: true,
    repDurationS: 1,
    benefits: [],
    lowerBody: false,
    why: 'Trois minutes pour refermer la séance et redescendre.',
  },
]

const BY_ID = new Map(STRENGTH_EXERCISES.map((exercise) => [exercise.id, exercise]))

export function strengthExercise(id: string): StrengthExercise | undefined {
  return BY_ID.get(id)
}

export function exercisesOf(group: StrengthGroup): StrengthExercise[] {
  return STRENGTH_EXERCISES.filter((exercise) => exercise.group === group)
}

/** Repos entre séries : la nature de l'effort le fixe, la phase le module (§ 5). */
export function recoveryFor(exercise: StrengthExercise, restFactor = 1): number {
  const base = exercise.recoveryOverrideS ?? EFFORT_RECOVERY_S[exercise.effort]
  return Math.round(base * restFactor)
}
