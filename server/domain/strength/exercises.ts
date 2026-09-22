import { StrengthEquipment, equipmentCovers } from './equipment'

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
  /**
   * Matériel exigé. Sans valeur, aucun : un mur, une marche, une chaise
   * suffisent, et l'exercice passe tel quel aux trois niveaux (§ 5, P11.3).
   */
  equipment?: StrengthEquipment
  /** Remplaçant au niveau du dessous : un exercice complet, jamais un libellé. */
  fallbackId?: string
  why: string
}

/** Bibliothèque des exercices (§ 5, Musculation et § 8). */
export const STRENGTH_EXERCISES: StrengthExercise[] = [
  {
    id: 'squat',
    equipment: StrengthEquipment.Gym,
    fallbackId: 'goblet-squat',
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
    equipment: StrengthEquipment.Home,
    fallbackId: 'fente-bulgare',
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
    equipment: StrengthEquipment.Gym,
    fallbackId: 'sdt-halteres',
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
    equipment: StrengthEquipment.Gym,
    fallbackId: 'pont-fessier-leste',
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
    equipment: StrengthEquipment.Gym,
    fallbackId: 'developpe-halteres',
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
    equipment: StrengthEquipment.Home,
    fallbackId: 'pompes',
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
    equipment: StrengthEquipment.Gym,
    fallbackId: 'developpe-halteres',
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
    equipment: StrengthEquipment.Gym,
    fallbackId: 'rowing-elastique',
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
    equipment: StrengthEquipment.Home,
    fallbackId: 'rowing-australien',
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
    equipment: StrengthEquipment.Home,
    fallbackId: 'ytw-sol',
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
    equipment: StrengthEquipment.Gym,
    fallbackId: 'pallof-elastique',
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
    equipment: StrengthEquipment.Home,
    fallbackId: 'fente-laterale',
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
    equipment: StrengthEquipment.Gym,
    fallbackId: 'squat-espagnol-sangle',
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
  {
    id: 'sdt-halteres',
    label: 'Soulevé de terre roumain haltères',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.Hypertrophy,
    sets: 3,
    reps: 10,
    tempo: '3-0-1-0',
    repDurationS: 3,
    defaultIntensity: 'modérée',
    eccentricLoad: true,
    equipment: StrengthEquipment.Home,
    fallbackId: 'sdt-unipodal',
    benefits: [StrengthBenefit.Running, StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Même charnière de hanche, charge devant les cuisses : la chaîne postérieure travaille en excentrique sans barre.',
  },
  {
    id: 'sdt-unipodal',
    label: 'Soulevé de terre unipodal',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.Hypertrophy,
    sets: 3,
    reps: 8,
    unilateral: true,
    tempo: '3-0-1-0',
    repDurationS: 4,
    benefits: [StrengthBenefit.Running, StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Ischios et équilibre sur un appui : la foulée est une suite d’appuis sur une jambe, et le déséquilibre remplace la charge.',
  },
  {
    id: 'pont-fessier-leste',
    label: 'Pont fessier lesté',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.Hypertrophy,
    sets: 4,
    reps: 10,
    repDurationS: 3,
    defaultIntensity: 'modérée',
    equipment: StrengthEquipment.Home,
    fallbackId: 'pont-fessier-unipodal',
    benefits: [StrengthBenefit.Cycling, StrengthBenefit.Running],
    lowerBody: true,
    why: 'Grand fessier en extension de hanche, charge posée sur le bassin : le hip thrust sans banc ni barre.',
  },
  {
    id: 'pont-fessier-unipodal',
    label: 'Pont fessier unipodal',
    group: StrengthGroup.Legs,
    effort: StrengthEffort.Hypertrophy,
    sets: 3,
    reps: 12,
    unilateral: true,
    repDurationS: 3,
    benefits: [StrengthBenefit.Running, StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Un appui au lieu de deux : c’est le poids du corps qui fait la charge, et le bassin doit rester droit.',
  },
  {
    id: 'rowing-elastique',
    label: 'Rowing à l’élastique',
    group: StrengthGroup.Pull,
    effort: StrengthEffort.Hypertrophy,
    sets: 3,
    reps: 12,
    repDurationS: 3,
    superset: 'pull',
    equipment: StrengthEquipment.Home,
    fallbackId: 'rowing-australien',
    benefits: [StrengthBenefit.Cycling, StrengthBenefit.Prevention],
    lowerBody: false,
    why: 'Tirage horizontal : la résistance monte en fin de mouvement, là où les omoplates se serrent.',
  },
  {
    id: 'rowing-australien',
    label: 'Rowing australien',
    group: StrengthGroup.Pull,
    effort: StrengthEffort.Hypertrophy,
    sets: 3,
    reps: 10,
    repDurationS: 3,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: false,
    why: 'Corps sous une table ou une barre basse : plus les pieds avancent, plus c’est dur. Le dos travaille sans rien à soulever.',
  },
  {
    id: 'developpe-halteres',
    label: 'Développé haltères',
    group: StrengthGroup.Push,
    effort: StrengthEffort.Hypertrophy,
    sets: 3,
    reps: 10,
    repDurationS: 3,
    superset: 'push',
    equipment: StrengthEquipment.Home,
    fallbackId: 'pompes',
    benefits: [],
    lowerBody: false,
    why: 'Poussée horizontale au sol ou sur un banc : l’amplitude est plus courte, l’épaule est plus libre qu’à la barre.',
  },
  {
    id: 'pompes',
    label: 'Pompes',
    group: StrengthGroup.Push,
    effort: StrengthEffort.Hypertrophy,
    sets: 3,
    reps: 12,
    repDurationS: 3,
    superset: 'push',
    progression: { fromSets: 3, fromReps: 8, toSets: 4, toReps: 15, weeks: 6 },
    benefits: [],
    lowerBody: false,
    why: 'Poussée et gainage dans le même mouvement. Mains surélevées pour alléger, pieds surélevés pour charger : le format remplace les disques.',
  },
  {
    id: 'ytw-sol',
    label: 'Y-T-W au sol',
    group: StrengthGroup.Pull,
    effort: StrengthEffort.Prevention,
    sets: 3,
    reps: 10,
    repDurationS: 3,
    dropOrder: 2,
    benefits: [StrengthBenefit.Cycling, StrengthBenefit.Prevention],
    lowerBody: false,
    why: 'Trois positions de bras à plat ventre : trapèzes bas et rotateurs, la zone que les heures de guidon enroulent.',
  },
  {
    id: 'pallof-elastique',
    label: 'Pallof press à l’élastique',
    group: StrengthGroup.Core,
    effort: StrengthEffort.Core,
    sets: 3,
    reps: 10,
    unilateral: true,
    repDurationS: 3,
    equipment: StrengthEquipment.Home,
    fallbackId: 'dead-bug',
    benefits: [StrengthBenefit.Prevention],
    lowerBody: false,
    why: 'Anti-rotation du tronc, élastique ancré à hauteur de poitrine : la poulie n’apporte rien de plus ici.',
  },
  {
    id: 'fente-laterale',
    label: 'Fente latérale',
    group: StrengthGroup.Prevention,
    effort: StrengthEffort.Prevention,
    sets: 2,
    reps: 12,
    unilateral: true,
    repDurationS: 3,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Moyen fessier et adducteurs dans le plan frontal, sans élastique : le pas de côté chargé par le poids du corps.',
  },
  {
    id: 'squat-espagnol-sangle',
    label: 'Squat espagnol à la sangle',
    group: StrengthGroup.Prevention,
    effort: StrengthEffort.AntalgicIsometry,
    sets: 4,
    reps: 45,
    isometric: true,
    repDurationS: 1,
    equipment: StrengthEquipment.Home,
    fallbackId: 'wall-sit',
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Sangle passée derrière les genoux et ancrée bas : même isométrie antalgique du tendon rotulien, sans rack.',
  },
  {
    id: 'wall-sit',
    label: 'Chaise contre le mur',
    group: StrengthGroup.Prevention,
    effort: StrengthEffort.AntalgicIsometry,
    sets: 4,
    reps: 45,
    isometric: true,
    repDurationS: 1,
    benefits: [StrengthBenefit.Prevention],
    lowerBody: true,
    why: 'Isométrie du quadriceps dos au mur, cuisses à l’horizontale : l’effet antalgique tient à la durée de contraction, pas au matériel.',
  },
]

const BY_ID = new Map(STRENGTH_EXERCISES.map((exercise) => [exercise.id, exercise]))

export function strengthExercise(id: string): StrengthExercise | undefined {
  return BY_ID.get(id)
}

export function exercisesOf(group: StrengthGroup): StrengthExercise[] {
  return STRENGTH_EXERCISES.filter((exercise) => exercise.group === group)
}

/** Matériel exigé par un exercice : aucun, tant qu'il n'en déclare pas (§ 5, P11.3). */
export function requiredEquipment(exercise: StrengthExercise): StrengthEquipment {
  return exercise.equipment ?? StrengthEquipment.None
}

/**
 * L'exercice à faire avec le matériel qu'on a (§ 5, P11.3). La chaîne descend
 * d'un cran à la fois jusqu'à ce qu'elle tienne ; le remplaçant est un
 * exercice complet de la bibliothèque, jamais le même exercice relabellé.
 */
export function resolveForEquipment(
  id: string,
  available: StrengthEquipment,
): StrengthExercise | undefined {
  let exercise = strengthExercise(id)

  while (exercise && !equipmentCovers(available, requiredEquipment(exercise))) {
    exercise = exercise.fallbackId ? strengthExercise(exercise.fallbackId) : undefined
  }

  return exercise
}

/** La chaîne entière, du plus fourni au plus nu : la fenêtre d'exercice la montre. */
export function substitutionChain(id: string): StrengthExercise[] {
  const chain: StrengthExercise[] = []
  let exercise = strengthExercise(id)

  while (exercise && !chain.includes(exercise)) {
    chain.push(exercise)
    exercise = exercise.fallbackId ? strengthExercise(exercise.fallbackId) : undefined
  }

  return chain
}

/** Repos entre séries : la nature de l'effort le fixe, la phase le module (§ 5). */
export function recoveryFor(exercise: StrengthExercise, restFactor = 1): number {
  const base = exercise.recoveryOverrideS ?? EFFORT_RECOVERY_S[exercise.effort]
  return Math.round(base * restFactor)
}
