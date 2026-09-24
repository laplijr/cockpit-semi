<script setup lang="ts">
const ui = useUiStore()
const { data, status } = useFetch('/api/readiness', { lazy: true, server: false })

/** L'état passe dans la couleur du chiffre : la pastille qui le nommait sort (§ 8, P6.35). */
const TONES = {
  pret: 'text-ok',
  vigilance: 'text-warn',
  repos: 'text-text-dim',
} as const

const tone = computed(() => (data.value ? TONES[data.value.state] : 'text-text-dim'))

/** Les trois états du § 5, dans l'ordre du score : repos, vigilance, prêt. */
const SEGMENTS = [
  { key: 'repos', from: 0, to: 40, tone: 'bg-text-dim' },
  { key: 'vigilance', from: 40, to: 65, tone: 'bg-warn' },
  { key: 'pret', from: 65, to: 100, tone: 'bg-ok' },
] as const
</script>

<template>
  <div v-if="isLoading(status)" class="tile dial" aria-busy="true">
    <div class="flex items-baseline justify-between">
      <span class="label"><UiInfoHint term="formeDuJour">Forme du jour</UiInfoHint></span>
    </div>
    <UiSkeleton variant="number" />
    <UiSkeleton :height="15" width="72px" />
    <UiSkeleton variant="block" :height="14" class="hidden lean:block" />
  </div>

  <button
    v-else
    type="button"
    class="tile dial tile-action text-left"
    @click="ui.openDial('forme')"
  >
    <span class="flex min-w-0 items-baseline justify-between gap-2">
      <span class="label min-w-0 truncate"
        ><UiInfoHint term="formeDuJour">Forme du jour</UiInfoHint></span
      >
    </span>

    <span class="display text-display-l lean:text-display-xl leading-none font-bold" :class="tone">
      {{ data?.score ?? '—' }}
    </span>

    <!-- Le mot remplace « sur 100 » : le chiffre seul ne dit pas si on est prêt (P20). -->
    <span class="mono text-meta text-text-dim">{{ data?.verdict ?? 'sur 100' }}</span>

    <!-- L'échelle situe le chiffre : trois segments et le repère du score. -->
    <span class="relative hidden lean:block h-[14px]">
      <span
        v-for="segment in SEGMENTS"
        :key="segment.key"
        class="absolute top-[4px] h-[6px] rounded-sm"
        :class="[segment.tone, data?.state === segment.key ? 'opacity-90' : 'opacity-25']"
        :style="{ left: `${segment.from}%`, width: `${segment.to - segment.from - 1}%` }"
      />
      <span
        v-if="data"
        class="absolute top-0 h-[13px] w-[2px] rounded-sm bg-text"
        :style="{ left: `${Math.min(100, Math.max(0, data.score))}%` }"
      />
    </span>
  </button>
</template>
