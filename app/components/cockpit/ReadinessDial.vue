<script setup lang="ts">
const ui = useUiStore()
const { data, status } = useFetch('/api/readiness', { lazy: true, server: false })

const STATES = {
  pret: { label: 'Prêt', tone: 'text-ok' },
  vigilance: { label: 'Vigilance', tone: 'text-warn' },
  repos: { label: 'Repos', tone: 'text-text-dim' },
} as const

const state = computed(() => (data.value ? STATES[data.value.state] : null))

/** Les trois états du § 5, dans l'ordre du score : repos, vigilance, prêt. */
const SEGMENTS = [
  { key: 'repos', from: 0, to: 40, tone: 'bg-text-muted' },
  { key: 'vigilance', from: 40, to: 65, tone: 'bg-warn' },
  { key: 'pret', from: 65, to: 100, tone: 'bg-ok' },
] as const
</script>

<template>
  <div v-if="isLoading(status)" class="tile" aria-busy="true">
    <div class="flex items-baseline justify-between">
      <span class="label">Forme du jour <UiInfoHint term="formeDuJour" /></span>
      <UiSkeleton variant="block" :height="22" width="72px" />
    </div>
    <UiSkeleton variant="number" />
    <UiSkeleton variant="block" :height="14" />
  </div>

  <div
    v-else
    class="tile tile-action"
    role="button"
    :tabindex="0"
    @click="ui.openDial('forme')"
    @keydown.enter.prevent="ui.openDial('forme')"
    @keydown.space.prevent="ui.openDial('forme')"
  >
    <div class="flex items-baseline justify-between">
      <span class="label">Forme du jour <UiInfoHint term="formeDuJour" /></span>
      <span v-if="state" class="pill" :class="data!.state === 'pret' ? 'pill-done' : 'pill-warn'">
        {{ state.label }}
      </span>
    </div>

    <span class="display text-[44px] leading-none font-bold" :class="state?.tone">
      {{ data?.score ?? '—' }}
    </span>

    <!-- L'échelle remplace la ligne grise : trois segments et le repère du score. -->
    <div class="relative h-[14px]">
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
    </div>
  </div>
</template>
