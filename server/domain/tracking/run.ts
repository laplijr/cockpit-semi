/**
 * Vie d'une sortie capturée dans l'app (§ 9, P10). Une sortie en cours est
 * reprise telle quelle à la réouverture ; une sortie abandonnée n'écrit ni
 * activité ni charge — c'est la seule issue qui ne laisse rien.
 */
export enum RunStatus {
  Live = 'en_cours',
  Finished = 'terminee',
  Abandoned = 'abandonnee',
}
