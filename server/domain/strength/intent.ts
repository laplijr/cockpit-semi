/**
 * Intention du renforcement (§ 5, P11.2). Push / Pull / Legs n'est pas « la
 * muscu » : c'est le programme d'un coureur qui veut aussi du haut du corps.
 * L'intention ne choisit que le catalogue de séances et la table par phase ;
 * doses, repos, contraintes et progressions sont écrits en termes
 * d'exercices et de `lowerBody`, et ne la connaissent pas.
 */
export enum StrengthIntent {
  Complete = 'complet',
  Running = 'course',
}

export const STRENGTH_INTENT_LABELS: Record<StrengthIntent, string> = {
  [StrengthIntent.Complete]: 'Complet, haut du corps inclus',
  [StrengthIntent.Running]: 'Pour la course',
}
