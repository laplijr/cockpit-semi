<script setup lang="ts">
import { Sport } from '~~/server/domain/shared/sport'

const sports = defineModel<Sport[]>({ required: true })

/** La course est le moteur : elle ne se décoche pas (§ 5, P8.1). */
const SUPPORT_SPORTS = [Sport.Cycling, Sport.Strength] as const

function toggle(sport: Sport) {
  sports.value = sports.value.includes(sport)
    ? sports.value.filter((item) => item !== sport)
    : [...sports.value, sport]
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <span class="label text-[10.5px]">Sports pratiqués</span>
    <p class="text-[13px] text-text-dim">
      Le moteur est une périodisation de course à pied. Le vélo et la musculation sont des séances
      de soutien : sans eux, la semaine ne garde que la course.
    </p>
    <div class="flex flex-wrap gap-2">
      <span class="btn btn-ghost border-accent bg-accent/15 text-text">
        <UiAppIcon :name="sportStyle(Sport.Running).icon" :size="15" />
        {{ SPORT_LABELS[Sport.Running] }}
      </span>
      <button
        v-for="sport in SUPPORT_SPORTS"
        :key="sport"
        type="button"
        class="btn btn-ghost"
        :class="sports.includes(sport) && 'border-accent bg-accent/15 text-text'"
        :aria-pressed="sports.includes(sport)"
        @click="toggle(sport)"
      >
        <UiAppIcon :name="sportStyle(sport).icon" :size="15" />
        {{ SPORT_LABELS[sport] }}
      </button>
    </div>
  </div>
</template>
