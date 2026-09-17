<script setup lang="ts">
import { SESSION_TERMS, glossaryTermFor } from '~/utils/glossary'

const { data } = await useFetch('/api/library/cycling')

const CONVERSION_RULES = [
  {
    title: 'Charge égale',
    body: 'Même RPE × durée à ± 10 %, pas une règle de durée : une sortie longue de 1 h 30 à RPE 5 devient un Z2 de 2 h 30 à RPE 3.',
  },
  {
    title: 'Fatigue n’est pas douleur',
    body: 'La fatigue allège la séance ou la ramène en Z2. La douleur, elle, convertit la séance de course : sweet spot pour un seuil, Z2 pour le reste.',
  },
  {
    title: 'Jamais la sortie longue',
    body: 'La sortie longue course n’est convertie qu’en cas de douleur : le semi se gagne sur l’impact et la durée en course.',
  },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">Les séances vélo du plan</span>
        <span class="mono text-[11.5px] text-text-muted">
          phase actuelle : {{ PHASE_LABELS[data?.phaseType ?? ''] ?? data?.phaseType }} ·
          {{ data?.ridesThisWeek }} sortie{{ (data?.ridesThisWeek ?? 0) > 1 ? 's' : '' }} cette
          semaine · spécifique : ≤ {{ Math.round((data?.maxLoadShare ?? 0) * 100) }} % de la charge
        </span>
      </div>

      <div class="flex flex-wrap gap-2">
        <span
          v-for="row in data?.ridesPerPhase ?? []"
          :key="row.type"
          class="pill"
          :class="row.type === data?.phaseType && 'bg-accent/15 text-accent'"
        >
          {{ PHASE_LABELS[row.type] ?? row.type }} · {{ row.rides }}
        </span>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div v-for="type in data?.types ?? []" :key="type.code" class="tile">
        <div class="flex items-baseline gap-3">
          <span class="display text-[20px] font-semibold">
            {{ type.label }}
            <UiInfoHint
              v-if="glossaryTermFor(SESSION_TERMS, type.code)"
              :term="glossaryTermFor(SESSION_TERMS, type.code)!"
            />
          </span>
          <span v-if="type.onPainOnly" class="pill pill-warn">sur douleur</span>
          <span class="pill ml-auto">RPE {{ type.expectedRpe }}</span>
        </div>

        <div class="flex flex-wrap gap-x-6 gap-y-1">
          <div class="flex flex-col">
            <span class="label text-[10px]">Durée</span>
            <span class="mono text-[15px]">
              {{ formatMinutes(type.minDurationMin) }} – {{ formatMinutes(type.maxDurationMin) }}
            </span>
          </div>
          <div class="flex flex-col">
            <span class="label text-[10px]">Puissance <UiInfoHint term="ftp" /></span>
            <span class="mono text-[15px]">{{ type.ftpRange }}</span>
          </div>
          <div class="flex flex-col">
            <span class="label text-[10px]">Fréquence cardiaque</span>
            <span class="mono text-[15px]">{{ type.hrRange }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-1 border-t border-line-soft pt-2">
          <span class="label text-[10px]">Structure</span>
          <span
            v-for="step in type.prescription.steps"
            :key="step.label"
            class="mono text-[12px] text-text-dim"
          >
            {{ step.repeats ? `${step.repeats} × ` : '' }}{{ step.label }}
            <template v-if="step.durationS"> · {{ formatMinutes(step.durationS / 60) }} </template>
            <template v-if="step.recoveryS">
              · récup {{ Math.round(step.recoveryS / 60) }}′</template
            >
          </span>
        </div>

        <p class="text-[13px] text-text-muted">{{ type.note }}</p>

        <div class="flex flex-wrap gap-1">
          <span v-for="phase in type.allowedPhases" :key="phase" class="pill text-[10.5px]">
            {{ PHASE_LABELS[phase] ?? phase }}
          </span>
        </div>
      </div>
    </div>

    <div class="tile">
      <span class="label">Règles de conversion course → vélo</span>
      <div class="grid grid-cols-3 gap-6">
        <div v-for="rule in CONVERSION_RULES" :key="rule.title" class="flex flex-col gap-1">
          <span class="display text-[17px] font-semibold">{{ rule.title }}</span>
          <span class="text-[13px] text-text-muted">{{ rule.body }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
