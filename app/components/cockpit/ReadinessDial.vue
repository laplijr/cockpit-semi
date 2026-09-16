<script setup lang="ts">
const { data } = await useFetch('/api/readiness')

const STATES = {
  pret: { label: 'Prêt', tone: 'text-ok' },
  vigilance: { label: 'Vigilance', tone: 'text-warn' },
  repos: { label: 'Repos', tone: 'text-text-dim' },
} as const

const state = computed(() => (data.value ? STATES[data.value.state] : null))
</script>

<template>
  <div class="tile">
    <div class="flex items-baseline justify-between">
      <span class="label">Forme du jour</span>
      <span v-if="state" class="pill" :class="data!.state === 'pret' ? 'pill-done' : 'pill-warn'">
        {{ state.label }}
      </span>
    </div>

    <span class="display text-[44px] leading-none font-bold" :class="state?.tone">
      {{ data?.score ?? '—' }}
    </span>

    <div v-if="data?.causes.length" class="flex flex-col gap-1">
      <span class="label text-[10px]">Causes</span>
      <span v-for="cause in data.causes" :key="cause" class="text-[12.5px] text-text-dim">
        {{ cause }}
      </span>
    </div>

    <p class="border-t border-line-soft pt-2 text-[12.5px] text-text-muted">
      {{ data?.suggestion }}
    </p>
  </div>
</template>
