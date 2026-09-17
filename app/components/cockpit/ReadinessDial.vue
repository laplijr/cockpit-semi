<script setup lang="ts">
const ui = useUiStore()
const { data } = await useFetch('/api/readiness')

const STATES = {
  pret: { label: 'Prêt', tone: 'text-ok' },
  vigilance: { label: 'Vigilance', tone: 'text-warn' },
  repos: { label: 'Repos', tone: 'text-text-dim' },
} as const

const state = computed(() => (data.value ? STATES[data.value.state] : null))
</script>

<template>
  <div
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

    <span class="mono text-[11.5px] text-text-muted">
      <template v-if="data?.causes.length">
        {{ data.causes.length }} signal{{ data.causes.length > 1 ? 'aux' : '' }} · ouvre le détail
      </template>
      <template v-else>aucun signal particulier</template>
    </span>
  </div>
</template>
