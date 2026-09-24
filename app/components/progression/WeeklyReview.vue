<script setup lang="ts">
import {
  ReviewHighlight,
  ReviewVerdict,
  type WeeklyReview,
} from '~~/server/domain/load/weekly-review'
import { PhaseType } from '~~/server/domain/plan/phases'

const { review } = defineProps<{ review: WeeklyReview }>()

/** Le verdict se lit en un mot, et jamais par la couleur seule (§ 8). */
const VERDICTS: Record<ReviewVerdict, { label: string; tone: string }> = {
  [ReviewVerdict.Conforming]: { label: 'Semaine tenue', tone: 'text-ok' },
  [ReviewVerdict.Eased]: { label: 'Semaine allégée', tone: 'text-text-dim' },
  [ReviewVerdict.Partial]: { label: 'Semaine partielle', tone: 'text-warn' },
  [ReviewVerdict.Missed]: { label: 'Semaine manquée', tone: 'text-warn' },
}

/**
 * Le domaine rend des faits typés, jamais des phrases : c'est ici qu'ils se
 * rédigent (§ 8, P7.1).
 */
const HIGHLIGHTS: Record<ReviewHighlight, string> = {
  [ReviewHighlight.TestPassed]: 'Test 20′ passé : la forme mesurée a été recalée.',
  [ReviewHighlight.VdotGained]: 'La forme mesurée a progressé.',
  [ReviewHighlight.VdotLost]: 'La forme mesurée a reculé.',
  [ReviewHighlight.LongRunMissed]: 'La sortie longue n’a pas eu lieu.',
  [ReviewHighlight.KeySessionsMissed]: 'Une séance clé au moins a sauté.',
  [ReviewHighlight.VolumeOverTarget]: 'Le volume dépasse la cible de plus de 10 %.',
  [ReviewHighlight.VolumeUnderTarget]: 'Le volume reste sous la cible de plus de 10 %.',
  [ReviewHighlight.ShortNights]: 'Trois nuits courtes ou plus.',
  [ReviewHighlight.PainReported]: 'Une douleur a été signalée.',
  [ReviewHighlight.EverythingDone]: 'Tout ce qui était prévu a été fait.',
}

const PHASES: Record<PhaseType, string> = {
  [PhaseType.Base]: 'base',
  [PhaseType.ShortBase]: 'base courte',
  [PhaseType.Development]: 'développement',
  [PhaseType.Specific]: 'spécifique',
  [PhaseType.Speed]: 'vitesse',
  [PhaseType.Taper]: 'affûtage',
  [PhaseType.Recovery]: 'récup',
  [PhaseType.Rebuild]: 'relance',
  [PhaseType.Transition]: 'transition',
}

const verdict = computed(() => VERDICTS[review.verdict])
const gapKm = computed(() =>
  review.runM.gapM === null ? null : Math.round(review.runM.gapM / 100) / 10,
)
</script>

<template>
  <div class="tile">
    <div class="flex items-baseline gap-3">
      <span class="label">Bilan de la semaine</span>
      <span class="mono text-meta text-text-dim">
        {{ formatDate(review.weekStart) }} — {{ formatDate(review.weekEnd) }}
      </span>
      <span class="ml-auto text-body font-semibold" :class="verdict.tone">
        {{ verdict.label }}
      </span>
    </div>

    <div class="fold-3 grid gap-4">
      <div class="flex flex-col gap-1">
        <span class="label text-caption">Volume de course</span>
        <span class="mono text-display-s">
          {{ review.runM.done === null ? '—' : formatDistance(review.runM.done) }}
        </span>
        <span class="mono text-meta text-text-dim">
          visé {{ formatDistance(review.runM.target) }}
          <template v-if="gapKm !== null">
            · {{ gapKm > 0 ? '+' : '' }}{{ formatDecimal(gapKm, 1) }} km
          </template>
        </span>
      </div>

      <div class="flex flex-col gap-1">
        <span class="label text-caption">Séances</span>
        <span class="mono text-display-s">
          {{ review.sessions.done }} / {{ review.sessions.planned }}
        </span>
        <span class="mono text-meta text-text-dim">
          dont {{ review.sessions.keyDone }} / {{ review.sessions.key }} clé<template
            v-if="review.sessions.key > 1"
            >s</template
          >
        </span>
      </div>

      <div class="flex flex-col gap-1">
        <span class="label text-caption">
          <UiInfoHint term="chargeCombinee">Charge</UiInfoHint>
        </span>
        <span class="mono text-display-s">{{ Math.round(review.loadUa) }}</span>
        <span class="mono text-meta text-text-dim">
          <template v-if="!review.vdotChange">forme inchangée</template>
          <template v-else>
            VDOT {{ review.vdotChange > 0 ? '+' : '' }}{{ formatDecimal(review.vdotChange, 2) }}
          </template>
        </span>
      </div>
    </div>

    <div v-if="review.highlights.length > 0" class="flex flex-col gap-[6px]">
      <span
        v-for="highlight in review.highlights"
        :key="highlight"
        class="border-t border-line-soft pt-[6px] text-body first:border-t-0 first:pt-0"
      >
        {{ HIGHLIGHTS[highlight] }}
      </span>
    </div>

    <p v-if="review.next.targetRunM !== null" class="text-body text-text-dim">
      La semaine qui suit : {{ formatDistance(review.next.targetRunM) }} visés<template
        v-if="review.next.phase"
      >
        en {{ PHASES[review.next.phase] }}</template
      >.
    </p>
  </div>
</template>
