import type { PlanSession } from '~/stores/plan'
import { LOAD_IMPLEMENTS } from '~~/server/domain/strength/estimated-max'
import {
  adjustNextSet,
  rpeFromReserve,
  warmupSets,
  type SetAdjustment,
} from '~~/server/domain/strength/next-set'

/** Ce que `GET /api/sessions/[id]/strength` rend pour un exercice. */
export interface GymExerciseState {
  exerciseId: string
  targetReps: number
  suggestedLoadKg: number | null
  reserve: number | null
  previousSets: { index: number; reps: number; loadKg: number }[]
  recordedSets: { index: number; reps: number; loadKg: number; rpe: number }[]
  calibratedToday: boolean
}

export enum GymSetKind {
  Warmup = 'echauffement',
  Work = 'travail',
}

export interface GymSet {
  key: string
  exerciseId: string
  kind: GymSetKind
  /** Rang de la série de travail, à partir de 1 ; celui de l'échauffement dans ses séries. */
  index: number
  targetReps: number
  loadKg: number
  reps: number
  done: boolean
  previous: { reps: number; loadKg: number } | null
  proposal: SetAdjustment | null
}

type Step = PlanSession['prescription']['steps'][number]

export interface GymExercise {
  exerciseId: string
  label: string
  step: Step
  sets: GymSet[]
}

/**
 * Une séance de renforcement faite en salle, au téléphone (P27). Les séries
 * s'enregistrent une à une : l'état vit sur le serveur, et la séance reprend
 * à la première série non cochée. En superset, les deux exercices
 * alternent et la récup vient après le second.
 */
export function useGymSession(
  session: Ref<PlanSession | undefined>,
  states: Ref<GymExerciseState[]>,
) {
  const exercises = ref<GymExercise[]>([])

  watch(
    [session, states],
    ([current, list]) => {
      if (!current || list.length === 0) return
      exercises.value = current.prescription.steps
        .filter(
          (step) => step.exerciseId && list.some((item) => item.exerciseId === step.exerciseId),
        )
        .map((step) =>
          build(
            step,
            list.find((item) => item.exerciseId === step.exerciseId)!,
          ),
        )
    },
    { immediate: true },
  )

  /** L'ordre où les séries se font : les supersets s'entrelacent, A1 B1 A2 B2. */
  const order = computed<GymSet[]>(() => {
    const result: GymSet[] = []
    const list = exercises.value
    for (let position = 0; position < list.length; position++) {
      const current = list[position]!
      const partner = list[position + 1]
      if (current.step.superset && partner?.step.superset === current.step.superset) {
        const rounds = Math.max(current.sets.length, partner.sets.length)
        for (let round = 0; round < rounds; round++) {
          if (current.sets[round]) result.push(current.sets[round]!)
          if (partner.sets[round]) result.push(partner.sets[round]!)
        }
        position++
        continue
      }
      result.push(...current.sets)
    }
    return result
  })

  const currentSet = computed(() => order.value.find((set) => !set.done) ?? null)
  const finished = computed(() => exercises.value.length > 0 && currentSet.value === null)

  const exerciseOf = (set: GymSet) =>
    exercises.value.find((item) => item.exerciseId === set.exerciseId)!

  /** La récup vient après la série, sauf quand la suivante est celle du partenaire de superset. */
  function recoveryAfter(set: GymSet): number {
    const next = order.value[order.value.indexOf(set) + 1]
    const exercise = exerciseOf(set)
    if (set.kind === GymSetKind.Warmup) return 0
    if (next && next.exerciseId !== set.exerciseId && exercise.step.superset) {
      const partner = exerciseOf(next)
      if (partner.step.superset === exercise.step.superset) return 0
    }
    return exercise.step.recoveryS ?? 0
  }

  async function check(sessionId: number, set: GymSet, reserve: number) {
    await $fetch(`/api/sessions/${sessionId}/strength/sets`, {
      method: 'PUT',
      body: {
        exerciseId: set.exerciseId,
        index: set.index,
        reps: set.reps,
        loadKg: set.loadKg,
        rpe: rpeFromReserve(reserve),
      },
    })
    set.done = true
    const following = exerciseOf(set).sets.find(
      (item) => item.kind === GymSetKind.Work && item.index === set.index + 1,
    )
    if (following && !following.done) {
      following.proposal = adjustNextSet(
        { loadKg: set.loadKg, reps: set.reps, targetReps: set.targetReps, reserve },
        set.index,
        LOAD_IMPLEMENTS[set.exerciseId],
      )
    }
  }

  async function uncheck(sessionId: number, set: GymSet) {
    if (set.kind === GymSetKind.Work) {
      await $fetch(`/api/sessions/${sessionId}/strength/sets`, {
        method: 'DELETE',
        query: { exerciseId: set.exerciseId, index: set.index },
      })
    }
    set.done = false
  }

  function accept(set: GymSet) {
    if (!set.proposal) return
    set.loadKg = set.proposal.loadKg
    set.proposal = null
  }

  return {
    exercises,
    order,
    currentSet,
    finished,
    exerciseOf,
    recoveryAfter,
    check,
    uncheck,
    accept,
  }
}

function build(step: Step, state: GymExerciseState): GymExercise {
  const workLoad = state.suggestedLoadKg ?? state.previousSets.at(-1)?.loadKg ?? 0
  const alreadyWorking = state.recordedSets.length > 0
  const warmups = warmupSets(
    LOAD_IMPLEMENTS[state.exerciseId],
    step.intensity,
    workLoad || null,
    state.calibratedToday,
  ).map<GymSet>((warmup, position) => ({
    key: `${state.exerciseId}-e${position}`,
    exerciseId: state.exerciseId,
    kind: GymSetKind.Warmup,
    index: position + 1,
    targetReps: warmup.reps,
    loadKg: warmup.loadKg,
    reps: warmup.reps,
    /** Une séance reprise en cours d'exercice ne redemande pas l'échauffement. */
    done: alreadyWorking,
    previous: null,
    proposal: null,
  }))

  const work = Array.from({ length: step.repeats ?? 1 }, (_, position): GymSet => {
    const index = position + 1
    const recorded = state.recordedSets.find((set) => set.index === index)
    const previous = state.previousSets.find((set) => set.index === index) ?? null
    return {
      key: `${state.exerciseId}-${index}`,
      exerciseId: state.exerciseId,
      kind: GymSetKind.Work,
      index,
      targetReps: state.targetReps,
      loadKg: recorded?.loadKg ?? workLoad,
      reps: recorded?.reps ?? state.targetReps,
      done: recorded !== undefined,
      previous: previous ? { reps: previous.reps, loadKg: previous.loadKg } : null,
      proposal: null,
    }
  })

  return { exerciseId: state.exerciseId, label: step.label, step, sets: [...warmups, ...work] }
}
