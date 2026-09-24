<script setup lang="ts">
const firstName = defineModel<string>('firstName', { required: true })
const birthDate = defineModel<string>('birthDate', { required: true })
const weightKg = defineModel<number | null>('weightKg', { required: true })
</script>

<template>
  <div class="fold-3 grid gap-4">
    <label class="flex flex-col gap-[6px]">
      <span class="label text-caption">Prénom</span>
      <input v-model="firstName" type="text" class="input" placeholder="Ronan" />
    </label>
    <label class="flex flex-col gap-[6px]">
      <span class="label text-caption">Date de naissance</span>
      <input v-model="birthDate" type="date" class="input mono" />
    </label>
    <label class="flex flex-col gap-[6px]">
      <span class="label text-caption">Poids (kg)</span>
      <input v-model.number="weightKg" type="number" step="0.1" class="input mono" />
    </label>
  </div>
</template>
