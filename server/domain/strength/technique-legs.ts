import { StrengthMuscle as M, type ExerciseTechnique } from './muscles'

/** Les fiches du groupe Jambes (P25). */
export const LEGS_TECHNIQUE: Record<string, ExerciseTechnique> = {
  squat: {
    cues: [
      'Barre posée sur le haut du dos, pieds à largeur d’épaules, pointes légèrement ouvertes.',
      'Inspire, gaine le ventre, puis descends en deux secondes en poussant les genoux dans l’axe des pieds.',
      'Descends jusqu’à ce que le haut des cuisses passe l’horizontale, dos plat.',
      'Remonte le plus vite possible en poussant le sol, sans rebondir en bas.',
    ],
    mistakes: [
      'Les genoux qui rentrent vers l’intérieur en remontant.',
      'Le dos qui s’arrondit en bas de la descente.',
    ],
    primary: [M.Quadriceps, M.Glutes],
    secondary: [M.Adductors, M.LowerBack, M.Abdominals],
  },
  'goblet-squat': {
    cues: [
      'Haltère ou kettlebell tenu contre la poitrine, coudes sous la charge.',
      'Pieds à largeur d’épaules, descends entre tes talons en gardant le buste droit.',
      'Les coudes passent à l’intérieur des genoux en bas.',
      'Remonte en poussant le sol, talons au sol.',
    ],
    mistakes: [
      'Les talons qui décollent en bas.',
      'Le buste qui plonge vers l’avant et laisse tomber la charge.',
    ],
    primary: [M.Quadriceps, M.Glutes],
    secondary: [M.Adductors, M.Abdominals],
  },
  'sdt-roumain': {
    cues: [
      'Debout, barre contre les cuisses, genoux à peine fléchis.',
      'Recule les fesses en trois secondes, la barre glisse le long des cuisses.',
      'Descends jusqu’à sentir l’étirement derrière les cuisses, dos plat, sous les genoux au plus.',
      'Remonte en poussant les hanches vers l’avant, sans cambrer en haut.',
    ],
    mistakes: ['Le dos qui s’arrondit pour aller plus bas.', 'La barre qui s’éloigne des jambes.'],
    primary: [M.Hamstrings, M.Glutes],
    secondary: [M.LowerBack, M.Forearms],
  },
  'fente-bulgare': {
    cues: [
      'Pied arrière posé sur un banc, pied avant assez loin pour que le genou reste au-dessus de la cheville.',
      'Descends à la verticale, le genou arrière vers le sol.',
      'Le poids reste sur le talon avant, buste légèrement penché.',
      'Remonte en poussant sur la jambe avant, puis change de côté.',
    ],
    mistakes: [
      'Le genou avant qui part vers l’intérieur.',
      'La poussée qui vient de la jambe arrière.',
    ],
    primary: [M.Quadriceps, M.Glutes],
    secondary: [M.GluteMedius, M.Adductors],
  },
  'mollet-unipodal': {
    cues: [
      'Sur une jambe, l’avant du pied sur une marche, genou tendu, une main au mur.',
      'Pars sur la pointe, le plus haut possible.',
      'Descends en trois secondes, le talon sous le niveau de la marche.',
      'Tiens une seconde en bas, étiré, puis remonte en deux secondes.',
    ],
    mistakes: [
      'Rebondir en bas au lieu de contrôler la descente.',
      'Plier le genou : c’est alors le soléaire qui travaille.',
    ],
    primary: [M.Calves],
    secondary: [M.Soleus, M.Foot],
  },
  'mollet-soleaire': {
    cues: [
      'Sur une jambe, l’avant du pied sur une marche, genou fléchi d’un quart.',
      'Garde cet angle de genou pendant toute la série.',
      'Monte sur la pointe, puis redescends lentement sous le niveau de la marche.',
      'Alterne les jambes : le repos d’un côté se prend pendant que l’autre travaille.',
    ],
    mistakes: ['Tendre le genou en montant.', 'Aller vite et perdre l’amplitude.'],
    primary: [M.Soleus],
    secondary: [M.Calves, M.Foot],
  },
  nordic: {
    cues: [
      'À genoux sur un coussin, chevilles bloquées sous un meuble ou par un partenaire.',
      'Corps droit des genoux à la tête, fesses serrées.',
      'Bascule vers l’avant le plus lentement possible en freinant avec l’arrière des cuisses.',
      'Rattrape-toi sur les mains et repousse-toi pour revenir.',
    ],
    mistakes: [
      'Plier les hanches pour se retenir.',
      'Se laisser tomber au lieu de freiner la chute.',
    ],
    primary: [M.Hamstrings],
    secondary: [M.Glutes, M.Calves],
  },
  pliometrie: {
    cues: [
      'Commence par les pogos : petits rebonds sur place, chevilles raides, genoux presque tendus.',
      'Le contact au sol est le plus court possible, sur l’avant du pied.',
      'Enchaîne les sauts : saute haut, atterris souple et repars aussitôt.',
      'Sur un sol dur, à froid en début de séance, jamais en fatigue.',
    ],
    mistakes: [
      'Atterrir talons au sol, genoux qui s’écrasent.',
      'Chercher la hauteur en allongeant le temps de contact.',
    ],
    primary: [M.Calves, M.Quadriceps],
    secondary: [M.Glutes, M.Soleus],
  },
  'saut-unipodal': {
    cues: [
      'Sur une jambe, genou légèrement fléchi, bras prêts.',
      'Saute vers le haut en poussant sur l’avant du pied et en lançant les bras.',
      'Atterris sur la même jambe, genou dans l’axe du pied.',
      'Stabilise une seconde avant le saut suivant, puis change de côté.',
    ],
    mistakes: ['Le genou qui rentre à l’atterrissage.', 'Enchaîner sans être stable.'],
    primary: [M.Calves, M.Quadriceps],
    secondary: [M.GluteMedius, M.Glutes],
  },
  'hip-thrust': {
    cues: [
      'Haut du dos appuyé sur un banc, barre sur le pli des hanches, pieds à plat.',
      'Rentre le menton et garde les côtes basses.',
      'Pousse les hanches vers le haut jusqu’à l’alignement épaules-hanches-genoux.',
      'Serre les fessiers une seconde en haut, puis redescends sans poser.',
    ],
    mistakes: [
      'Cambrer le bas du dos au lieu de monter les hanches.',
      'Les pieds trop loin : ce sont les ischios qui prennent le relais.',
    ],
    primary: [M.Glutes],
    secondary: [M.Hamstrings, M.Quadriceps],
  },
  'pont-fessier': {
    cues: [
      'Allongé sur le dos, genoux pliés, pieds à plat à largeur de hanches.',
      'Rentre légèrement le bassin, ventre gainé.',
      'Monte les hanches jusqu’à l’alignement épaules-hanches-genoux.',
      'Tiens une seconde en serrant les fessiers, puis redescends lentement.',
    ],
    mistakes: [
      'Cambrer en haut au lieu de serrer les fessiers.',
      'Pousser sur la pointe des pieds.',
    ],
    primary: [M.Glutes],
    secondary: [M.Hamstrings, M.Abdominals],
  },
  'mollet-bipodal': {
    cues: [
      'Debout sur les deux pieds, à plat ou l’avant du pied sur une marche.',
      'Monte sur la pointe des pieds, le poids sur le gros orteil.',
      'Tiens une seconde en haut.',
      'Redescends lentement.',
    ],
    mistakes: ['Laisser les chevilles partir vers l’extérieur.', 'Rebondir en bas.'],
    primary: [M.Calves],
    secondary: [M.Soleus, M.Foot],
  },
  'sdt-halteres': {
    cues: [
      'Debout, un haltère dans chaque main devant les cuisses, genoux à peine fléchis.',
      'Recule les fesses en trois secondes, les haltères glissent le long des jambes.',
      'Descends jusqu’à l’étirement derrière les cuisses, dos plat.',
      'Remonte en poussant les hanches vers l’avant.',
    ],
    mistakes: ['Le dos qui s’arrondit.', 'Les haltères qui partent vers l’avant.'],
    primary: [M.Hamstrings, M.Glutes],
    secondary: [M.LowerBack, M.Forearms],
  },
  'sdt-unipodal': {
    cues: [
      'Debout sur une jambe, genou d’appui à peine fléchi.',
      'Bascule le buste en trois secondes pendant que la jambe libre part en arrière.',
      'Le bassin reste face au sol, la jambe libre dans le prolongement du dos.',
      'Remonte en poussant la hanche d’appui vers l’avant, puis change de côté.',
    ],
    mistakes: [
      'Le bassin qui s’ouvre sur le côté de la jambe libre.',
      'Plier le genou d’appui pour descendre plus bas.',
    ],
    primary: [M.Hamstrings, M.Glutes],
    secondary: [M.GluteMedius, M.Foot],
  },
  'pont-fessier-leste': {
    cues: [
      'Allongé sur le dos, genoux pliés, un haltère ou un sac posé sur le bassin.',
      'Tiens la charge des deux mains, ventre gainé.',
      'Monte les hanches jusqu’à l’alignement épaules-hanches-genoux.',
      'Serre une seconde en haut, puis redescends sans poser.',
    ],
    mistakes: ['Cambrer en haut.', 'Laisser la charge rouler vers le ventre.'],
    primary: [M.Glutes],
    secondary: [M.Hamstrings, M.Abdominals],
  },
  'pont-fessier-unipodal': {
    cues: [
      'Allongé sur le dos, un pied à plat, l’autre jambe tendue en l’air.',
      'Monte les hanches en poussant sur le talon d’appui.',
      'Le bassin reste horizontal, les deux hanches à la même hauteur.',
      'Redescends lentement, puis change de côté.',
    ],
    mistakes: [
      'Le bassin qui bascule du côté de la jambe libre.',
      'Cambrer au lieu de monter les hanches.',
    ],
    primary: [M.Glutes],
    secondary: [M.Hamstrings, M.GluteMedius],
  },
}
