<script setup lang="ts">
import { GLOSSARY, type GlossaryTerm } from '~/utils/glossary'

const ui = useUiStore()
const plan = usePlanStore()

/**
 * Cinq colonnes (§ 8, P6.35) : la priorité est un point devant le nom, et
 * l'écart se lit dans la colonne qui porte déjà l'objectif et la projection.
 */
const RACE_COLUMNS: { label: string; term?: GlossaryTerm }[] = [
  { label: 'Course' },
  { label: 'Date' },
  { label: 'Distance' },
  { label: 'Objectif → projection', term: 'ecart' },
  { label: 'Confiance', term: 'confiance' },
]

const PRIORITY_TONES: Record<string, string> = {
  A: 'bg-accent',
  B: 'bg-text-dim',
  C: 'bg-line-strong',
}

const { data: races, refresh } = await useFetch('/api/races')

const upcoming = computed(() => (races.value ?? []).filter((race) => race.status === 'planifiee'))
const past = computed(() => (races.value ?? []).filter((race) => race.status !== 'planifiee'))

await plan.ensureLoaded()

async function onCreated() {
  ui.closeModal()
  await Promise.all([refresh(), plan.load()])
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!--
      Le cap passe en tête : on voit d'abord où l'on va, la table dit ensuite
      avec quoi (arbitré avec Ronan, § 9, P6.37 — P5.16 l'avait écrit, le code
      disait l'inverse).
    -->
    <RacesSeasonBoard
      :phases="plan.plan?.phases ?? []"
      :weeks="plan.plan?.weeks ?? []"
      :races="upcoming"
      :today="plan.today"
      :dated="!plan.awaitingResumption"
      :loading="!plan.loaded"
    />

    <div class="tile">
      <div class="flex items-center gap-3">
        <span class="label">Courses à venir</span>
        <button
          type="button"
          class="btn btn-ghost ml-auto h-7 px-[10px] text-[12px]"
          @click="ui.openModal('nouvelle-course')"
        >
          <UiAppIcon name="plus" :size="14" />
          Ajouter
        </button>
      </div>
      <table class="w-full text-[13px]">
        <thead>
          <tr class="text-left">
            <th
              v-for="head in RACE_COLUMNS"
              :key="head.label"
              class="label pb-2 text-[10px] font-semibold"
            >
              <UiInfoHint v-if="head.term" :term="head.term">{{ head.label }}</UiInfoHint>
              <template v-else>{{ head.label }}</template>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="race in upcoming"
            :key="race.id"
            class="tile-action border-t border-line-soft"
            role="button"
            :tabindex="0"
            @click="ui.openModal('course', race.id)"
            @keydown.enter.prevent="ui.openModal('course', race.id)"
            @keydown.space.prevent="ui.openModal('course', race.id)"
          >
            <td class="py-[10px]">
              <span class="flex items-center gap-2">
                <!-- La priorité tient dans un point : la pastille redisait un
                     rang que la couleur suffit à porter (§ 8, P6.35). -->
                <UiHoverBubble :label="`Priorité ${race.priority}`">
                  <template #trigger>
                    <span
                      class="size-[7px] rounded-full"
                      :class="PRIORITY_TONES[race.priority] ?? 'bg-line-strong'"
                    />
                  </template>
                  <span class="label text-[10px]">Priorité {{ race.priority }}</span>
                  <span class="text-[12.5px] leading-[1.45] text-text-dim">
                    {{ GLOSSARY.priorite.text }}
                  </span>
                </UiHoverBubble>
                {{ race.name }}
              </span>
            </td>
            <td class="mono py-[10px] text-text-dim">{{ formatDate(race.date) }}</td>
            <td class="mono py-[10px] text-text-dim">{{ formatDistance(race.distanceM) }}</td>
            <td class="mono py-[10px]">
              <!-- « À fixer » n'est pas un état, c'est une action qui attend (§ 9, P5.10). -->
              <button
                v-if="race.objectiveToSet"
                type="button"
                class="text-accent underline decoration-dotted underline-offset-2"
                @click.stop="ui.openModal('course', race.id)"
              >
                à fixer
              </button>
              <span v-else class="text-text-dim">
                <template v-if="race.objectiveMode === 'record'">record </template>
                {{
                  formatDuration(race.objectiveMode === 'record' ? race.recordS : race.objectifS)
                }}
              </span>
              <span class="mx-1 text-text-dim">→</span>
              {{ formatDuration(race.projectionS) }}
              <span
                v-if="race.gapS !== null"
                :class="race.gapS > 0 ? 'text-warn' : 'text-ok'"
                class="ml-1"
              >
                {{ formatSignedDuration(race.gapS) }}
              </span>
            </td>
            <td class="mono py-[10px] text-text-dim">
              {{ race.confidencePct === null ? '—' : `${race.confidencePct} %` }}
            </td>
          </tr>
          <tr v-if="upcoming.length === 0">
            <td colspan="5" class="py-3 text-text-dim">Aucune course planifiée.</td>
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
          <span class="mono text-[11.5px] text-text-dim">{{ formatDate(race.date) }}</span>
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

    <Teleport to="body">
      <ShellAppModal
        v-if="ui.modal === 'nouvelle-course'"
        title="Nouvelle course"
        :width="1040"
        @close="ui.closeModal()"
      >
        <template #skeleton>
          <DialogsDialogSkeleton modal="nouvelle-course" />
        </template>

        <RacesNewRaceWindow @created="onCreated" />
      </ShellAppModal>
    </Teleport>
  </div>
</template>
