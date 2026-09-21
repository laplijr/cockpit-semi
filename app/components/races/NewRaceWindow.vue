<script setup lang="ts">
import type { LookupFields } from './RaceSearch.vue'

const emit = defineEmits<{ created: [] }>()

const lookupId = ref<number | null>(null)
const prefill = ref<LookupFields | null>(null)
const llm = useLlmAvailable()

function onFound(payload: { lookupId: number; fields: LookupFields }) {
  lookupId.value = payload.lookupId
  prefill.value = payload.fields
}
</script>

<template>
  <!-- Sans clé, la recherche n'existe pas : le formulaire prend toute la fenêtre. -->
  <div class="grid grid-cols-1 gap-4 lean:gap-6" :class="{ 'lean:grid-cols-[320px_1fr]': llm }">
    <RacesRaceSearch v-if="llm" @found="onFound" />
    <div
      :class="{
        'border-t border-line-soft pt-4 lean:border-t-0 lean:border-l lean:pt-0 lean:pl-6': llm,
      }"
    >
      <RacesNewRaceForm :lookup-id="lookupId" :prefill="prefill" @created="emit('created')" />
    </div>
  </div>
</template>
