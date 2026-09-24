<script setup lang="ts">
export interface PendingInstrument {
  label: string
  when: string
}

defineProps<{ pending: PendingInstrument[] }>()
</script>

<template>
  <!--
    Elle ne s'ajoute pas au cockpit : elle prend la place des cadrans qui
    n'ont encore rien à montrer, et disparaît quand ils s'allument (§ 11).
  -->
  <div class="tile dial border-dashed">
    <span class="label">Les premiers jours</span>

    <ul class="flex flex-col gap-[6px]">
      <li v-for="item in pending" :key="item.label" class="flex items-baseline gap-2 text-body">
        <span class="mt-[6px] size-[5px] shrink-0 rounded-full bg-line-strong" />
        <span>{{ item.label }}</span>
        <span class="mono ml-auto text-meta text-text-dim">{{ item.when }}</span>
      </li>
    </ul>
  </div>
</template>
