<script setup lang="ts">
import { Sport } from '~~/server/domain/shared/sport'
import { StrengthIntent, STRENGTH_INTENT_LABELS } from '~~/server/domain/strength/intent'
import { StrengthEquipment, EQUIPMENT_LABELS } from '~~/server/domain/strength/equipment'

const sports = defineModel<Sport[]>({ required: true })
/** L'intention du renforcement, quand il est pratiqué (§ 5, P11.2). */
const intent = defineModel<StrengthIntent>('intent', { required: true })
/** Le matériel disponible : il résout les exercices, pas les séances (§ 5, P11.3). */
const equipment = defineModel<StrengthEquipment>('equipment', { required: true })

/** La course est le moteur : elle ne se décoche pas (§ 5, P8.1). */
const SUPPORT_SPORTS = [Sport.Cycling, Sport.Strength] as const

const INTENTS = [StrengthIntent.Complete, StrengthIntent.Running] as const

/** Du plus nu au plus fourni : l'ordre de lecture est celui de la chaîne (§ 5, P11.3). */
const EQUIPMENTS = [StrengthEquipment.None, StrengthEquipment.Home, StrengthEquipment.Gym] as const

function toggle(sport: Sport) {
  sports.value = sports.value.includes(sport)
    ? sports.value.filter((item) => item !== sport)
    : [...sports.value, sport]
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <span class="label text-caption">Sports pratiqués</span>
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

    <!-- Le programme se choisit sous la pastille qui l'active, et nulle part
         ailleurs : sans renforcement, la question ne se pose pas (§ 5, P11.2). -->
    <div v-if="sports.includes(Sport.Strength)" class="flex flex-col gap-2 pt-1">
      <span class="label text-caption">Renforcement</span>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="value in INTENTS"
          :key="value"
          type="button"
          class="btn btn-ghost"
          :class="intent === value && 'border-accent bg-accent/15 text-text'"
          :aria-pressed="intent === value"
          @click="intent = value"
        >
          {{ STRENGTH_INTENT_LABELS[value] }}
        </button>
      </div>
      <p class="text-body text-text-dim">
        Pour la course : appuis et tronc, faisables sans haut du corps. Complet : le haut du corps
        en plus, deux séances de plus par semaine.
      </p>

      <span class="label text-caption">Matériel disponible</span>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="value in EQUIPMENTS"
          :key="value"
          type="button"
          class="btn btn-ghost"
          :class="equipment === value && 'border-accent bg-accent/15 text-text'"
          :aria-pressed="equipment === value"
          @click="equipment = value"
        >
          {{ EQUIPMENT_LABELS[value] }}
        </button>
      </div>
    </div>
  </div>
</template>
