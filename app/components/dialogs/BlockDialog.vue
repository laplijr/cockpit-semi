<script setup lang="ts">
import { PHASE_PURPOSE } from '~/utils/glossary'
import type { PhaseType } from '~~/server/domain/plan/phases'

const props = defineProps<{ phaseId: number }>()

const ui = useUiStore()
const plan = usePlanStore()
const { data: races } = await useFetch('/api/races')

const phase = computed(() => plan.plan?.phases.find((item) => item.id === props.phaseId))

const weeks = computed(() =>
  (plan.plan?.weeks ?? []).filter(
    (week) =>
      phase.value !== undefined &&
      week.index >= phase.value.startWeek &&
      week.index <= phase.value.endWeek,
  ),
)

const dated = computed(() => !plan.awaitingResumption)

/** Séances clés du bloc, par code : combien de fois, et à quoi elles servent. */
const keySessions = computed(() => {
  const counts = new Map<string, number>()
  for (const week of weeks.value) {
    for (const session of plan.sessionsByWeek.get(week.id) ?? []) {
      if (!session.key) continue
      counts.set(session.code, (counts.get(session.code) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
})

const cycling = computed(() => {
  const minutes = weeks.value.map((week) => week.targetCyclingMin)
  return { total: minutes.reduce((sum, value) => sum + value, 0), peak: Math.max(0, ...minutes) }
})

const strength = computed(() => {
  const counts = weeks.value.map((week) => week.targetStrengthCount)
  return { total: counts.reduce((sum, value) => sum + value, 0), peak: Math.max(0, ...counts) }
})

const closingRace = computed(() =>
  (races.value ?? []).find((race) => race.id === phase.value?.raceId),
)

const maxVolume = computed(() => Math.max(1, ...weeks.value.map((week) => week.targetRunM)))
</script>

<template>
  <!-- Un bloc est en lecture seule : il ne se modifie pas, il se pilote par ses courses (§ 8). -->
  <div v-if="phase" class="flex flex-col gap-4">
    <div class="flex items-baseline gap-3">
      <span class="display text-[22px] font-semibold">
        {{ PHASE_LABELS[phase.type] ?? phase.type }}
      </span>
      <span class="mono text-[11.5px] text-text-muted">
        semaines {{ phase.startWeek }} à {{ phase.endWeek }} · {{ weeks.length }} semaines
        <template v-if="dated && weeks.length > 0">
          · {{ formatDate(weeks[0]!.startDate) }} – {{ formatDate(weeks.at(-1)!.endDate) }}
        </template>
      </span>
    </div>

    <p class="text-[13px] text-text-dim">{{ PHASE_PURPOSE[phase.type as PhaseType] }}</p>

    <div class="tile bg-surface-inset">
      <span class="label text-[10.5px]">Volume visé, semaine par semaine</span>
      <table class="w-full text-[13px]">
        <tbody>
          <tr
            v-for="week in weeks"
            :key="week.id"
            class="border-t border-line-soft first:border-t-0"
          >
            <td class="mono py-[6px] w-14 text-text-muted">S{{ week.index }}</td>
            <td v-if="dated" class="mono py-[6px] w-28 text-text-muted">
              {{ formatDate(week.startDate) }}
            </td>
            <td class="py-[6px]">
              <span
                class="block h-[6px] rounded-sm"
                :class="week.light ? 'bg-line-strong' : 'bg-accent/70'"
                :style="{ width: `${(week.targetRunM / maxVolume) * 100}%` }"
              />
            </td>
            <td class="mono py-[6px] w-20 text-right">{{ formatDistance(week.targetRunM) }}</td>
            <td class="py-[6px] w-28 text-right">
              <span v-if="week.light" class="pill text-[10px]">
                allégée <UiInfoHint term="semaineAllegee" />
              </span>
              <span v-if="week.test" class="pill text-[10px]">
                test <UiInfoHint term="test20" />
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Séances clés <UiInfoHint term="seanceCle" /></span>
        <span v-for="item in keySessions" :key="item.code" class="text-[13px] text-text-dim">
          {{ SESSION_LABELS[item.code] ?? item.code }}
          <span class="mono text-text-muted">× {{ item.count }}</span>
        </span>
        <span v-if="keySessions.length === 0" class="text-[13px] text-text-muted">
          Aucune séance clé dans ce bloc.
        </span>
      </div>
      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Vélo</span>
        <span class="mono text-[17px]">{{ formatMinutes(cycling.total) }}</span>
        <span class="text-[12px] text-text-muted">
          sur tout le bloc · {{ formatMinutes(cycling.peak) }} au plus fort
        </span>
      </div>
      <div class="tile bg-surface-inset">
        <span class="label text-[10.5px]">Musculation</span>
        <span class="mono text-[17px]">{{ strength.total }} séances</span>
        <span class="text-[12px] text-text-muted">
          sur tout le bloc · {{ strength.peak }} par semaine au plus fort
        </span>
      </div>
    </div>

    <div v-if="closingRace" class="tile bg-surface-inset">
      <span class="label text-[10.5px]">La course qui termine le bloc</span>
      <button
        type="button"
        class="tile-action -mx-2 flex items-baseline gap-3 rounded-sm px-2 py-1 text-left"
        @click="ui.openModal('course', closingRace.id)"
      >
        <span class="display text-[17px] font-semibold">{{ closingRace.name }}</span>
        <span class="mono text-[12px] text-text-muted">
          {{ formatDateWithYear(closingRace.date) }} · {{ formatDistance(closingRace.distanceM) }} ·
          priorité {{ closingRace.priority }}
        </span>
      </button>
    </div>
  </div>
</template>
