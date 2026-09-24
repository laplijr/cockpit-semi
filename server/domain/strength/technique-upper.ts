import { StrengthMuscle as M, type ExerciseTechnique } from './muscles'

/** Les fiches des groupes Poussée, Tirage et Tronc (P25). */
export const UPPER_TECHNIQUE: Record<string, ExerciseTechnique> = {
  'developpe-couche': {
    cues: [
      'Allongé sur le banc, yeux sous la barre, pieds à plat au sol.',
      'Serre les omoplates et garde-les serrées toute la série.',
      'Descends la barre en contrôle jusqu’au bas des pectoraux, coudes à 45° du corps.',
      'Pousse la barre vers le haut et légèrement vers la tête.',
    ],
    mistakes: [
      'Les coudes écartés à 90°, qui chargent l’épaule.',
      'Faire rebondir la barre sur la poitrine.',
    ],
    primary: [M.Chest, M.Triceps],
    secondary: [M.Shoulders],
  },
  'developpe-militaire': {
    cues: [
      'Debout ou assis, un haltère dans chaque main à hauteur d’épaules.',
      'Gaine le ventre et serre les fessiers : le dos ne se cambre pas.',
      'Pousse les haltères au-dessus de la tête jusqu’à bras tendus.',
      'Redescends en contrôle à hauteur d’épaules.',
    ],
    mistakes: ['Cambrer le bas du dos pour finir la poussée.', 'Descendre les haltères à moitié.'],
    primary: [M.Shoulders, M.Triceps],
    secondary: [M.UpperBack, M.Abdominals],
  },
  dips: {
    cues: [
      'Mains sur les barres parallèles, bras tendus, épaules basses.',
      'Descends en pliant les coudes vers l’arrière, buste légèrement penché.',
      'Arrête quand les épaules passent au niveau des coudes.',
      'Remonte jusqu’à bras tendus sans hausser les épaules.',
    ],
    mistakes: [
      'Descendre trop bas, épaules en avant.',
      'Les épaules qui montent vers les oreilles.',
    ],
    primary: [M.Chest, M.Triceps],
    secondary: [M.Shoulders],
  },
  'developpe-halteres': {
    cues: [
      'Allongé au sol ou sur un banc, un haltère dans chaque main au-dessus de la poitrine.',
      'Omoplates serrées, pieds à plat.',
      'Descends les haltères sur les côtés de la poitrine, coudes à 45° du corps.',
      'Pousse vers le haut en rapprochant les haltères.',
    ],
    mistakes: ['Les coudes écartés à 90°.', 'Les haltères qui partent vers le visage.'],
    primary: [M.Chest, M.Triceps],
    secondary: [M.Shoulders],
  },
  pompes: {
    cues: [
      'Mains un peu plus larges que les épaules, corps droit des talons à la tête.',
      'Serre les fessiers et gaine le ventre.',
      'Descends la poitrine jusqu’à frôler le sol, coudes à 45° du corps.',
      'Repousse le sol jusqu’à bras tendus, le corps d’un bloc.',
    ],
    mistakes: ['Le bassin qui s’affaisse ou qui monte.', 'Les coudes écartés à 90°.'],
    primary: [M.Chest, M.Triceps],
    secondary: [M.Shoulders, M.Abdominals],
  },
  tractions: {
    cues: [
      'Suspendu à la barre, mains un peu plus larges que les épaules, paumes vers l’avant.',
      'Descends les épaules loin des oreilles avant de tirer.',
      'Tire les coudes vers les hanches jusqu’à passer le menton au-dessus de la barre.',
      'Redescends en contrôle jusqu’à bras tendus.',
    ],
    mistakes: ['Balancer les jambes pour s’aider.', 'S’arrêter à mi-course en bas.'],
    primary: [M.Lats, M.Biceps],
    secondary: [M.UpperBack, M.Forearms],
  },
  rowing: {
    cues: [
      'Un genou et une main sur un banc, dos plat et parallèle au sol.',
      'L’haltère pend sous l’épaule, bras tendu.',
      'Tire le coude vers la hanche, en serrant l’omoplate.',
      'Redescends en contrôle, sans tourner le buste, puis change de côté.',
    ],
    mistakes: [
      'Tourner le buste pour monter la charge.',
      'Tirer avec le bras plutôt qu’avec le dos, coude qui part vers l’extérieur.',
    ],
    primary: [M.Lats, M.UpperBack],
    secondary: [M.Biceps, M.RearShoulders],
  },
  'face-pull': {
    cues: [
      'Élastique ancré à hauteur des yeux, une extrémité dans chaque main.',
      'Recule jusqu’à tendre l’élastique, bras tendus devant toi.',
      'Tire les mains vers le visage en écartant les coudes haut.',
      'Finis pouces vers l’arrière, omoplates serrées, puis relâche lentement.',
    ],
    mistakes: ['Tirer vers la poitrine, coudes bas.', 'Cambrer le dos pour reculer.'],
    primary: [M.RearShoulders, M.RotatorCuff],
    secondary: [M.UpperBack],
  },
  'farmer-walk': {
    cues: [
      'Une charge lourde dans chaque main, bras le long du corps.',
      'Grandis-toi, épaules basses, ventre gainé.',
      'Marche à petits pas réguliers, sans balancer les charges.',
      'Tiens la durée prescrite, puis pose en pliant les jambes.',
    ],
    mistakes: ['Pencher d’un côté ou se tasser.', 'Hausser les épaules sous la charge.'],
    primary: [M.Forearms, M.UpperBack],
    secondary: [M.Abdominals, M.Obliques],
  },
  'rowing-elastique': {
    cues: [
      'Élastique ancré à hauteur de poitrine, une extrémité dans chaque main.',
      'Recule jusqu’à tendre l’élastique, genoux souples, buste droit.',
      'Tire les coudes vers l’arrière le long du corps en serrant les omoplates.',
      'Relâche lentement jusqu’à bras tendus.',
    ],
    mistakes: ['Tirer en reculant le buste.', 'Hausser les épaules.'],
    primary: [M.Lats, M.UpperBack],
    secondary: [M.Biceps, M.RearShoulders],
  },
  'rowing-australien': {
    cues: [
      'Allongé sous une table solide ou une barre basse, mains sur le bord.',
      'Corps droit des talons à la tête, talons au sol.',
      'Tire la poitrine vers la table en serrant les omoplates.',
      'Redescends en contrôle jusqu’à bras tendus.',
    ],
    mistakes: ['Le bassin qui tombe.', 'Tirer le menton vers la table au lieu de la poitrine.'],
    primary: [M.Lats, M.UpperBack],
    secondary: [M.Biceps, M.Abdominals],
  },
  'ytw-sol': {
    cues: [
      'À plat ventre, front sur une serviette, bras devant.',
      'Y : bras tendus en V, pouces vers le haut, décolle les bras du sol.',
      'T : bras écartés en croix, décolle-les en serrant les omoplates.',
      'W : coudes pliés le long du corps, tire-les vers les hanches.',
    ],
    mistakes: ['Soulever la tête et cambrer.', 'Monter les épaules vers les oreilles.'],
    primary: [M.UpperBack, M.RearShoulders],
    secondary: [M.RotatorCuff],
  },
  pallof: {
    cues: [
      'Debout de profil à la poulie réglée à hauteur de poitrine, poignée à deux mains contre le sternum.',
      'Pieds à largeur de hanches, genoux souples, ventre gainé.',
      'Pousse les mains droit devant toi sans laisser le buste tourner.',
      'Tiens deux secondes, ramène, puis change de côté.',
    ],
    mistakes: ['Laisser le buste pivoter vers la poulie.', 'Pousser en retenant sa respiration.'],
    primary: [M.Obliques, M.Abdominals],
    secondary: [M.GluteMedius],
  },
  'planche-laterale': {
    cues: [
      'Sur le côté, coude sous l’épaule, jambes tendues et pieds empilés.',
      'Monte les hanches jusqu’à l’alignement chevilles-hanches-épaules.',
      'Tiens la durée prescrite, sans laisser le bassin descendre.',
      'Change de côté.',
    ],
    mistakes: ['Les hanches qui s’affaissent.', 'Le bassin qui part vers l’arrière.'],
    primary: [M.Obliques, M.GluteMedius],
    secondary: [M.Abdominals, M.Shoulders],
  },
  'dead-bug': {
    cues: [
      'Sur le dos, bras tendus vers le plafond, hanches et genoux à 90°.',
      'Plaque le bas du dos au sol et garde-le plaqué.',
      'Allonge un bras derrière la tête et la jambe opposée, sans toucher le sol.',
      'Reviens, puis fais l’autre côté.',
    ],
    mistakes: ['Le bas du dos qui se décolle.', 'Aller vite en perdant le contrôle.'],
    primary: [M.Abdominals],
    secondary: [M.Obliques, M.HipFlexors],
  },
  'pallof-elastique': {
    cues: [
      'Élastique ancré à hauteur de poitrine, de profil, les deux mains contre le sternum.',
      'Pieds à largeur de hanches, ventre gainé.',
      'Pousse les mains droit devant toi sans laisser le buste tourner.',
      'Tiens deux secondes, ramène, puis change de côté.',
    ],
    mistakes: [
      'Le buste qui pivote vers l’ancrage.',
      'Trop près de l’ancrage : l’élastique ne tire plus.',
    ],
    primary: [M.Obliques, M.Abdominals],
    secondary: [M.GluteMedius],
  },
}
