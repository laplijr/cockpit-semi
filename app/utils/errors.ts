/**
 * Message d'une erreur d'API, quand le serveur en donne un. Les pannes du
 * modèle disent ce qui ne va pas : l'écran ne doit pas les aplatir (§ 6).
 */
export function apiMessage(error: unknown, fallback: string): string {
  const message = (error as { data?: { statusMessage?: string }; statusMessage?: string })?.data
    ?.statusMessage
  return message ?? (error as { statusMessage?: string })?.statusMessage ?? fallback
}
