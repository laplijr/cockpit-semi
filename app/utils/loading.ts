type RequestStatus = 'idle' | 'pending' | 'success' | 'error'

/**
 * Une tuile porte son squelette tant que sa requête n'a pas répondu (§ 8). Une
 * requête en erreur n'est plus en chargement : la tuile montre alors son état
 * vide, pas un squelette qui ne se remplira jamais.
 */
export function isLoading(status: RequestStatus): boolean {
  return status === 'idle' || status === 'pending'
}
