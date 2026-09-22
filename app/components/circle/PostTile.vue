<script setup lang="ts">
/**
 * Une publication du cercle (§ 8, P9). Quatre informations : la tête, le fait,
 * le mot, le pied. Le pied porte **des prénoms et jamais un compteur** — un
 * nombre de bravos serait un score, et le cercle n'en tient pas.
 */
import type { CircleIdentityView, CirclePostView } from '~/stores/circle'

const props = defineProps<{ post: CirclePostView; author?: CircleIdentityView }>()

const ui = useUiStore()
const circle = useCircleStore()

const nature = computed(() =>
  props.post.source === 'course' ? 'Course' : (SESSION_LABELS[props.post.code ?? ''] ?? 'Séance'),
)

const icon = computed(() =>
  props.post.source === 'course' ? 'flag' : (SPORT_STYLES[props.post.sport]?.icon ?? 'run'),
)

/** L'allure ne se stocke pas, elle se lit : distance et durée la donnent. */
const pace = computed(() => {
  const { distanceM, durationMin } = props.post
  if (!distanceM || !durationMin || props.post.sport !== 'course') return null
  return (durationMin * 60) / (distanceM / 1000)
})

/** « Ronan, Claire et Sofia » : la phrase se lit, la liste se compterait. */
const bravoText = computed(() => {
  const names = props.post.bravos.map((one) => one.firstName ?? 'Quelqu’un')
  if (names.length === 0) return null
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} et ${names.at(-1)}`
})
</script>

<template>
  <div
    class="tile tile-action min-h-[156px] justify-start gap-[9px] wide:h-[156px]"
    role="button"
    tabindex="0"
    @click="ui.openModal('publication', post.id)"
    @keydown.enter.prevent="ui.openModal('publication', post.id)"
    @keydown.space.prevent="ui.openModal('publication', post.id)"
  >
    <div class="flex items-center gap-[9px]">
      <UiAvatar :first-name="author?.firstName" :avatar="author?.avatar" :size="28" />
      <span class="text-[13.5px] font-semibold">{{ author?.firstName ?? 'Quelqu’un' }}</span>
      <span class="pill ml-auto" :class="post.source === 'course' ? 'pill-race' : ''">
        <UiAppIcon :name="icon" :size="12" />
        {{ nature }}
      </span>
    </div>

    <span v-if="post.label" class="display truncate text-[19px] font-semibold">
      {{ post.label }}
    </span>

    <div class="mono flex items-baseline gap-3 text-[15px]">
      <span v-if="post.distanceM">{{ formatDistance(post.distanceM) }}</span>
      <span>{{ formatMinutes(post.durationMin) }}</span>
      <span v-if="pace" class="text-[13px] text-text-dim">{{ formatPace(pace) }}/km</span>
    </div>

    <p v-if="post.note" class="line-clamp-2 text-[13px] text-text-dim">« {{ post.note }} »</p>

    <div class="mt-auto flex items-center gap-[10px]">
      <UiActionButton
        class="btn btn-ghost px-[9px] text-[12.5px] wide:h-[26px]"
        :class="post.mine ? 'border-accent-deep bg-accent-track text-accent' : ''"
        icon="bravo"
        :icon-size="14"
        :action="() => circle.toggleBravo(post.id)"
        @click.stop
      >
        Bravo
      </UiActionButton>

      <span v-if="bravoText" class="truncate text-[12.5px] text-text-dim">{{ bravoText }}</span>
      <span v-else class="text-[12.5px] text-text-dim">Personne pour l’instant</span>

      <span v-if="post.comments" class="ml-auto flex items-center gap-[6px] text-[12.5px]">
        <UiAppIcon name="chat" :size="14" />
        {{ post.comments }}
      </span>
    </div>
  </div>
</template>
