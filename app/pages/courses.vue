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

const { data: races } = await useFetch('/api/races')

/**
 * Trois états et non deux : une course dont le jour est passé n'est plus « à
 * venir », elle attend son chrono (§ 9, P6.41). Le serveur tranche, avec son
 * horloge : l'écran ne redit pas la règle.
 */
const planned = computed(() => (races.value ?? []).filter((race) => race.status === 'planifiee'))
const upcoming = computed(() => planned.value.filter((race) => !race.awaitingResult))
const toRecord = computed(() => (races.value ?? []).filter((race) => race.awaitingResult))
const past = computed(() => (races.value ?? []).filter((race) => race.status !== 'planifiee'))

await plan.ensureLoaded()
</script>

<template>
  <div class="flex flex-col gap-4">
    <!--
      Le cap passe en tête : on voit d'abord où l'on va, la table dit ensuite
      avec quoi (arbitré avec Ronan, § 9, P6.37 — P5.16 l'avait écrit, le code
      disait l'inverse).
    -->
    <!-- Le ruban ne montre que ce qui est devant : une course A datée d'hier
         tenait le cap avec un J− à l'envers (§ 9, P7.5). -->
    <RacesSeasonBoard
      :phases="plan.plan?.phases ?? []"
      :weeks="plan.plan?.weeks ?? []"
      :races="upcoming"
      :today="plan.today"
      :dated="!plan.awaitingResumption"
      :loading="!plan.loaded"
    />

    <div v-if="toRecord.length > 0" class="tile">
      <span class="label">À renseigner</span>
      <p class="text-[12.5px] text-text-dim">
        Ces courses ont eu lieu. Leur chrono recale le VDOT, les records et les projections.
      </p>
      <button
        v-for="race in toRecord"
        :key="race.id"
        type="button"
        class="tap tile-action -mx-2 flex flex-col gap-1 rounded-md border border-transparent border-t-line-soft px-2 py-3 text-left first:border-t-transparent lean:flex-row lean:items-baseline lean:gap-3"
        @click="ui.openModal('course', race.id)"
      >
        <span class="display text-[15px] font-semibold">{{ race.name }}</span>
        <span class="mono text-[11.5px] text-text-dim">{{ formatDate(race.date) }}</span>
        <span class="mono text-[11.5px] text-text-dim">{{ formatDistance(race.distanceM) }}</span>
        <span class="text-[12.5px] text-accent lean:ml-auto">Renseigner le résultat</span>
      </button>
    </div>

    <div class="tile">
      <div class="flex items-center gap-3">
        <span class="label">Courses à venir</span>
        <button
          type="button"
          class="btn btn-ghost ml-auto px-[10px] text-[12px] wide:h-7"
          @click="ui.openModal('nouvelle-course')"
        >
          <UiAppIcon name="plus" :size="14" />
          Ajouter
        </button>
      </div>
      <!--
        Cinq colonnes ne tiennent pas dans 354 px : sous la rupture, une course
        devient une carte — nom et date en tête, le reste en paires
        libellé-valeur (§ 8, P6.8). C'est la seule table de l'app qui change de
        forme plutôt que de défiler : les autres portent des lignes courtes,
        celle-ci porte une décision par ligne.
      -->
      <table class="hidden w-full text-[13px] lean:table">
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
            <td class="py-[10px]">
              <RacesObjectiveCell :race="race" />
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
      <div class="flex flex-col lean:hidden">
        <button
          v-for="race in upcoming"
          :key="race.id"
          type="button"
          class="tile-action -mx-2 flex flex-col gap-2 rounded-md border border-transparent border-t-line-soft px-2 py-3 text-left first:border-t-transparent"
          @click="ui.openModal('course', race.id)"
        >
          <span class="flex items-baseline gap-2">
            <span
              class="size-[7px] shrink-0 self-center rounded-full"
              :class="PRIORITY_TONES[race.priority] ?? 'bg-line-strong'"
            />
            <span class="display text-[17px] font-semibold">{{ race.name }}</span>
            <span class="mono ml-auto text-[11.5px] text-text-dim">
              {{ formatDate(race.date) }}
            </span>
          </span>

          <span class="flex items-baseline gap-2 text-[12.5px]">
            <span class="label text-[10px]">Distance</span>
            <span class="mono ml-auto">{{ formatDistance(race.distanceM) }}</span>
          </span>
          <span class="flex items-baseline gap-2 text-[12.5px]">
            <span class="label text-[10px]">Objectif → projection</span>
            <RacesObjectiveCell :race="race" class="ml-auto text-right" />
          </span>
          <span class="flex items-baseline gap-2 text-[12.5px]">
            <span class="label text-[10px]">Confiance</span>
            <span class="mono ml-auto text-text-dim">
              {{ race.confidencePct === null ? '—' : `${race.confidencePct} %` }}
            </span>
          </span>
        </button>

        <p v-if="upcoming.length === 0" class="py-3 text-[13px] text-text-dim">
          Aucune course planifiée.
        </p>
      </div>
    </div>

    <!-- La tuile s'affiche toujours, vide comprise : sinon la porte n'existe
         pas le premier jour, celui où elle sert le plus (§ 9, P7.5). -->
    <div class="tile">
      <div class="flex items-center gap-3">
        <span class="label">Courses passées</span>
        <button
          type="button"
          class="btn btn-ghost ml-auto px-[10px] text-[12px] wide:h-7"
          @click="ui.openModal('course-passee')"
        >
          <UiAppIcon name="plus" :size="14" />
          Ajouter
        </button>
      </div>
      <p v-if="past.length === 0" class="text-[13px] text-text-dim">Aucune course enregistrée.</p>
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
  </div>
</template>
