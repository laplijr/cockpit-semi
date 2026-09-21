<script setup lang="ts">
/**
 * Le geste de publication (§ 8, P9.2). Il vit dans le dialog de la séance ou
 * de la course, en **action secondaire** : l'action principale de ces fenêtres
 * reste le retour de séance et l'enregistrement. On ne publie pas un texte, on
 * publie une séance faite — le mot est une légende, jamais un billet.
 */
import { MAX_NOTE_LENGTH, type PostSource } from '~~/server/domain/circle/post'

/** Valeur de l'énumération, écrite en clair dans le gabarit qui l'appelle. */
type Source = `${PostSource}`

const props = defineProps<{ source: Source; sourceId: number }>()

const athlete = useAthleteStore()
const note = ref('')
const error = ref('')

/** Rien à demander au cercle tant qu'on n'en est pas : la rangée n'existe pas. */
const { data, refresh } = useFetch<{ postId: number | null }>('/api/circle/posts', {
  query: { source: props.source, sourceId: props.sourceId },
  immediate: athlete.inCircle,
})

const published = computed(() => data.value?.postId ?? null)

async function publish() {
  error.value = ''
  try {
    await $fetch('/api/circle/posts', {
      method: 'POST',
      body: { source: props.source, sourceId: props.sourceId, note: note.value || null },
    })
    note.value = ''
    await refresh()
  } catch (cause) {
    error.value = (cause as { statusMessage?: string }).statusMessage ?? 'Publication refusée.'
    throw cause
  }
}

async function withdraw() {
  error.value = ''
  await $fetch(`/api/circle/posts/${published.value}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div v-if="athlete.inCircle" class="tile bg-surface-inset">
    <span class="label text-[10.5px]">Partager au cercle</span>

    <template v-if="published">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span class="flex items-center gap-2 text-[13px] text-ok">
          <UiAppIcon name="check" :size="15" />
          Publié au cercle
        </span>
        <UiActionButton class="btn btn-ghost ml-auto" :action="withdraw">
          Retirer la publication
        </UiActionButton>
      </div>
    </template>

    <template v-else>
      <div class="flex flex-col gap-2 lean:flex-row lean:items-center">
        <input
          v-model="note"
          class="input lean:flex-1"
          type="text"
          :maxlength="MAX_NOTE_LENGTH"
          placeholder="Un mot, si tu veux"
          aria-label="Un mot sur cette séance"
        />
        <UiActionButton
          class="btn btn-ghost self-stretch lean:self-auto"
          icon="people"
          :icon-size="15"
          :action="publish"
        >
          Publier
        </UiActionButton>
      </div>

      <!--
        Une fonctionnalité qui promet moins qu'elle ne semble doit le dire
        elle-même (P7.2). Celle-ci montre moins qu'on ne le craint : c'est à
        elle de le dire aussi.
      -->
      <p class="text-[12px] text-text-dim">
        Les autres verront la nature de la séance, sa distance, sa durée et votre mot. Ni le
        ressenti, ni la douleur, ni l’itinéraire.
      </p>
    </template>

    <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>
  </div>
</template>
