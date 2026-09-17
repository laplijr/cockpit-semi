import { describe, expect, it } from 'vitest'
import { groupProposals, type PendingProposal } from '~~/server/application/group-proposals'
import { ProposalEffect, RuleId } from '~~/server/domain/rules/rules'

let nextId = 1

function proposal(over: Partial<PendingProposal> = {}): PendingProposal {
  const id = nextId++
  return {
    id,
    ruleId: RuleId.R1,
    effect: ProposalEffect.ReduceStrengthSet,
    targetKind: 'session',
    targetId: id,
    before: '4 séries',
    after: '3 séries',
    explanation: 'Deux signaux de fatigue sont actifs.',
    target: { id, code: 'legs', date: '2026-11-24', sport: 'muscu' },
    ...over,
  }
}

describe('décisions groupées (§ 9, P5.19)', () => {
  it('réunit deux propositions de même règle et même effet', () => {
    const groups = groupProposals([proposal(), proposal()])

    expect(groups).toHaveLength(1)
    expect(groups[0]!.ids).toHaveLength(2)
    expect(groups[0]!.targets).toHaveLength(2)
    expect(groups[0]!.before).toBe('4 séries')
  })

  it('laisse deux effets différents faire deux décisions', () => {
    const groups = groupProposals([
      proposal(),
      proposal({ effect: ProposalEffect.ReduceEasyVolume, before: '7,4 km', after: '5,2 km' }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.effect)).toEqual([
      ProposalEffect.ReduceStrengthSet,
      ProposalEffect.ReduceEasyVolume,
    ])
  })

  it('laisse deux règles différentes faire deux décisions', () => {
    const groups = groupProposals([proposal(), proposal({ ruleId: RuleId.R2 })])

    expect(groups).toHaveLength(2)
  })

  it('n’affiche plus une valeur commune quand les membres ne changent pas la même', () => {
    const groups = groupProposals([proposal(), proposal({ before: '3 séries', after: '2 séries' })])

    expect(groups).toHaveLength(1)
    expect(groups[0]!.before).toBeNull()
    expect(groups[0]!.after).toBeNull()
  })

  it('compte les groupes, pas les lignes : c’est ce que porte la cloche', () => {
    const pending = [
      proposal(),
      proposal(),
      proposal(),
      proposal(),
      proposal({ ruleId: RuleId.R2, effect: ProposalEffect.ReduceEasyVolume }),
      proposal({ ruleId: RuleId.R2, effect: ProposalEffect.ReduceEasyVolume }),
    ]

    expect(pending).toHaveLength(6)
    expect(groupProposals(pending)).toHaveLength(2)
  })

  it('garde une cible nulle sans casser le groupe', () => {
    const groups = groupProposals([
      proposal({
        effect: ProposalEffect.FreezeProgression,
        targetKind: 'plan',
        targetId: null,
        target: null,
      }),
    ])

    expect(groups[0]!.targets).toEqual([])
    expect(groups[0]!.ids).toHaveLength(1)
  })
})
