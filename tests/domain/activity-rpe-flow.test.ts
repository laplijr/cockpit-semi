import { describe, expect, it } from 'vitest'
import {
  correctActivityRpe,
  type ActivityRpeGateway,
} from '~~/server/application/correct-activity-rpe'

const SQUASH = { id: 12, date: '2026-09-29' }

function fakeGateway(known: { id: number; date: string }[]) {
  const saved: { activityId: number; rpe: number }[] = []
  const recomputed: string[] = []

  const gateway: ActivityRpeGateway = {
    async offPlanActivityDate(activityId) {
      return known.find((item) => item.id === activityId)?.date
    },
    async saveRpe(activityId, rpe) {
      saved.push({ activityId, rpe })
    },
    async recomputeLoad(date) {
      recomputed.push(date)
      return { date, runningUa: 0, cyclingUa: 0, strengthUa: 0, otherUa: 360, totalUa: 360 }
    },
  }

  return { gateway, saved, recomputed }
}

describe('correction du RPE d’une activité hors plan', () => {
  it('enregistre le nouvel effort puis recalcule la charge du jour de l’activité', async () => {
    const { gateway, saved, recomputed } = fakeGateway([SQUASH])

    const load = await correctActivityRpe(gateway, SQUASH.id, 8)

    expect(saved).toEqual([{ activityId: SQUASH.id, rpe: 8 }])
    expect(recomputed).toEqual([SQUASH.date])
    expect(load.totalUa).toBe(360)
  })

  it('refuse une activité inconnue ou rattachée à une séance, sans rien écrire', async () => {
    const { gateway, saved, recomputed } = fakeGateway([])

    await expect(correctActivityRpe(gateway, SQUASH.id, 8)).rejects.toThrow(/inconnue/)
    expect(saved).toEqual([])
    expect(recomputed).toEqual([])
  })
})
