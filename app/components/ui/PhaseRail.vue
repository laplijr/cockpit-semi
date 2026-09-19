<script setup lang="ts">
import { PHASE_LABELS } from '~/utils/format'
import { PhaseType } from '~~/server/domain/plan/phases'

/**
 * Où une séance se pose dans la saison (§ 8, P6.35). Sept segments dans l'ordre
 * du cycle remplacent la liste de sept ou huit pastilles : la forme se lit d'un
 * coup d'œil, les noms restent au survol. La base courte allume le même segment
 * que la base — c'en est la variante en quatre semaines, jamais une phase à
 * part. La transition n'a pas de segment : aucune séance ne s'y pose.
 */
const RAIL: readonly PhaseType[] = [
  PhaseType.Base,
  PhaseType.Development,
  PhaseType.Specific,
  PhaseType.Speed,
  PhaseType.Taper,
  PhaseType.Recovery,
  PhaseType.Rebuild,
]

/** Trois repères sous la réglette : début, milieu, fin de cycle. */
const LEGEND = ['base', 'spécifique', 'relance']

const props = defineProps<{ allowed: readonly string[] }>()

const lit = computed(() => {
  const allowed = new Set(props.allowed)
  if (allowed.has(PhaseType.ShortBase)) allowed.add(PhaseType.Base)
  return RAIL.map((phase) => ({ phase, on: allowed.has(phase) }))
})

const summary = computed(() =>
  lit.value
    .filter((segment) => segment.on)
    .map((segment) => PHASE_LABELS[segment.phase] ?? segment.phase)
    .join(', '),
)
</script>

<template>
  <div class="flex flex-col gap-1">
    <span class="label text-[9.5px]"><UiInfoHint term="regletteDePhases">Phases</UiInfoHint></span>
    <div class="flex gap-px" role="img" :aria-label="`Phases : ${summary || 'aucune'}`">
      <UiHoverBubble
        v-for="segment in lit"
        :key="segment.phase"
        :label="PHASE_LABELS[segment.phase] ?? segment.phase"
        size="sm"
        class="flex-1"
        trigger-class="w-full"
      >
        <template #trigger>
          <span
            class="block h-[5px] w-full rounded-[1px]"
            :class="segment.on ? 'bg-accent' : 'bg-accent-track'"
          />
        </template>
        <span class="text-[12.5px] text-text-dim">
          {{ PHASE_LABELS[segment.phase] ?? segment.phase }}
        </span>
      </UiHoverBubble>
    </div>
    <div class="mono flex justify-between text-[10px] text-text-dim">
      <span v-for="word in LEGEND" :key="word">{{ word }}</span>
    </div>
  </div>
</template>
