/**
 * Vocabulaire d'entraîneur de l'app, expliqué au survol du libellé (§ 11).
 * Une explication tient en deux phrases et 240 caractères : au-delà, la notion
 * relève d'une page, pas d'une bulle.
 */

export interface GlossaryEntry {
  /** Libellé complet de la notion, quand l'écran l'abrège. */
  readonly title: string
  readonly text: string
}

export const GLOSSARY = {
  vdot: {
    title: 'VDOT',
    text: "Indice de forme de Daniels, calculé depuis un chrono. Il donne les allures d'entraînement et la projection sur n'importe quelle distance.",
  },
  plancher: {
    title: 'Plancher de forme',
    text: "VDOT minimal déduit d'un segment couru proprement, faute de chrono représentatif. La vraie valeur est au-dessus : elle se mesure au premier test.",
  },
  allureE: {
    title: 'Allure E (endurance)',
    text: "Allure de conversation, 59 à 74 % du VDOT. Elle porte l'essentiel du volume : c'est là que le corps s'adapte sans s'abîmer.",
  },
  allureM: {
    title: 'Allure M (marathon)',
    text: 'Allure de course sur marathon, 75 à 84 % du VDOT. Elle sert de rythme soutenu sans être un effort de seuil.',
  },
  allureT: {
    title: 'Allure T (seuil)',
    text: "Allure tenable environ une heure, 83 à 88 % du VDOT. Elle recule le point où l'acide lactique s'accumule.",
  },
  allureI: {
    title: 'Allure I (intervalles)',
    text: 'Allure de fractionné court, 95 à 100 % du VDOT. Elle travaille le plafond de consommation d’oxygène.',
  },
  allureR: {
    title: 'Allure R (répétitions)',
    text: 'Allure vive et relâchée, 105 à 110 % du VDOT. Elle entretient la foulée et la vitesse pure, sur des efforts très courts.',
  },
  allureSemi: {
    title: 'Allure semi',
    text: "Allure moyenne de la projection sur 21,1 km, jamais une zone. C'est le rythme à répéter quand la course A approche.",
  },
  rpe: {
    title: 'RPE (effort perçu)',
    text: "Effort ressenti de 1 à 10, noté après la séance. Il sert à calculer la charge et à comparer l'effort réel à l'effort prévu.",
  },
  ua: {
    title: 'UA (unité arbitraire)',
    text: 'Charge = RPE × durée en minutes. Elle met course, vélo et musculation sur la même échelle.',
  },
  ratioCharge: {
    title: 'Ratio 7 j / 21 j',
    text: 'Charge des 7 derniers jours rapportée à celle des 21 précédents. Entre 0,8 et 1,3 la montée est jugée sûre ; au-delà le risque monte.',
  },
  monotonie: {
    title: 'Monotonie',
    text: 'Moyenne de la charge quotidienne divisée par son écart-type sur la semaine. Élevée, elle signale sept jours identiques, sans jour facile ni jour dur.',
  },
  chargeCombinee: {
    title: 'Charge combinée',
    text: 'Somme des charges course, vélo et musculation. Le cadran en affiche le ratio 7 j / 21 j, indisponible avant 28 jours de données.',
  },
  formeDuJour: {
    title: 'Forme du jour',
    text: 'Score de 0 à 100 calculé depuis le sommeil, les RPE récents, les sensations et le ratio de charge. Il suggère, il ne décide pas.',
  },
  projection: {
    title: 'Projection',
    text: 'Chrono estimé le jour de la course : forme du jour, gain du bloc restant, dénivelé et chaleur. Elle se lit toujours avec son intervalle.',
  },
  confiance: {
    title: 'Confiance',
    text: "Probabilité de tenir l'objectif, déduite de la projection et de son intervalle. Bornée à 2–98 % : aucune course n'est jouée d'avance.",
  },
  ecart: {
    title: 'Écart',
    text: "Différence entre la projection et l'objectif. Positif, la projection est plus lente que ce qui est visé.",
  },
  objectif: {
    title: 'Objectif',
    text: "Chrono visé sur la course. Tant qu'aucun test n'a recalé le VDOT, il reste à fixer.",
  },
  priorite: {
    title: 'Priorité',
    text: 'A : la course qui structure la saison, affûtage compris. B : courue en préparation. C : courue à l’entraînement.',
  },
  courseA: {
    title: 'Course A',
    text: 'La course qui structure la saison : les phases, le pic de volume et l’affûtage se calent sur sa date.',
  },
  adherence: {
    title: 'Adhérence',
    text: 'Part des séances prévues effectivement réalisées. Elle dit si le plan est tenable, pas s’il est bon.',
  },
  quota: {
    title: 'Quota',
    text: 'Part maximale du volume hebdomadaire qu’un type de séance peut prendre : VMA 8 %, seuil 10 %, sortie longue 30 %.',
  },
  semaineAllegee: {
    title: 'Semaine allégée',
    text: "Quatrième semaine d'un bloc, à environ −30 % de volume. C'est là que le travail accumulé se transforme en forme.",
  },
  specifique: {
    title: 'Spécifique',
    text: "Phase qui précède la course A : le volume plafonne et l'allure de course se travaille, notamment dans la sortie longue.",
  },
  affutage: {
    title: 'Affûtage',
    text: 'Deux dernières semaines avant la course A : le volume tombe à 70 % puis 50 %, l’intensité reste. La fatigue part, la forme monte.',
  },
  seanceCle: {
    title: 'Séance clé',
    text: "La séance qui porte l'objectif de la semaine. Deux clés au plus, jamais deux jours de suite.",
  },
  endurance: {
    title: 'Endurance',
    text: "Course à allure E, de 35 à 75 minutes. C'est le volume qui porte tout le reste du plan.",
  },
  sortieLongue: {
    title: 'Sortie longue',
    text: 'La plus longue course de la semaine, à allure facile et bornée à 30 % du volume. Elle construit la tenue de distance.',
  },
  seuil: {
    title: 'Seuil',
    text: 'Séance à allure T, en blocs ou en continu. Elle déplace le rythme qu’on peut tenir longtemps sans s’écrouler.',
  },
  vma: {
    title: 'VMA',
    text: 'Vitesse maximale aérobie, travaillée en fractionné court à allure I. Elle relève le plafond, sans lequel le seuil ne monte plus.',
  },
  cotes: {
    title: 'Côtes',
    text: 'Répétitions courtes en montée, prescrites en durée et en effort, jamais en allure. Elles font de la force sans traumatiser.',
  },
  progressif: {
    title: 'Progressif',
    text: "Course dont l'allure accélère par tiers, du facile au seuil. Elle apprend à finir plus vite qu'on a commencé.",
  },
  lignesDroites: {
    title: 'Lignes droites',
    text: "Accélérations relâchées de 100 m en fin d'endurance. Elles entretiennent la foulée sans peser sur la charge.",
  },
  test20: {
    title: 'Test 20′',
    text: 'Vingt minutes courues à fond, distance relevée. Elle donne le VDOT courant et régénère le plan.',
  },
  enduranceZ2: {
    title: 'Endurance Z2',
    text: 'Vélo à 56–75 % de la FTP, conversation possible. Elle ajoute du volume sans impact au sol.',
  },
  ftp: {
    title: 'FTP',
    text: 'Puissance qu’un cycliste tient une heure. Les zones vélo s’expriment en pourcentage de cette valeur.',
  },
  sweetSpot: {
    title: 'Sweet spot',
    text: "Vélo à 88–94 % de la FTP, juste sous le seuil. Posé seulement en remplacement d'un seuil course qu'une douleur interdit.",
  },
  forceBasseCadence: {
    title: 'Force basse cadence',
    text: 'Vélo en côte ou gros braquet à 50–60 tours par minute. Elle recrute les fibres de force sans impact au sol.',
  },
  phaseMuscu: {
    title: 'Phase muscu',
    text: 'Orientation de la musculation, dérivée de la phase du plan course : adaptation, force, force-puissance, entretien, légère, mobilité.',
  },
  superset: {
    title: 'Superset',
    text: 'Deux exercices enchaînés sans repos entre eux. Le repos se prend après la paire, pas au milieu.',
  },
  excentrique: {
    title: 'Excentrique',
    text: "Phase de la répétition où le muscle s'allonge sous charge, la descente. C'est elle qui protège des blessures, et qui courbature.",
  },
  prevention: {
    title: 'Bloc prévention',
    text: 'Exercices courts en rotation à la fin des séances chargées. Ils visent les zones qui lâchent en course, pas la performance.',
  },
  profilPhysique: {
    title: 'Profil physique',
    text: 'Point de départ déclaré : il pré-remplit volume, pic et nombre de courses, et borne la montée hebdomadaire à 5 ou 10 %.',
  },
  volumeDepart: {
    title: 'Volume de départ',
    text: 'Kilométrage de la première semaine pleine. Toute la progression du plan se compte à partir de lui.',
  },
  pic: {
    title: 'Pic de volume',
    text: 'Kilométrage hebdomadaire maximal du plan. Il est atteint en spécifique, jamais dépassé.',
  },
  coursesParSemaine: {
    title: 'Courses par semaine',
    text: 'Nombre de séances de course posées dans la semaine. Les jours disponibles disent où courir, celui-ci dit combien de fois.',
  },
  joursFaciles: {
    title: 'Jours faciles',
    text: 'Jours où aucune séance dure ne se pose, quoi qu’en dise la phase. Ils protègent la récupération et la vie hors course.',
  },
  sensations: {
    title: 'Sensations',
    text: 'Ce que la séance a laissé dans le corps, au-delà du chiffre de RPE. Elles pèsent pour un cinquième dans la forme du jour.',
  },
  sommeil: {
    title: 'Sommeil',
    text: 'Heures dormies la nuit précédente. C’est le premier facteur de la forme du jour, devant le RPE et les sensations.',
  },
  douleur: {
    title: 'Douleur',
    text: 'Zone et intensité sur 10. Au-delà de 2 sur une zone surveillée, le moteur propose immédiatement un allègement.',
  },
} as const satisfies Record<string, GlossaryEntry>

export type GlossaryTerm = keyof typeof GLOSSARY

/** Code de séance des bibliothèques → notion expliquée. Partiel : une séance au nom ordinaire n'en a pas. */
export const SESSION_TERMS = {
  EF: 'endurance',
  droites: 'lignesDroites',
  SL: 'sortieLongue',
  seuil: 'seuil',
  VMA: 'vma',
  allure_semi: 'allureSemi',
  cotes: 'cotes',
  progressif: 'progressif',
  test: 'test20',
  Z2: 'enduranceZ2',
  force_cadence: 'forceBasseCadence',
  sweet_spot: 'sweetSpot',
} as const satisfies Record<string, GlossaryTerm>

/** Zone d'allure course → notion expliquée. */
export const ZONE_TERMS = {
  easy: 'allureE',
  marathon: 'allureM',
  threshold: 'allureT',
  interval: 'allureI',
  repetition: 'allureR',
} as const satisfies Record<string, GlossaryTerm>

export function glossaryTermFor(
  map: Record<string, GlossaryTerm>,
  code: string,
): GlossaryTerm | undefined {
  return map[code]
}
