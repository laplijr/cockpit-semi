<script setup lang="ts">
import { SessionStatus } from '~~/server/domain/plan/session'

/**
 * Rien à l'écran : ce composant n'existe que pour rapprocher l'état du plan
 * et des propositions de la règle de rappel (§ 9, P7.2). Le cockpit montre
 * déjà tout cela ; le rappel ne sert qu'à celui qui a laissé l'onglet ouvert
 * sans y revenir.
 */
const plan = usePlanStore()
const proposals = usePropositionsStore()
const notices = useBrowserNotices()

const DONE = [SessionStatus.Done, SessionStatus.Modified] as string[]

/** Rien n'est chargé pour les rappels seuls : ils lisent ce qui est déjà là. */
const ready = computed(
  () => notices.enabled.value && plan.loaded && plan.today !== '' && proposals.loaded,
)

watch(
  ready,
  (loaded) => {
    if (!loaded) return

    notices.check({
      today: plan.today,
      sessions: (plan.plan?.sessions ?? []).map((session) => ({
        date: session.date,
        done: DONE.includes(session.status),
        hasFeedback: session.feedbackRpe !== null,
      })),
      pendingProposals: proposals.pendingCount,
    })
  },
  { immediate: true },
)
</script>

<template><span class="hidden" /></template>
