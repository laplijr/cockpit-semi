<script setup lang="ts">
/**
 * Ce que le cercle voit de cette séance (§ 8, P12). Ce n'est plus un geste :
 * une séance faite y va d'elle-même, le choix s'étant pris une fois en
 * entrant dans le cercle. Il reste une ligne d'état, et le retrait.
 */
import type { PostSource } from '~~/server/domain/circle/post'

/** Valeur de l'énumération, écrite en clair dans le gabarit qui l'appelle. */
type Source = `${PostSource}`

const props = defineProps<{ source: Source; sourceId: number }>()

const athlete = useAthleteStore()
const error = ref('')

/** Rien à dire du cercle tant qu'on n'en est pas : la rangée n'existe pas. */
const { data, refresh } = useFetch<{ postId: number | null; viewers: number }>(
  '/api/circle/posts',
  {
    query: { source: props.source, sourceId: props.sourceId },
    immediate: athlete.inCircle,
  },
)

const published = computed(() => data.value?.postId ?? null)
const viewers = computed(() => data.value?.viewers ?? 0)

/** Un cercle d'une seule personne ne se compte pas : il se dit. */
const audience = computed(() =>
  viewers.value === 0
    ? 'personne d’autre pour l’instant'
    : `${viewers.value} personne${viewers.value > 1 ? 's' : ''}`,
)

async function hide() {
  error.value = ''
  await $fetch(`/api/circle/posts/${published.value}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div v-if="athlete.inCircle && published" class="tile bg-surface-inset">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span class="flex items-center gap-2 text-body">
        <UiAppIcon name="people" :size="15" class="text-text-dim" />
        Vue par le cercle
        <span class="text-text-dim">· {{ audience }}</span>
      </span>
      <UiActionButton class="btn btn-ghost ml-auto" :action="hide">Masquer</UiActionButton>
    </div>

    <!--
      Une fonctionnalité qui montre moins qu'on ne le craint doit le dire
      elle-même (P7.2) : ce qui traverse le mur, et ce qui ne le traverse pas.
    -->
    <p class="text-meta text-text-dim">
      Les autres voient la nature de la séance, sa distance et sa durée. Ni le ressenti, ni la
      douleur, ni l'itinéraire.
    </p>

    <p v-if="error" class="text-body text-warn">{{ error }}</p>
  </div>
</template>
