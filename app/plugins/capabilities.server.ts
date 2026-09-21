/**
 * La clé du modèle reste au serveur ; l'écran n'en reçoit qu'un booléen, posé
 * au rendu et transporté par la charge utile. Sans lui, l'Imprévu, la
 * recherche de course et le plan de nutrition afficheraient des boutons qui ne
 * savent que répondre 503 (§ 6).
 */
export default defineNuxtPlugin(() => {
  useLlmAvailable().value = Boolean(useRuntimeConfig().anthropicApiKey)
})
