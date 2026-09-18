<script setup lang="ts">
import { SESSION_TERMS, glossaryTermFor } from '~/utils/glossary'

const { data } = await useFetch('/api/library/cycling')
const ui = useUiStore()

/**
 * Trois paragraphes de règles devenus quatre lignes « si … → … » (§ 8, P6.35) :
 * une règle de conversion est une table de décision, pas de la prose.
 */
const CONVERSION_RULES = [
  { when: 'Séance convertie', then: 'même RPE × durée, à ± 10 %' },
  { when: 'Fatigue', then: 'séance allégée ou ramenée en Z2' },
  { when: 'Douleur sur un seuil', then: 'sweet spot' },
  { when: 'Douleur, sortie longue exceptée', then: 'Z2' },
]

/** La structure tient sur une ligne : ce que contient la séance, pas son détail. */
function structureOf(steps: { label: string; repeats?: number }[]): string {
  return steps.map((step) => `${step.repeats ? `${step.repeats} × ` : ''}${step.label}`).join(' · ')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">Les séances vélo du plan</span>
        <span class="mono text-[11.5px] text-text-dim">
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

    <!-- Une fiche : nom, valeur dominante, structure sur une ligne, réglette
         de phases. La note passe au survol (§ 8, P6.35). -->
    <div class="grid grid-cols-3 gap-4">
      <button
        v-for="type in data?.types ?? []"
        :key="type.code"
        type="button"
        class="tile tile-action text-left"
        @click="ui.openLibrarySession('velo', type.code)"
      >
        <span class="flex items-baseline gap-2">
          <span class="display truncate text-[17px] font-semibold">
            {{ type.label }}
            <UiInfoHint
              v-if="glossaryTermFor(SESSION_TERMS, type.code)"
              :term="glossaryTermFor(SESSION_TERMS, type.code)!"
            />
          </span>
          <span v-if="type.onPainOnly" class="pill pill-warn ml-auto shrink-0">sur douleur</span>
        </span>

        <span class="mono text-[24px] leading-none">{{ type.ftpRange }}</span>

        <span
          class="mono truncate text-[12px] text-text-dim"
          :title="structureOf(type.prescription.steps)"
        >
          {{ formatMinutes(type.minDurationMin) }} – {{ formatMinutes(type.maxDurationMin) }} ·
          {{ structureOf(type.prescription.steps) }}
        </span>

        <span class="mt-auto block pt-1">
          <UiPhaseRail :allowed="type.allowedPhases" />
        </span>
      </button>
    </div>

    <div class="tile">
      <span class="label">Règles de conversion course → vélo</span>
      <div class="grid grid-cols-2 gap-x-8">
        <span
          v-for="rule in CONVERSION_RULES"
          :key="rule.when"
          class="flex items-baseline gap-2 border-t border-line-soft py-[7px] text-[13px]"
        >
          <span class="text-text-dim">{{ rule.when }}</span>
          <span class="mono ml-auto shrink-0">→ {{ rule.then }}</span>
        </span>
      </div>
    </div>
  </div>
</template>
