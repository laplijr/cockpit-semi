<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

/**
 * La séance du jour est l'objet le plus important de l'écran (§ 8, P6.35) :
 * son nom à 38 px et trois chiffres, rien d'autre. La zone est un bouton et
 * « Ressenti » reste à côté — pas de bouton dans un bouton.
 */
const props = defineProps<{ session: PlanSession }>()

const ui = useUiStore()
const plan = usePlanStore()

const sport = computed(() => sportStyle(props.session.sport))

const label = computed(() => SESSION_LABELS[props.session.code] ?? props.session.code)

const minutes = computed(() => prescribedMinutes(props.session.prescription))

/** Une séance sans kilométrage se lit en durée seule : vélo et muscu. */
const distance = computed(() =>
  props.session.prescription.totalDistanceM > 0
    ? formatDistance(props.session.prescription.totalDistanceM)
    : '—',
)

/** L'allure de l'étape la plus longue : celle qui donne le ton de la séance. */
const pace = computed(() => {
  const paced = props.session.prescription.steps
    .filter((step) => step.paceSecPerKm)
    .sort((a, b) => (b.distanceM ?? b.durationS ?? 0) - (a.distanceM ?? a.durationS ?? 0))

  return paced[0]?.paceSecPerKm ? `${formatPace(paced[0].paceSecPerKm)}/km` : '—'
})

const done = computed(() => props.session.status === 'faite')

/**
 * Une séance faite se lit par ce qui a été couru, pas par ce qui avait été
 * demandé : les trois chiffres passent au réalisé et le prescrit descend
 * dessous, en gris, seulement là où il diffère (§ 8, P7.4). Sans mesure, rien
 * ne change — on ne montre pas ce qu'on n'a pas.
 */
const measured = computed(
  () =>
    done.value &&
    (props.session.actualDistanceM !== null || props.session.actualDurationMin !== null),
)

/** L'allure tenue se déduit du réalisé ; il faut les deux mesures. */
const actualPace = computed(() => {
  const { actualDistanceM, actualDurationMin } = props.session
  if (!actualDistanceM || !actualDurationMin) return null
  return (actualDurationMin * 60) / (actualDistanceM / 1000)
})

interface Figure {
  key: string
  label: string
  value: string
  /** Valeur prescrite, quand elle n'est plus celle qu'on affiche. */
  planned?: string
}

const figures = computed<Figure[]>(() => {
  const planned = [
    { key: 'distance', label: 'distance', value: distance.value },
    { key: 'duree', label: 'durée', value: formatMinutes(minutes.value) },
    { key: 'allure', label: 'allure cible', value: pace.value },
  ]

  if (!measured.value) return planned

  const actual = [
    {
      key: 'distance',
      label: 'distance',
      value:
        props.session.actualDistanceM === null
          ? distance.value
          : formatDistance(props.session.actualDistanceM),
    },
    {
      key: 'duree',
      label: 'durée',
      value: formatMinutes(props.session.actualDurationMin ?? minutes.value),
    },
    {
      key: 'allure',
      label: 'allure tenue',
      value: actualPace.value === null ? pace.value : `${formatPace(actualPace.value)}/km`,
    },
  ]

  return actual.map((figure, index) => {
    const before = planned[index]!
    return figure.value === before.value ? figure : { ...figure, planned: before.value }
  })
})

/**
 * Courir la séance depuis l'app (§ 9, P10). L'action principale de la ligne
 * change avec l'état du jour : « Courir » prend la place, et « Ressenti »
 * recule d'un cran — la capture pose le ressenti à l'arrivée. Rien n'est
 * ajouté à l'écran, c'est le rang des gestes qui change (§ 11).
 */
const runnable = computed(
  () =>
    props.session.sport === 'course' &&
    props.session.date === plan.today &&
    !done.value &&
    props.session.status !== 'annulee',
)

/** Sortie en cours côté serveur : elle se reprend au lieu d'en ouvrir une autre. */
const { data: liveRun } = useFetch<{
  run: { id: number; sessionId: number | null; distanceM: number } | null
}>('/api/runs/live', { lazy: true, server: false, default: () => ({ run: null }) })

const live = computed(() =>
  liveRun.value?.run?.sessionId === props.session.id ? liveRun.value.run : null,
)

/**
 * Sortie finie sur cet appareil mais pas enregistrée — le réseau a refusé.
 * Seul l'appareil qui l'a courue le sait : la trace y est, pas ailleurs.
 */
const pending = ref(false)
onMounted(() => {
  const stored = storedRun()
  pending.value = stored?.sessionId === props.session.id && stored.finished
})

const runHref = computed(() => {
  const base = `/en-course?seance=${props.session.id}`
  if (pending.value) return `${base}&reprise=1&bilan=1`
  return live.value ? `${base}&reprise=1` : base
})
</script>

<template>
  <!-- Une seule ligne au clavier, quatre au pouce : l'ordre ne change pas,
       c'est la ligne qui se replie (§ 8, P6.8). -->
  <div class="flex flex-col gap-2 lean:flex-row lean:items-center lean:gap-3">
    <button
      type="button"
      class="tile-action flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-transparent px-2 py-2 text-left lean:flex-nowrap lean:gap-4"
      @click="ui.openModal('seance', session.id)"
    >
      <UiAppIcon
        :name="sport.icon"
        :size="22"
        :class="sport.tone"
        :label="SPORT_LABELS[session.sport] ?? session.sport"
      />

      <!-- `truncate` rogne l'overflow : sans interligne, les jambages du nom
           sont coupés en haut et en bas (§ 8, P6.35). -->
      <span
        class="display min-w-0 flex-1 truncate text-[26px] leading-[1.15] font-semibold lean:text-[38px]"
      >
        {{ label }}
      </span>

      <span v-if="session.key" class="pill shrink-0 bg-accent/15 text-accent">clé</span>
      <span v-if="done" class="pill pill-done shrink-0">faite</span>
      <span v-else-if="session.status === 'sautee'" class="pill shrink-0">manquée</span>

      <span class="flex w-full shrink-0 justify-between gap-5 lean:w-auto lean:justify-start">
        <span
          v-for="figure in figures"
          :key="figure.key"
          class="flex flex-col items-start lean:items-end"
        >
          <span class="mono text-[17px]">{{ figure.value }}</span>
          <span class="label text-[9.5px]">{{ figure.label }}</span>
          <span v-if="figure.planned" class="mono text-[10.5px] text-text-dim">
            prévu {{ figure.planned }}
          </span>
        </span>
      </span>
    </button>

    <!-- Une seule action principale par ligne : quand il y a une sortie à
         courir, c'est elle, et le ressenti passe en fantôme (§ 8). -->
    <NuxtLink v-if="runnable" :to="runHref" class="btn w-full shrink-0 lean:w-auto">
      <UiAppIcon name="run" :size="15" />
      <template v-if="pending">Terminer l'enregistrement</template>
      <template v-else-if="live">Reprendre · {{ formatDistance(live.distanceM) }}</template>
      <template v-else>Courir</template>
    </NuxtLink>

    <button
      type="button"
      class="btn w-full shrink-0 lean:w-auto"
      :class="(done || runnable) && 'btn-ghost'"
      @click="ui.openModal('seance', session.id)"
    >
      Ressenti
    </button>
  </div>
</template>
