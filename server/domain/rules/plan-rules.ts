import {
  ForecastHorizon,
  accuracy,
  adjustedGainPerBlock,
  forecastGap,
  horizonOf,
} from '../fitness/accuracy'
import { VDOT_GAIN_PER_BLOCK } from '../fitness/projection'
import { CONFORMING_SHARE } from '../load/week-summary'
import { frenchKm, frenchShortDate } from '../shared/french'
import {
  BIAS_MIN_FORECASTS,
  BIAS_VDOT_THRESHOLD,
  ProposalEffect,
  RuleId,
  type Proposal,
  type RuleContext,
} from './rule-types'

const HORIZON_LABELS: Record<ForecastHorizon, string> = {
  [ForecastHorizon.Short]: 'à moins de quatre semaines',
  [ForecastHorizon.Medium]: 'de quatre à douze semaines',
  [ForecastHorizon.Long]: 'au-delà de douze semaines',
}

/** Un gain par bloc, tel qu'il se lit dans une proposition. */
function gainLabel(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(2).replace(/0$/, '').replace('.', ',')} VDOT par bloc de huit semaines`
}

function gapLabel(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1).replace('.', ',')}`
}

/**
 * R9 — le moteur se trompe toujours dans le même sens sur un horizon : sa
 * progression estimée se recale sur ce qui est arrivé. Un seul horizon parle à
 * la fois, le plus court qui déclenche : trois propositions de plan d'un coup
 * ne se décident pas (§ 5).
 */
export function r9(context: RuleContext): Proposal[] {
  const resolved = context.forecasts ?? []
  if (resolved.length === 0) return []

  const current = context.gainPerBlock ?? VDOT_GAIN_PER_BLOCK

  return Object.values(ForecastHorizon)
    .flatMap((horizon) => {
      const items = resolved.filter(
        (item) => horizonOf(item.issuedDate, item.targetDate) === horizon,
      )
      if (items.length < BIAS_MIN_FORECASTS) return []

      const verdict = accuracy(items)
      if (!verdict || Math.abs(verdict.biasVdot) <= BIAS_VDOT_THRESHOLD) return []

      const adjusted = adjustedGainPerBlock(current, verdict)
      if (adjusted === current) return []

      const gaps = items.map(forecastGap).map(gapLabel).join(', ')

      return [
        {
          ruleId: RuleId.R9,
          effect: ProposalEffect.AdjustExpectedGain,
          target: { kind: 'plan' as const, id: null },
          before: gainLabel(current),
          after: gainLabel(adjusted),
          explanation: `${verdict.count} prévisions ${HORIZON_LABELS[horizon]} : écart moyen de ${gapLabel(verdict.biasVdot)} VDOT (${gaps}).`,
          payload: { gainPerBlock: adjusted },
        },
      ]
    })
    .slice(0, 1)
}

/**
 * R10 — la semaine close a couru moins de 80 % de sa cible : la suivante ne
 * monte pas. Le seuil est celui de la conformité (P6.5), en kilomètres au lieu
 * de séances. Une semaine allégée se juge sur sa cible allégée ; le gel part
 * de la semaine prochaine, celle en cours ayant déjà ses séances faites.
 */
export function r10(context: RuleContext): Proposal[] {
  const closed = context.closedWeek
  if (!closed || closed.excused || closed.runM === null || closed.targetRunM === 0) return []
  if (closed.runM >= closed.targetRunM * CONFORMING_SHARE) return []

  return [
    {
      ruleId: RuleId.R10,
      effect: ProposalEffect.FreezeProgression,
      target: { kind: 'week', id: closed.weekId },
      before: 'progression du bloc',
      after: 'volume maintenu la semaine prochaine',
      explanation: `La semaine du ${frenchShortDate(closed.startDate)} a couru ${frenchKm(closed.runM)} sur ${frenchKm(closed.targetRunM)} visés.`,
    },
  ]
}
