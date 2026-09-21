/**
 * Les clés restent au serveur ; l'écran n'en reçoit que des booléens, posés au
 * rendu et transportés par la charge utile. Sans eux, l'Imprévu, la recherche
 * de course, le plan de nutrition et les itinéraires afficheraient des boutons
 * qui ne savent que répondre 503 (§ 6, § 9).
 */
export default defineNuxtPlugin(() => {
  const { anthropicApiKey, orsApiKey } = useRuntimeConfig()
  useLlmAvailable().value = Boolean(anthropicApiKey)
  useRoutingAvailable().value = Boolean(orsApiKey)
})
