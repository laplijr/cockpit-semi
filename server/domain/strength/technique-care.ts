import { StrengthMuscle as M, type ExerciseTechnique } from './muscles'

/** Les fiches des groupes Prévention et Mobilité (P25). */
export const CARE_TECHNIQUE: Record<string, ExerciseTechnique> = {
  'monster-walk': {
    cues: [
      'Élastique autour des chevilles ou au-dessus des genoux.',
      'Genoux fléchis, fesses en arrière, pieds à largeur de hanches.',
      'Avance en diagonale à petits pas, l’élastique toujours tendu.',
      'Fais les pas prescrits, puis repars dans l’autre sens.',
    ],
    mistakes: ['Les genoux qui rentrent à chaque pas.', 'Se redresser et relâcher la tension.'],
    primary: [M.GluteMedius],
    secondary: [M.Glutes, M.Quadriceps],
  },
  'squat-espagnol': {
    cues: [
      'Sangle ou élastique épais derrière les genoux, ancré au rack à hauteur de genoux.',
      'Recule jusqu’à tendre la sangle, pieds à largeur de hanches.',
      'Descends, tibias verticaux, jusqu’à 60 à 90° de flexion des genoux, buste droit.',
      'Tiens la durée prescrite, en poussant les genoux contre la sangle.',
    ],
    mistakes: ['Laisser les genoux avancer au-dessus des pieds.', 'Tenir en apnée.'],
    primary: [M.Quadriceps],
    secondary: [M.Glutes],
  },
  'fente-basse': {
    cues: [
      'Un genou au sol, l’autre pied à plat devant, genou au-dessus de la cheville.',
      'Serre la fesse de la jambe arrière et avance le bassin.',
      'Tiens l’étirement à l’avant de la hanche arrière.',
      'Relève le genou avant vers la poitrine, puis reviens et change de côté.',
    ],
    mistakes: [
      'Cambrer le bas du dos au lieu d’avancer le bassin.',
      'Le genou avant qui dépasse loin devant le pied.',
    ],
    primary: [M.HipFlexors],
    secondary: [M.Glutes, M.Quadriceps],
  },
  copenhagen: {
    cues: [
      'Sur le côté, coude sous l’épaule, genou du dessus posé sur un banc.',
      'La jambe du dessous est libre sous le banc.',
      'Monte les hanches jusqu’à l’alignement épaules-hanches-genou.',
      'Tiens la durée prescrite, puis change de côté.',
    ],
    mistakes: ['Les hanches qui s’affaissent.', 'Le bassin qui part vers l’arrière.'],
    primary: [M.Adductors],
    secondary: [M.Obliques],
  },
  'fente-laterale': {
    cues: [
      'Debout, pieds joints, mains devant la poitrine.',
      'Fais un grand pas de côté et plie cette jambe, l’autre reste tendue.',
      'Fesses en arrière, pied à plat, genou dans l’axe du pied.',
      'Repousse pour revenir au centre, puis change de côté.',
    ],
    mistakes: ['Le genou fléchi qui rentre.', 'Le talon qui décolle.'],
    primary: [M.GluteMedius, M.Adductors],
    secondary: [M.Quadriceps, M.Glutes],
  },
  'squat-espagnol-sangle': {
    cues: [
      'Sangle passée derrière les genoux et ancrée bas, à un poteau ou une porte.',
      'Recule jusqu’à tendre la sangle, pieds à largeur de hanches.',
      'Descends, tibias verticaux, jusqu’à 60 à 90° de flexion des genoux.',
      'Tiens la durée prescrite en poussant les genoux contre la sangle.',
    ],
    mistakes: [
      'Les genoux qui avancent au-dessus des pieds.',
      'Un ancrage qui glisse pendant la tenue.',
    ],
    primary: [M.Quadriceps],
    secondary: [M.Glutes],
  },
  'wall-sit': {
    cues: [
      'Dos plaqué contre un mur, pieds à deux pas devant.',
      'Glisse jusqu’à avoir les cuisses à l’horizontale, genoux au-dessus des chevilles.',
      'Bras relâchés, respiration calme.',
      'Tiens la durée prescrite, puis remonte en glissant.',
    ],
    mistakes: [
      'Les pieds trop près : les genoux passent devant les orteils.',
      'Pousser avec les mains sur les cuisses.',
    ],
    primary: [M.Quadriceps],
    secondary: [M.Glutes],
  },
  'genou-au-mur': {
    cues: [
      'Face au mur, en fente, l’avant du pied à quelques centimètres du mur.',
      'Pousse le genou vers le mur, talon collé au sol.',
      'Le genou reste dans l’axe du deuxième orteil.',
      'Recule le pied d’un centimètre quand le genou touche facilement, puis change de côté.',
    ],
    mistakes: ['Le talon qui décolle.', 'Le genou qui part vers l’intérieur.'],
    primary: [M.Soleus, M.Calves],
    secondary: [M.Foot],
  },
  'short-foot': {
    cues: [
      'Assis ou debout, pied à plat, orteils détendus.',
      'Rapproche la base du gros orteil du talon sans plier les orteils : la voûte se creuse.',
      'Tiens la durée prescrite.',
      'Toe yoga : lève le gros orteil seul, puis les quatre autres seuls.',
    ],
    mistakes: ['Crisper les orteils vers le sol.', 'Rouler le pied vers l’extérieur.'],
    primary: [M.Foot],
    secondary: [M.Calves],
  },
  'etirement-psoas': {
    cues: [
      'Un genou au sol, l’autre pied devant, buste droit.',
      'Serre la fesse de la jambe arrière pour basculer le bassin vers l’arrière.',
      'Avance légèrement le bassin jusqu’à l’étirement à l’avant de la hanche.',
      'Tiens la durée prescrite, bras du côté étiré tendu vers le haut, puis change de côté.',
    ],
    mistakes: [
      'Cambrer au lieu de basculer le bassin.',
      'Avancer trop loin et perdre la fesse serrée.',
    ],
    primary: [M.HipFlexors],
    secondary: [M.Quadriceps],
  },
  'mobilite-thoracique': {
    cues: [
      'À quatre pattes, une main derrière la tête.',
      'Descends le coude vers le bras d’appui.',
      'Ouvre le coude vers le plafond en suivant du regard.',
      'Le bassin ne bouge pas, puis change de côté.',
    ],
    mistakes: ['Tourner le bassin au lieu du haut du dos.', 'Aller vite sans amplitude.'],
    primary: [M.UpperBack],
    secondary: [M.Obliques],
  },
  respiration: {
    cues: [
      'Allongé sur le dos, genoux pliés, une main sur le ventre, l’autre sur la poitrine.',
      'Inspire par le nez en gonflant le ventre, la poitrine ne bouge pas.',
      'Expire lentement par la bouche, deux fois plus longtemps.',
      'Continue trois minutes.',
    ],
    mistakes: ['Monter les épaules en inspirant.', 'Forcer l’inspiration.'],
    primary: [M.Diaphragm],
    secondary: [M.Abdominals],
  },
}
