/** Types de phase d'un cycle d'entraînement (§ 4 et § 5). */
export enum PhaseType {
  Base = 'base',
  ShortBase = 'base_courte',
  Development = 'developpement',
  Specific = 'specifique',
  Speed = 'vitesse',
  Taper = 'affutage',
  Recovery = 'recup',
  Rebuild = 'relance',
  Transition = 'transition',
}
