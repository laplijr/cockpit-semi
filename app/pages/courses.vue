<script setup lang="ts">
const ui = useUiStore()
const plan = usePlanStore()
const { data: races, refresh } = await useFetch('/api/races')

const upcoming = computed(() => (races.value ?? []).filter((race) => race.status === 'planifiee'))
const past = computed(() => (races.value ?? []).filter((race) => race.status !== 'planifiee'))

await plan.load()

async function onCreated() {
  ui.closeModal()
  await Promise.all([refresh(), plan.load()])
}

async function remove(id: number) {
  await $fetch(`/api/races/${id}`, { method: 'DELETE' })
  await Promise.all([refresh(), plan.load()])
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center">
      <button type="button" class="btn ml-auto" @click="ui.openModal('nouvelle-course')">
        Nouvelle course
      </button>
    </div>

    <div class="tile">
      <span class="label">Courses à venir</span>
      <table class="w-full text-[13px]">
        <thead>
          <tr class="text-left">
            <th
              v-for="head in [
                'Course',
                'Date',
                'Distance',
                'Prio',
                'Objectif',
                'Projection',
                'Écart',
                '',
              ]"
              :key="head"
              class="label pb-2 text-[10px] font-semibold"
            >
              {{ head }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="race in upcoming" :key="race.id" class="border-t border-line-soft">
            <td class="py-[10px]">{{ race.name }}</td>
            <td class="mono py-[10px] text-text-dim">{{ formatDate(race.date) }}</td>
            <td class="mono py-[10px] text-text-dim">{{ formatDistance(race.distanceM) }}</td>
            <td class="py-[10px]">
              <span class="pill" :class="race.priority === 'A' && 'bg-accent/15 text-accent'">
                {{ race.priority }}
              </span>
            </td>
            <td class="mono py-[10px]">
              <span v-if="race.objectiveToSet" class="text-text-muted">à fixer</span>
              <span v-else-if="race.objectiveMode === 'performance_max'" class="text-text-dim">
                perf. max
              </span>
              <span v-else>{{ formatDuration(race.objectifS) }}</span>
            </td>
            <td class="mono py-[10px]">{{ formatDuration(race.projectionS) }}</td>
            <td class="mono py-[10px]" :class="(race.gapS ?? 0) > 0 ? 'text-warn' : 'text-ok'">
              {{ formatSignedDuration(race.gapS) }}
            </td>
            <td class="py-[10px] text-right">
              <button
                type="button"
                class="text-text-muted hover:text-text"
                @click="remove(race.id)"
              >
                <UiAppIcon name="close" :size="15" />
              </button>
            </td>
          </tr>
          <tr v-if="upcoming.length === 0">
            <td colspan="8" class="py-3 text-text-muted">Aucune course planifiée.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="past.length > 0" class="tile">
      <span class="label">Courses passées</span>
      <div
        v-for="race in past"
        :key="race.id"
        class="flex flex-col gap-1 border-t border-line-soft py-[10px] first:border-t-0"
      >
        <div class="flex items-baseline gap-3">
          <span class="display text-[17px] font-semibold">{{ race.name }}</span>
          <span class="mono text-[11.5px] text-text-muted">{{ formatDate(race.date) }}</span>
          <span class="mono ml-auto text-[15px]">{{ formatDuration(race.resultatS) }}</span>
        </div>
        <span v-if="!race.representative" class="text-[12px] text-warn">
          Chrono non représentatif — il ne calibre pas le VDOT.
          <template v-if="race.incident">
            Incident au km {{ race.incident.km }} : {{ race.incident.note }}.
          </template>
        </span>
      </div>
    </div>

    <CockpitSeasonTimeline
      v-if="plan.plan"
      :phases="plan.plan.phases"
      :weeks="plan.plan.weeks"
      :races="upcoming"
      :today="plan.today"
    />

    <Teleport to="body">
      <ShellAppModal
        v-if="ui.modal === 'nouvelle-course'"
        title="Nouvelle course"
        :width="720"
        @close="ui.closeModal()"
      >
        <RacesNewRaceForm @created="onCreated" />
      </ShellAppModal>
    </Teleport>
  </div>
</template>
