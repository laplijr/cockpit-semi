<script setup lang="ts">
import type { LookupFields } from './RaceSearch.vue'

const emit = defineEmits<{ created: [] }>()

const lookupId = ref<number | null>(null)
const prefill = ref<LookupFields | null>(null)

function onFound(payload: { lookupId: number; fields: LookupFields }) {
  lookupId.value = payload.lookupId
  prefill.value = payload.fields
}
</script>

<template>
  <div class="grid grid-cols-[320px_1fr] gap-6">
    <RacesRaceSearch @found="onFound" />
    <div class="border-l border-line-soft pl-6">
      <RacesNewRaceForm :lookup-id="lookupId" :prefill="prefill" @created="emit('created')" />
    </div>
  </div>
</template>
