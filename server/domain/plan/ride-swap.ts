import { TrainingZone, paceFor } from '../fitness/vdot'
import { RunSessionCode, prescription, runSessionType } from '../running/session-types'
import type { Prescription } from '../shared/prescription'
import { prescribedUnits } from '../shared/prescription'
import { Sport } from '../shared/sport'
import type { IsoDate } from './calendar'
import { addDays } from './calendar'
import { SessionStatus, type PlannedSessionRecord } from './session'
import { EASY_MAX_MIN, EASY_MIN_MIN } from './week-template'

/**
 * Durée minimale d'une séance de remplacement, en minutes. Plus basse que le
 * plancher d'une endurance du plan (`EASY_MIN_MIN`) : ce n'est pas une séance
 * que le générateur pose, c'est une journée rattrapée. Un footing souple de
 * 26′ vaut mieux qu'une journée vide ; sous 20′, il ne vaut plus le
 * déplacement (retour de Ronan, 20 sept. 2026).
 */
export const MIN_REPLACEMENT_MIN = 20

export type SwappableSession = PlannedSessionRecord

/** Volume rendu par une endurance de la semaine pour payer le remplacement (§ 5). */
export interface VolumeGiveback {
  sessionId: number
  date: IsoDate
  takenM: number
  after: Prescription
}

export interface RunReplacement {
  prescription: Prescription
  givebacks: VolumeGiveback[]
  /** Minutes de vélo que la semaine perd : sa cible de vélo les perd aussi. */
  cyclingMinRemoved: number
  /**
   * Vrai quand c'est le plafond du lendemain de sortie longue qui a décidé la
   * taille — pas quand la veille en portait une sans que ça change rien : une
   * semaine qui ne prête que 25′ est bornée par elle, pas par le plafond (§ 5).
   */
  cappedAfterLongRun: boolean
}

export interface RideSwapInput {
  ride: SwappableSession
  /** Séances de la semaine du remplacement, celle du jour comprise. */
  weekSessions: SwappableSession[]
  /**
   * Séances de la veille, qui n'est pas toujours dans la même semaine : une
   * sortie vélo du lundi suit la sortie longue du dimanche précédent (§ 5).
   */
  previousDay: SwappableSession[]
  /** Volume de course visé sur la semaine : il ne bouge pas (§ 5). */
  targetRunM: number
  vdot: number
}

/**
 * Une séance de vélo se remplace le jour même, tant qu'elle est encore à faire :
 * la raison du refus en toutes lettres, ou rien quand le remplacement est
 * recevable (§ 5).
 */
export function rideSwapRefusal(
  session: Pick<SwappableSession, 'date' | 'sport' | 'status'>,
  today: IsoDate,
): string | undefined {
  // L'état d'abord : une séance déjà remplacée porte le sport de son remplacement.
  if (session.status !== SessionStatus.Planned) return 'Cette séance n’est plus à faire.'
  if (session.sport !== Sport.Cycling) {
    return 'Seule une séance de vélo se remplace par une sortie course.'
  }
  if (session.date !== today) return 'Une séance ne se remplace que le jour même.'

  return undefined
}

/** Portion facile d'une endurance : c'est elle qui se raccourcit, pas les lignes droites. */
function easyDistanceOf(item: Prescription): number {
  return item.steps.find((step) => !step.intense)?.distanceM ?? 0
}

/** Endurance raccourcie de `takenM` : seule la portion facile bouge (§ 5). */
function shortenEasy(item: Prescription, takenM: number): Prescription {
  let applied = false
  const steps = item.steps.map((step) => {
    if (applied || step.intense || step.distanceM === undefined) return step
    applied = true
    return { ...step, distanceM: step.distanceM - takenM }
  })

  return { ...item, steps, totalDistanceM: item.totalDistanceM - takenM }
}

/**
 * Reprises au prorata du surplus de chacune, puis un second tour pour le reste
 * des arrondis : la somme rendue vaut exactement ce qui est demandé.
 */
function distribute(surpluses: number[], wantedM: number): number[] {
  const lendable = surpluses.reduce((total, item) => total + item, 0)
  const takes = surpluses.map((surplus) =>
    Math.min(surplus, Math.floor((wantedM * surplus) / lendable)),
  )

  let left = wantedM - takes.reduce((total, item) => total + item, 0)
  for (let index = 0; index < takes.length && left > 0; index++) {
    const more = Math.min(surpluses[index]! - takes[index]!, left)
    takes[index] = takes[index]! + more
    left -= more
  }

  return takes
}

/**
 * Endurance qui remplace la sortie vélo du jour, et ce que la semaine rend pour
 * la payer. Deux planchers, et ils ne valent pas la même chose : une endurance
 * qui prête ne descend jamais sous 35′, le remplacement lui-même peut valoir
 * 20′. Rien en dessous : la journée reste sans course plutôt que de faire
 * déborder la semaine (§ 5).
 */
export function replaceRideWithRun({
  ride,
  weekSessions,
  previousDay,
  targetRunM,
  vdot,
}: RideSwapInput): RunReplacement | undefined {
  const easyPace = paceFor(vdot, TrainingZone.Easy)
  const distanceIn = (minutes: number) => Math.round((minutes * 60 * 1000) / easyPace)
  /** Ce qu'une endurance du plan ne descend jamais sous : elle reste une séance. */
  const minEasyM = distanceIn(EASY_MIN_MIN)
  /** Ce sous quoi le remplacement n'existe pas : plus bas, c'est un autre objet. */
  const minReplacementM = distanceIn(MIN_REPLACEMENT_MIN)

  const eve = addDays(ride.date, -1)
  const afterLongRun = [...weekSessions, ...previousDay].some(
    (item) => item.code === RunSessionCode.LongRun && item.date === eve,
  )
  const capM = distanceIn(afterLongRun ? EASY_MIN_MIN : EASY_MAX_MIN)

  const type = runSessionType(RunSessionCode.Endurance)
  const equalLoadM = distanceIn(prescribedUnits(ride.prescription) / type.expectedRpe)

  const lenders = weekSessions
    .filter((item) => item.sport === Sport.Running && item.status === SessionStatus.Planned)
    .filter((item) => item.code === RunSessionCode.Endurance && !item.key)
    .filter((item) => item.date > ride.date)
    .sort((a, b) => a.date.localeCompare(b.date))

  const surpluses = lenders.map((item) => Math.max(0, easyDistanceOf(item.prescription) - minEasyM))
  const lendable = surpluses.reduce((total, item) => total + item, 0)
  if (lendable < minReplacementM) return undefined

  const wantedM = Math.min(Math.max(Math.min(equalLoadM, capM), minReplacementM), lendable)
  const takes = distribute(surpluses, wantedM)

  const givebacks = lenders.flatMap((lender, index) =>
    takes[index]! === 0
      ? []
      : [
          {
            sessionId: lender.id,
            date: lender.date,
            takenM: takes[index]!,
            after: shortenEasy(lender.prescription, takes[index]!),
          },
        ],
  )

  const run = prescription(RunSessionCode.Endurance, {
    vdot,
    weeklyVolumeM: targetRunM,
    targetDistanceM: wantedM,
  })

  return {
    prescription: { ...run, label: `${type.label}, en remplacement du vélo` },
    givebacks,
    cyclingMinRemoved: ride.prescription.durationMin ?? 0,
    cappedAfterLongRun: afterLongRun && wantedM === capM,
  }
}
