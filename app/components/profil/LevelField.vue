<script setup lang="ts">
import {
  PROFILES_BY_LOAD,
  PROFILE_DESCRIPTIONS,
  PROFILE_LABELS,
  defaultsFor,
  type AthleteProfile,
} from '~~/server/domain/athlete/profile'

const profile = defineModel<AthleteProfile | null>({ required: true })

/** Choisir un niveau pré-remplit les volumes : le parent décide quoi en faire. */
const emit = defineEmits<{ chosen: [profile: AthleteProfile | null] }>()

function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  profile.value = value ? (value as AthleteProfile) : null
  emit('chosen', profile.value)
}
</script>

<template>
  <label class="flex flex-col gap-[6px]">
    <span class="label text-[10.5px]">
      <UiInfoHint term="profilPhysique">Profil physique</UiInfoHint>
    </span>
    <select class="input" :value="profile ?? ''" @change="onChange">
      <option value="">Au choix, non renseigné</option>
      <option v-for="item in PROFILES_BY_LOAD" :key="item" :value="item">
        {{ PROFILE_LABELS[item] }}
      </option>
    </select>
    <!-- Une seule ligne : les cinq descriptions ne se lisent qu'au profil choisi. -->
    <span v-if="profile" class="text-[12px] text-text-dim">
      {{ PROFILE_DESCRIPTIONS[profile] }} Pré-remplit
      {{ Math.round(defaultsFor(profile).startWeeklyVolumeM / 1000) }} à
      {{ Math.round(defaultsFor(profile).peakWeeklyVolumeM / 1000) }} km et
      {{ defaultsFor(profile).runsPerWeek }} courses par semaine, montée bornée à
      {{ defaultsFor(profile).maxWeeklyIncreasePct }} % par semaine.
    </span>
    <span v-else class="text-[12px] text-text-dim">
      Le profil pré-remplit le volume, le pic et le nombre de courses, et borne la montée
      hebdomadaire. Tout reste modifiable ensuite.
    </span>
  </label>
</template>
