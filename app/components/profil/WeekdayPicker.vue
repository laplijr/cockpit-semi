<script setup lang="ts">
withDefaults(defineProps<{ short?: boolean }>(), { short: false })

const days = defineModel<number[]>({ required: true })

function toggle(day: number) {
  const index = days.value.indexOf(day)
  days.value =
    index === -1
      ? [...days.value, day].sort((a, b) => a - b)
      : days.value.filter((item) => item !== day)
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="day in WEEKDAYS"
      :key="day.value"
      type="button"
      :class="[
        short ? 'pill pill-tap' : 'btn btn-ghost',
        days.includes(day.value) &&
          (short ? 'bg-accent/15 text-text' : 'border-accent bg-accent/15 text-text'),
      ]"
      :aria-pressed="days.includes(day.value)"
      @click="toggle(day.value)"
    >
      {{ short ? day.label.slice(0, 3) : day.label }}
    </button>
  </div>
</template>
