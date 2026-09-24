<script setup lang="ts">
import {
  GymSetKind,
  useGymSession,
  type GymExerciseState,
  type GymSet,
} from '~/composables/useGymSession'

/**
 * La séance de renforcement en salle, au téléphone (P27) : hors coque comme
 * `/en-course`, un exercice à la fois. Série, précédent, kilos, répétitions,
 * coche ; la réserve en un tap ; la récup lancée à la coche. Le cinquième
 * geste du téléphone (§ 8).
 */
definePageMeta({ layout: false })

const route = useRoute()
const ui = useUiStore()
const plan = usePlanStore()
const sessionId = Number(route.params.id)

onMounted(() => plan.ensureLoaded())

const session = computed(() => plan.plan?.sessions.find((item) => item.id === sessionId))

const { data } = useFetch<{ exercises: GymExerciseState[] }>(
  `/api/sessions/${sessionId}/strength`,
  { server: false, default: () => ({ exercises: [] }) },
)
const states = computed(() => data.value?.exercises ?? [])

const gym = useGymSession(session, states)

/** L'exercice affiché : celui de la série en cours, sauf quand on feuillette. */
const browsed = ref<number | null>(null)
const shownIndex = computed(() => {
  if (browsed.value !== null) return browsed.value
  const set = gym.currentSet.value
  if (!set) return Math.max(0, gym.exercises.value.length - 1)
  return gym.exercises.value.findIndex((item) => item.exerciseId === set.exerciseId)
})
const shown = computed(() => gym.exercises.value[shownIndex.value])

const doneExercises = computed(
  () => gym.exercises.value.filter((item) => item.sets.every((set) => set.done)).length,
)

/** Le temps écoulé, gardé sur l'appareil : un rechargement ne le remet pas à zéro. */
const elapsedS = ref(0)
let clock: ReturnType<typeof setInterval> | undefined
function startedAt(): number {
  const key = `en-salle:${sessionId}`
  try {
    const stored = Number(localStorage.getItem(key))
    if (stored > 0) return stored
    const now = Date.now()
    localStorage.setItem(key, String(now))
    return now
  } catch {
    return Date.now()
  }
}

/** L'écran reste allumé ; un refus du navigateur se tolère. */
let wakeLock: WakeLockSentinel | null = null
async function keepAwake() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen')
  } catch {
    wakeLock = null
  }
}
const onVisible = () => document.visibilityState === 'visible' && keepAwake()

onMounted(() => {
  const start = startedAt()
  clock = setInterval(() => {
    elapsedS.value = Math.round((Date.now() - start) / 1000)
    tickRest()
  }, 1000)
  keepAwake()
  document.addEventListener('visibilitychange', onVisible)
})

onBeforeUnmount(() => {
  clearInterval(clock)
  document.removeEventListener('visibilitychange', onVisible)
  void wakeLock?.release()
})

/** La récup : lancée à la coche, pour la durée que fixe la nature de l'effort. */
const restLeftS = ref(0)
const resting = computed(() => restLeftS.value > 0)
let audio: AudioContext | null = null

function tickRest() {
  if (restLeftS.value <= 0) return
  restLeftS.value -= 1
  if (restLeftS.value === 0) beep()
}

/** Un son court à la fin de la récup, si le navigateur le permet. */
function beep() {
  if (!audio || audio.state !== 'running') return
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.frequency.value = 880
  gain.gain.value = 0.15
  oscillator.connect(gain).connect(audio.destination)
  oscillator.start()
  oscillator.stop(audio.currentTime + 0.2)
}

function unlockSound() {
  try {
    audio ??= new AudioContext()
    void audio.resume()
  } catch {
    audio = null
  }
}

const RESERVES = [0, 1, 2, 3, 4]
const asking = ref<string | null>(null)
const error = ref('')

async function tapCheck(set: GymSet) {
  unlockSound()
  error.value = ''
  if (set.done) {
    await gym.uncheck(sessionId, set)
    return
  }
  if (set.kind === GymSetKind.Warmup) {
    set.done = true
    return
  }
  asking.value = set.key
}

async function chooseReserve(set: GymSet, reserve: number) {
  try {
    await gym.check(sessionId, set, reserve)
    asking.value = null
    browsed.value = null
    restLeftS.value = gym.recoveryAfter(set)
  } catch (failure) {
    error.value = apiMessage(failure, 'Série non enregistrée : réessaie.')
  }
}

function copyPrevious(set: GymSet) {
  if (!set.previous || set.done) return
  set.loadKg = set.previous.loadKg
  set.reps = set.previous.reps
}

function browse(offset: number) {
  const next = shownIndex.value + offset
  if (next < 0 || next >= gym.exercises.value.length) return
  browsed.value = next
}

/** « Terminer » ouvre le retour de séance existant ; une fois fait, on rentre. */
function finish() {
  ui.openModal('seance', sessionId)
}
watch(
  () => session.value?.status,
  (status) => {
    if (status === 'faite') navigateTo('/')
  },
)

const setLabel = (set: GymSet) => (set.kind === GymSetKind.Warmup ? 'É' : String(set.index))
const previousText = (set: GymSet) =>
  set.previous ? `${formatDecimal(set.previous.loadKg)} × ${set.previous.reps}` : '—'
</script>

<template>
  <div
    class="flex min-h-dvh flex-col gap-3 bg-ink px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))] lean:mx-auto lean:max-w-[720px]"
  >
    <div class="flex items-center gap-3">
      <NuxtLink
        to="/"
        class="tap -ml-2 inline-flex h-11 items-center gap-2 px-2 text-body text-text-dim"
      >
        <UiAppIcon name="chevron" :size="18" class="rotate-180" />
        Cockpit
      </NuxtLink>
      <span class="mono ml-auto text-copy text-text-dim">{{ formatDuration(elapsedS) }}</span>
    </div>

    <template v-if="shown">
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="tap btn btn-ghost size-11 shrink-0 p-0"
            aria-label="Exercice précédent"
            :disabled="shownIndex === 0"
            @click="browse(-1)"
          >
            <UiAppIcon name="chevron" :size="16" class="rotate-180" />
          </button>
          <div class="flex min-w-0 flex-1 flex-col">
            <h1 class="display truncate text-display-s font-semibold">{{ shown.label }}</h1>
            <span class="mono text-meta text-text-dim">
              {{ shownIndex + 1 }} / {{ gym.exercises.value.length }}
              <template v-if="shown.step.superset"> · superset</template>
            </span>
          </div>
          <button
            type="button"
            class="tap btn btn-ghost size-11 shrink-0 p-0"
            aria-label="Exercice suivant"
            :disabled="shownIndex === gym.exercises.value.length - 1"
            @click="browse(1)"
          >
            <UiAppIcon name="chevron" :size="16" />
          </button>
        </div>
        <!-- La barre des exercices : combien sont finis sur la séance. -->
        <span class="block h-[3px] rounded-sm bg-accent-track">
          <span
            class="block h-full rounded-sm bg-accent"
            :style="{ width: `${(doneExercises / gym.exercises.value.length) * 100}%` }"
          />
        </span>
      </div>

      <div class="flex items-center gap-4">
        <UiExerciseFigure
          :exercise-id="shown.exerciseId"
          :tempo="shown.step.tempo"
          :hold-s="shown.step.isometric ? shown.step.reps : undefined"
          :width="72"
          class="shrink-0"
        />
        <div class="flex min-w-0 flex-col gap-2">
          <span v-if="tempoWords(shown.step.tempo)" class="mono text-meta text-text-dim">
            {{ tempoWords(shown.step.tempo) }}
          </span>
          <button
            type="button"
            class="btn btn-ghost self-start"
            @click="ui.openExercise(shown.exerciseId)"
          >
            Comment faire
          </button>
        </div>
      </div>

      <!-- Série, précédent, kilos, répétitions, coche. Les échauffements sont
           marqués É et ne s'enregistrent pas. -->
      <div class="tile bg-surface-inset">
        <div class="grid grid-cols-[34px_minmax(0,1fr)_72px_56px_44px] items-center gap-2">
          <span class="label text-caption">Série</span>
          <span class="label text-caption">Précédent</span>
          <span class="label text-caption">Kg</span>
          <span class="label text-caption">Rép.</span>
          <span />
          <template v-for="set in shown.sets" :key="set.key">
            <span class="mono text-body" :class="set.kind === GymSetKind.Warmup && 'text-text-dim'">
              {{ setLabel(set) }}
            </span>
            <button
              type="button"
              class="tap mono text-left text-meta text-text-dim"
              :disabled="!set.previous || set.done"
              @click="copyPrevious(set)"
            >
              {{ previousText(set) }}
            </button>
            <input
              :id="`kg-${set.key}`"
              v-model.number="set.loadKg"
              type="number"
              inputmode="decimal"
              step="0.5"
              min="0"
              class="input mono px-2"
              :disabled="set.done"
            />
            <input
              :id="`reps-${set.key}`"
              v-model.number="set.reps"
              type="number"
              inputmode="numeric"
              min="0"
              class="input mono px-2"
              :disabled="set.done"
            />
            <button
              type="button"
              class="tap flex size-11 items-center justify-center rounded-md border"
              :class="set.done ? 'border-ok bg-ok/15 text-ok' : 'border-line text-text-dim'"
              :aria-label="set.done ? 'Décocher la série' : 'Cocher la série'"
              @click="tapCheck(set)"
            >
              <UiAppIcon name="check" :size="18" />
            </button>

            <!-- La réserve en un tap, dès la coche : elle règle la série suivante. -->
            <div v-if="asking === set.key" class="col-span-5 flex flex-col gap-2 pb-1">
              <span class="label text-caption">
                <UiInfoHint term="reserve">Combien en réserve ?</UiInfoHint>
              </span>
              <div class="grid grid-cols-5 gap-2">
                <UiActionButton
                  v-for="reserve in RESERVES"
                  :key="reserve"
                  class="btn btn-ghost mono"
                  :action="() => chooseReserve(set, reserve)"
                >
                  {{ reserve === 4 ? '4+' : reserve }}
                </UiActionButton>
              </div>
            </div>

            <!-- Proposé, jamais appliqué seul : la série suivante s'accepte d'un tap. -->
            <button
              v-if="set.proposal && !set.done"
              type="button"
              class="tap col-span-5 text-left text-meta text-accent"
              @click="gym.accept(set)"
            >
              {{ formatLoad(set.proposal.loadKg) }} proposé : {{ set.proposal.reason }} — accepter
            </button>
          </template>
        </div>
        <p v-if="error" class="text-body text-warn">{{ error }}</p>
      </div>
    </template>

    <div v-else class="flex flex-1 flex-col gap-3" aria-busy="true">
      <UiSkeleton :height="28" width="60%" />
      <UiSkeleton variant="block" :height="220" />
    </div>

    <!-- La récup et « Terminer » vivent au pied de l'écran, au-dessus de la zone sûre. -->
    <div
      class="sticky bottom-0 z-10 -mx-4 mt-auto -mb-[calc(16px+env(safe-area-inset-bottom))] flex flex-col gap-2 border-t border-line bg-ink px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]"
    >
      <div v-if="resting" class="flex items-center gap-2">
        <span class="label text-caption">Récup</span>
        <span class="mono text-display-s font-semibold">{{ formatSeconds(restLeftS) }}</span>
        <button
          type="button"
          class="btn btn-ghost ml-auto"
          @click="restLeftS = Math.max(1, restLeftS - 15)"
        >
          − 15″
        </button>
        <button type="button" class="btn btn-ghost" @click="restLeftS += 15">+ 15″</button>
        <button type="button" class="btn btn-ghost" @click="restLeftS = 0">Passer</button>
      </div>
      <button
        type="button"
        class="btn btn-lg w-full"
        :class="!gym.finished.value && 'btn-ghost'"
        @click="finish"
      >
        Terminer
      </button>
    </div>

    <ShellModalHost />
  </div>
</template>
