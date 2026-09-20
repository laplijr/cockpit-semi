import { Decoder, Encoder, Profile, Stream } from '@garmin/fitsdk'
import type { Encodable, FileIdMesg, WorkoutMesg, WorkoutStepMesg } from '@garmin/fitsdk'
import {
  WorkoutStepKind,
  type StructuredWorkout,
  type WorkoutStep,
} from '../../domain/watch/workout'

/**
 * Encode une séance structurée en fichier `.FIT` de type workout (§ 9, P6.7).
 * Aucune logique d'entraînement ici : ce module ne sait que traduire.
 *
 * Deux pièges du SDK Garmin, vérifiés à l'aller-retour : l'encodeur **ignore**
 * les sous-champs mis à l'échelle (`durationTime`, `customTargetSpeedLow`…),
 * il faut écrire les champs principaux dans leur unité brute ; et une étape de
 * répétition pointe **en arrière**, vers l'index de la première étape du bloc.
 */

/** `duration_value` en millisecondes pour une durée, en centimètres pour une distance. */
const MS_PER_S = 1000
const CM_PER_M = 100
/** `custom_target_value_*` en millimètres par seconde. */
const MM_PER_M = 1000

/**
 * Fenêtre d'allure autour de la cible. Une montre veut une plage : sur une
 * valeur unique elle sonnerait à chaque foulée.
 */
export const PACE_WINDOW_S_PER_KM = 5

/** Fabricant « development » : le fichier ne prétend pas venir d'un appareil Garmin. */
const MANUFACTURER = 'development'

/** Numéros de message, figés depuis le profil du SDK : la table les rend optionnels. */
const FILE_ID_MESG = Profile.MesgNum.FILE_ID as number
const WORKOUT_MESG = Profile.MesgNum.WORKOUT as number
const WORKOUT_STEP_MESG = Profile.MesgNum.WORKOUT_STEP as number

const INTENSITY: Record<WorkoutStepKind, WorkoutStepMesg['intensity']> = {
  [WorkoutStepKind.Warmup]: 'warmup',
  [WorkoutStepKind.Active]: 'active',
  [WorkoutStepKind.Recovery]: 'rest',
  [WorkoutStepKind.Cooldown]: 'cooldown',
}

function speedFromPace(paceSecPerKm: number): number {
  return (1000 / paceSecPerKm) * MM_PER_M
}

function durationOf(step: WorkoutStep): Partial<WorkoutStepMesg> {
  if (step.durationS !== undefined) {
    return { durationType: 'time', durationValue: Math.round(step.durationS * MS_PER_S) }
  }
  if (step.distanceM !== undefined) {
    return { durationType: 'distance', durationValue: Math.round(step.distanceM * CM_PER_M) }
  }
  /** Sans cible, l'étape dure jusqu'à ce que le coureur appuie sur le bouton. */
  return { durationType: 'open' }
}

/**
 * Cible d'une étape. Sans allure prescrite — les côtes, la récupération —, la
 * montre reste libre et l'effort visé part en note : une côte ne se court pas
 * à une allure de plaine (§ 5, P1.5).
 */
function targetOf(step: WorkoutStep): Partial<WorkoutStepMesg> {
  if (step.paceSecPerKm === undefined) {
    return step.rpe === undefined
      ? { targetType: 'open' }
      : { targetType: 'open', notes: `Effort visé : RPE ${step.rpe}` }
  }

  return {
    targetType: 'speed',
    /** Zone 0 : la cible est celle qu'on donne, pas une zone de la montre. */
    targetValue: 0,
    customTargetValueLow: Math.round(speedFromPace(step.paceSecPerKm + PACE_WINDOW_S_PER_KM)),
    customTargetValueHigh: Math.round(speedFromPace(step.paceSecPerKm - PACE_WINDOW_S_PER_KM)),
  }
}

/** Les blocs aplatis en étapes FIT, chaque répétition suivie de son renvoi en arrière. */
function fitSteps(workout: StructuredWorkout): Encodable<WorkoutStepMesg>[] {
  const steps: Encodable<WorkoutStepMesg>[] = []

  for (const block of workout.blocks) {
    const firstIndex = steps.length

    for (const step of block.steps) {
      steps.push({
        mesgNum: WORKOUT_STEP_MESG,
        messageIndex: steps.length,
        wktStepName: step.label,
        intensity: INTENSITY[step.kind],
        ...durationOf(step),
        ...targetOf(step),
      })
    }

    if (block.repeats <= 1) continue

    steps.push({
      mesgNum: WORKOUT_STEP_MESG,
      messageIndex: steps.length,
      durationType: 'repeatUntilStepsCmplt',
      durationValue: firstIndex,
      targetType: 'open',
      targetValue: block.repeats,
    })
  }

  return steps
}

export function encodeWorkout(workout: StructuredWorkout, createdAt: Date): Uint8Array {
  const encoder = new Encoder()
  const steps = fitSteps(workout)

  const fileId: Encodable<FileIdMesg> = {
    mesgNum: FILE_ID_MESG,
    type: 'workout',
    manufacturer: MANUFACTURER,
    product: 1,
    serialNumber: 1,
    timeCreated: createdAt,
  }

  const header: Encodable<WorkoutMesg> = {
    mesgNum: WORKOUT_MESG,
    wktName: workout.name,
    sport: 'running',
    numValidSteps: steps.length,
  }

  encoder.writeMesg(fileId)
  encoder.writeMesg(header)
  for (const step of steps) encoder.writeMesg(step)

  return encoder.close()
}

export interface DecodedWorkoutStep {
  name: string | undefined
  intensity: string | undefined
  durationType: string | undefined
  durationS: number | undefined
  distanceM: number | undefined
  paceSecPerKm: number | undefined
  repeats: number | undefined
  notes: string | undefined
}

export interface DecodedWorkout {
  name: string | undefined
  steps: DecodedWorkoutStep[]
}

/** Allure moyenne de la plage annoncée, en secondes par kilomètre. */
function paceFromSpeeds(low: number | undefined, high: number | undefined) {
  if (low === undefined || high === undefined) return undefined
  return Math.round(1000 / ((low + high) / 2))
}

/**
 * Relit un `.FIT` de type workout. Elle existe pour l'aller-retour : c'est le
 * décodeur qui dit si l'encodeur a écrit ce qu'on croit (§ 9, P6.7).
 */
export function decodeWorkout(bytes: Uint8Array): DecodedWorkout {
  const decoder = new Decoder(Stream.fromByteArray(bytes))
  const { messages } = decoder.read()

  const steps = (messages.workoutStepMesgs ?? []) as Record<string, number | string>[]

  return {
    name: (messages.workoutMesgs ?? [])[0]?.wktName,
    steps: steps.map((step) => ({
      name: step.wktStepName as string | undefined,
      intensity: step.intensity as string | undefined,
      durationType: step.durationType as string | undefined,
      durationS: step.durationTime as number | undefined,
      distanceM: step.durationDistance as number | undefined,
      paceSecPerKm: paceFromSpeeds(
        step.customTargetSpeedLow as number | undefined,
        step.customTargetSpeedHigh as number | undefined,
      ),
      repeats: step.repeatSteps as number | undefined,
      notes: step.notes as string | undefined,
    })),
  }
}
