<script setup lang="ts">
import { MIN_AVAILABLE_DAYS } from '~~/server/domain/athlete/onboarding'

defineProps<{ replacedRuns?: number | null }>()

const availableDays = defineModel<number[]>('availableDays', { required: true })
const longRunDay = defineModel<number>('longRunDay', { required: true })
const runsPerWeek = defineModel<number | null>('runsPerWeek', { required: true })
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <span class="label text-[10.5px]">Jours où tu peux courir</span>
      <p class="text-[13px] text-text-dim">
        Les jours disponibles disent <em>où</em> courir, pas <em>combien</em> de fois. Au moins
        {{ MIN_AVAILABLE_DAYS }}.
      </p>
      <ProfilWeekdayPicker v-model="availableDays" />
    </div>

    <div class="fold-2 grid gap-4">
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">Jour de la sortie longue</span>
        <select v-model.number="longRunDay" class="input">
          <option v-for="day in WEEKDAYS" :key="day.value" :value="day.value">
            {{ day.label }}
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-[6px]">
        <span class="label text-[10.5px]">
          <UiInfoHint term="coursesParSemaine">Courses par semaine</UiInfoHint>
          <span v-if="replacedRuns" class="mono text-text-dim line-through">
            {{ replacedRuns }}
          </span>
        </span>
        <select v-model.number="runsPerWeek" class="input">
          <option :value="null">Au choix du plan selon la phase</option>
          <option v-for="count in [2, 3, 4, 5, 6]" :key="count" :value="count">
            {{ count }} courses
          </option>
        </select>
      </label>
    </div>
  </div>
</template>
