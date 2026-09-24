<script setup lang="ts">
/**
 * La répartition de l'intensité, semaine par semaine, sous « Volume et
 * charge » et sur son axe (P22). Deux couloirs par semaine, le seuil puis
 * l'intensité, chacun avec son quota : une barre empilée n'aurait porté qu'un
 * des deux repères honnêtement.
 */
interface IntensityWeek {
  index: number
  intensity: Record<string, number> | null
}

const props = withDefaults(defineProps<{ weeks: IntensityWeek[]; height?: number }>(), {
  height: 36,
})

/** Haut de l'échelle : 12 % du temps de course, au-dessus des deux quotas. */
const SCALE = 0.12

const LANES = [
  { zone: 'threshold', label: 'T', quota: 0.1, tone: 'bg-accent/55' },
  { zone: 'interval', label: 'I', quota: 0.08, tone: 'bg-accent' },
] as const

const ZONES = [
  { zone: 'easy', label: 'E' },
  { zone: 'marathon', label: 'M' },
  { zone: 'threshold', label: 'T' },
  { zone: 'interval', label: 'I' },
  { zone: 'repetition', label: 'R' },
] as const

const heightOf = (share: number) => Math.round((Math.min(share, SCALE) / SCALE) * props.height)

const percent = (share: number) => `${Math.round(share * 100)} %`
</script>

<template>
  <div class="flex flex-col gap-1">
    <span class="label text-caption">
      <UiInfoHint term="intensite">Seuil et intensité</UiInfoHint>
    </span>
    <div class="flex items-end gap-1" :style="{ height: `${height}px` }">
      <UiHoverBubble
        v-for="week in weeks"
        :key="week.index"
        class="flex-1"
        :label="`Intensité de la semaine ${week.index}`"
        size="md"
        trigger-class="w-full items-end"
      >
        <template #trigger>
          <span class="flex w-full items-end gap-px px-px" :style="{ height: `${height}px` }">
            <span
              v-for="lane in LANES"
              :key="lane.zone"
              class="relative flex h-full flex-1 items-end"
            >
              <span
                class="absolute inset-x-0 h-px bg-text-dim/60"
                :style="{ bottom: `${heightOf(lane.quota)}px` }"
              />
              <span
                v-if="week.intensity"
                class="w-full rounded-t-[2px]"
                :class="lane.tone"
                :style="{ height: `${heightOf(week.intensity[lane.zone] ?? 0)}px` }"
              />
            </span>
          </span>
        </template>

        <template #title>Semaine {{ week.index }}</template>
        <span v-if="week.intensity" class="mono text-meta">
          {{
            ZONES.map((item) => `${item.label} ${percent(week.intensity![item.zone] ?? 0)}`).join(
              ' · ',
            )
          }}
        </span>
        <span v-if="week.intensity" class="mono text-meta text-text-dim">
          quotas T 10 % · I 8 %
        </span>
        <span v-else class="text-meta text-text-dim">Aucune course faite cette semaine.</span>
      </UiHoverBubble>
    </div>
  </div>
</template>
