<script setup lang="ts">
/**
 * Le dixième objet de fenêtre (§ 8, P9) : une publication entière, ses bravos
 * nommés, ses commentaires, et le champ pour en écrire un. On réagit depuis la
 * tuile, on commente ici — un clic n'empile jamais deux surfaces.
 */
import { MAX_COMMENT_LENGTH } from '~~/server/domain/circle/post'
import type { CircleIdentityView, CirclePostView } from '~/stores/circle'

const props = defineProps<{ postId: number }>()
const emit = defineEmits<{ changed: [] }>()

const circle = useCircleStore()
const ui = useUiStore()

interface Comment {
  id: number
  athleteId: number
  text: string
  createdAt: string
  removable: boolean
}

interface Detail {
  me: number
  post: CirclePostView
  author: CircleIdentityView | null
  comments: Comment[]
  authors: CircleIdentityView[]
}

const { data, refresh } = await useFetch<Detail>(() => `/api/circle/posts/${props.postId}`)

const text = ref('')
const error = ref('')

const authorsById = computed(() => new Map((data.value?.authors ?? []).map((one) => [one.id, one])))

const bravoText = computed(() => {
  const names = (data.value?.post.bravos ?? []).map((one) => one.firstName ?? 'Quelqu’un')
  if (names.length === 0) return 'Personne n’a encore dit bravo.'
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} et ${names.at(-1)}`
  return `${list} ${names.length === 1 ? 'a' : 'ont'} dit bravo`
})

const pace = computed(() => {
  const post = data.value?.post
  if (!post?.distanceM || !post.durationMin || post.sport !== 'course') return null
  return (post.durationMin * 60) / (post.distanceM / 1000)
})

const mine = computed(() => data.value?.post.athleteId === data.value?.me)

async function toggleBravo() {
  await circle.toggleBravo(props.postId)
  await refresh()
}

async function comment() {
  error.value = ''
  try {
    await $fetch(`/api/circle/posts/${props.postId}/comments`, {
      method: 'POST',
      body: { text: text.value },
    })
    text.value = ''
    await refresh()
    emit('changed')
  } catch (cause) {
    error.value = apiMessage(cause, 'Commentaire refusé.')
  }
}

async function removeComment(id: number) {
  await $fetch(`/api/circle/comments/${id}`, { method: 'DELETE' })
  await refresh()
  emit('changed')
}

async function withdraw() {
  await $fetch(`/api/circle/posts/${props.postId}`, { method: 'DELETE' })
  ui.closeModal()
  emit('changed')
}
</script>

<template>
  <div v-if="data" class="flex flex-col gap-4">
    <div class="tile bg-surface-inset">
      <div class="flex items-center gap-[10px]">
        <UiAvatar :first-name="data.author?.firstName" :avatar="data.author?.avatar" :size="32" />
        <span class="flex flex-col leading-[1.25]">
          <span class="text-[14px] font-semibold">{{ data.author?.firstName ?? 'Quelqu’un' }}</span>
          <span class="mono text-[11.5px] text-text-dim">{{ formatDate(data.post.date) }}</span>
        </span>
        <span class="pill ml-auto" :class="data.post.source === 'course' ? 'pill-race' : ''">
          {{
            data.post.source === 'course'
              ? 'Course'
              : (SESSION_LABELS[data.post.code ?? ''] ?? 'Séance')
          }}
        </span>
      </div>

      <span v-if="data.post.label" class="display text-[20px] font-semibold">
        {{ data.post.label }}
      </span>

      <div class="fold-3 grid gap-3">
        <span v-if="data.post.distanceM" class="flex flex-col gap-[3px]">
          <span class="label text-[10.5px]">Distance</span>
          <span class="mono text-[20px]">{{ formatDistance(data.post.distanceM) }}</span>
        </span>
        <span class="flex flex-col gap-[3px]">
          <span class="label text-[10.5px]">Durée</span>
          <span class="mono text-[20px]">{{ formatMinutes(data.post.durationMin) }}</span>
        </span>
        <span v-if="pace" class="flex flex-col gap-[3px]">
          <span class="label text-[10.5px]">Allure</span>
          <span class="mono text-[20px]">
            {{ formatPace(pace) }}<span class="text-[13px] text-text-dim">/km</span>
          </span>
        </span>
      </div>

      <p v-if="data.post.note" class="text-[14px]">« {{ data.post.note }} »</p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <UiActionButton
        class="btn btn-ghost"
        :class="data.post.mine ? 'border-accent-deep bg-accent-track text-accent' : ''"
        icon="bravo"
        :icon-size="15"
        :action="toggleBravo"
      >
        Bravo
      </UiActionButton>
      <span class="text-[13px] text-text-dim">{{ bravoText }}</span>
    </div>

    <div class="tile bg-surface-inset">
      <span class="label text-[10.5px]">Commentaires</span>

      <p v-if="data.comments.length === 0" class="text-[13px] text-text-dim">
        Aucun commentaire pour l'instant.
      </p>

      <div v-for="item in data.comments" :key="item.id" class="flex gap-[10px]">
        <UiAvatar
          :first-name="authorsById.get(item.athleteId)?.firstName"
          :avatar="authorsById.get(item.athleteId)?.avatar"
          :size="26"
        />
        <div class="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span class="flex items-baseline gap-2">
            <span class="text-[13px] font-semibold">
              {{ authorsById.get(item.athleteId)?.firstName ?? 'Quelqu’un' }}
            </span>
            <span class="mono text-[11.5px] text-text-dim">
              {{ formatDate(String(item.createdAt).slice(0, 10)) }}
            </span>
            <UiActionButton
              v-if="item.removable"
              class="btn btn-ghost ml-auto px-[9px] text-[12px] lean:h-[26px]"
              :action="() => removeComment(item.id)"
            >
              Retirer
            </UiActionButton>
          </span>
          <p class="text-[13.5px]">{{ item.text }}</p>
        </div>
      </div>

      <div class="flex flex-col gap-2 lean:flex-row lean:items-center">
        <input
          v-model="text"
          class="input lean:flex-1"
          type="text"
          :maxlength="MAX_COMMENT_LENGTH"
          placeholder="Écrire un commentaire"
          aria-label="Votre commentaire"
        />
        <UiActionButton class="btn self-stretch lean:self-auto" :action="comment">
          Commenter
        </UiActionButton>
      </div>

      <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>
    </div>

    <div v-if="mine" class="flex items-center gap-3">
      <UiActionButton class="btn btn-ghost ml-auto" :action="withdraw">
        Retirer la publication
      </UiActionButton>
    </div>
  </div>
</template>
