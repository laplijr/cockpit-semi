import Anthropic from '@anthropic-ai/sdk'

/**
 * Modèles par usage (§ 2). Ni traduire un texte libre en événements, ni lire
 * une page d'organisateur ne demandent le modèle le plus capable : Sonnet 5
 * les fait en quelques secondes là où Opus 5 en effort haut mettait deux
 * minutes sur la recherche de course. Les deux gardent l'outil web récent et
 * la sortie JSON stricte, que Haiku 4.5 ne sait pas prendre.
 */
export const LLM_MODEL = 'claude-sonnet-5'

let client: Anthropic | undefined

/**
 * Y a-t-il une clé ? Sans elle les fonctions qui parlent au modèle n'existent
 * pas : l'écran ne les propose pas et le cron ne les tente pas. Un bouton qui
 * ne peut que répondre 503 vaut moins qu'un bouton absent (§ 6).
 */
export function hasLlmKey(): boolean {
  return Boolean(useRuntimeConfig().anthropicApiKey)
}

/**
 * Client Claude, construit à la demande. La clé vient de `runtimeConfig`, donc
 * de `NUXT_ANTHROPIC_API_KEY` ; son absence est une erreur de configuration,
 * pas un cas fonctionnel : mieux vaut le dire que répondre à vide.
 */
export function useLlm(): Anthropic {
  if (client) return client

  if (!hasLlmKey()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Clé Anthropic absente : renseigne NUXT_ANTHROPIC_API_KEY.',
    })
  }

  client = new Anthropic({ apiKey: useRuntimeConfig().anthropicApiKey })
  return client
}

/**
 * Traduit les erreurs du SDK en erreurs lisibles à l'écran. Une panne du
 * modèle ne doit pas ressembler à une réponse vide (§ 6) : l'écran doit dire
 * ce qui ne va pas pour que la saisie manuelle prenne le relais en connaissance
 * de cause.
 */
export async function callLlm<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Clé Anthropic refusée : vérifie NUXT_ANTHROPIC_API_KEY.',
      })
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Modèle saturé, réessaie dans un instant.',
      })
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw createError({ statusCode: 503, statusMessage: 'Modèle injoignable.' })
    }
    if (error instanceof Anthropic.APIError) {
      /** Le détail n'a pas sa place à l'écran, mais il doit rester lisible côté serveur. */
      console.error('Appel au modèle refusé', error.status, error.message)
      throw createError({ statusCode: 502, statusMessage: `Erreur du modèle (${error.status}).` })
    }
    throw error
  }
}

/** Texte concaténé d'une réponse, blocs de pensée exclus. */
export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

/**
 * Une réponse refusée ou tronquée n'est pas une réponse : on le dit au lieu de
 * laisser un JSON vide traverser la validation (§ 6).
 */
export function assertUsable(message: Anthropic.Message): void {
  if (message.stop_reason === 'refusal') {
    throw createError({ statusCode: 422, statusMessage: 'Le modèle a refusé de répondre.' })
  }
  if (message.stop_reason === 'max_tokens') {
    throw createError({ statusCode: 502, statusMessage: 'Réponse du modèle tronquée.' })
  }
}
