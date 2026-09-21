import { describe, expect, it } from 'vitest'
import {
  ReviewHighlight,
  ReviewVerdict,
  weeklyReview,
  type ReviewSession,
  type WeeklyReviewInput,
} from '~~/server/domain/load/weekly-review'
import type { WeekSummary } from '~~/server/domain/load/week-summary'
import { PhaseType } from '~~/server/domain/plan/phases'
import { SessionStatus } from '~~/server/domain/plan/session'
import { Sport } from '~~/server/domain/shared/sport'

const summary = (over: Partial<WeekSummary> = {}): WeekSummary => ({
  targetRunM: 40_000,
  actualRunM: 40_000,
  runGapM: 0,
  loadUa: 820,
  loadBySport: {
    [Sport.Running]: 600,
    [Sport.Cycling]: 120,
    [Sport.Strength]: 100,
    [Sport.Other]: 0,
  },
  sessionsPlanned: 5,
  sessionsDone: 5,
  light: false,
  test: false,
  comeback: false,
  ...over,
})

const session = (over: Partial<ReviewSession> = {}): ReviewSession => ({
  sport: Sport.Running,
  code: 'EF',
  status: SessionStatus.Done,
  key: false,
  longRun: false,
  ...over,
})

const input = (over: Partial<WeeklyReviewInput> = {}): WeeklyReviewInput => ({
  weekStart: '2026-11-16',
  weekEnd: '2026-11-22',
  summary: summary(),
  sessions: [session(), session(), session({ key: true }), session({ longRun: true }), session()],
  feedbacks: [],
  excused: false,
  vdotBefore: null,
  vdotAfter: null,
  nextTargetRunM: 42_000,
  nextPhase: PhaseType.Development,
  ...over,
})

describe('bilan de la semaine (§ 9, P7.1)', () => {
  it('déclare conforme une semaine dont tout est fait', () => {
    const review = weeklyReview(input())

    expect(review.verdict).toBe(ReviewVerdict.Conforming)
    expect(review.sessions).toEqual({ done: 5, planned: 5, key: 1, keyDone: 1 })
    expect(review.highlights).toContain(ReviewHighlight.EverythingDone)
  })

  it('ne compte pas comme un échec une semaine que le moteur a allégée', () => {
    const eased = weeklyReview(
      input({
        summary: summary({ light: true, sessionsDone: 2, sessionsPlanned: 5 }),
        sessions: [session(), session(), session({ status: SessionStatus.Skipped })],
      }),
    )

    expect(eased.verdict).toBe(ReviewVerdict.Eased)
  })

  it('distingue une semaine partielle d’une semaine manquée', () => {
    const partial = weeklyReview(input({ summary: summary({ sessionsDone: 3 }) }))
    const missed = weeklyReview(input({ summary: summary({ sessionsDone: 1 }) }))

    expect(partial.verdict).toBe(ReviewVerdict.Partial)
    expect(missed.verdict).toBe(ReviewVerdict.Missed)
  })

  it('relève la sortie longue manquée et les séances clés qui sautent', () => {
    const review = weeklyReview(
      input({
        summary: summary({ sessionsDone: 3 }),
        sessions: [
          session(),
          session({ key: true, status: SessionStatus.Skipped }),
          session({ longRun: true, status: SessionStatus.Skipped }),
        ],
      }),
    )

    expect(review.highlights).toContain(ReviewHighlight.LongRunMissed)
    expect(review.highlights).toContain(ReviewHighlight.KeySessionsMissed)
    expect(review.sessions.keyDone).toBe(0)
  })

  it('porte le gain de forme d’une semaine de test', () => {
    const review = weeklyReview(
      input({ summary: summary({ test: true }), vdotBefore: 33.15, vdotAfter: 33.75 }),
    )

    expect(review.vdotChange).toBe(0.6)
    expect(review.highlights).toContain(ReviewHighlight.TestPassed)
    expect(review.highlights).toContain(ReviewHighlight.VdotGained)
  })

  it('ne dit l’écart de volume ni en reprise ni en semaine allégée', () => {
    const full = weeklyReview(input({ summary: summary({ actualRunM: 30_000, runGapM: -10_000 }) }))
    const comeback = weeklyReview(
      input({ summary: summary({ actualRunM: 30_000, runGapM: -10_000, comeback: true }) }),
    )

    expect(full.highlights).toContain(ReviewHighlight.VolumeUnderTarget)
    expect(comeback.highlights).not.toContain(ReviewHighlight.VolumeUnderTarget)
  })

  it('ne signale les nuits courtes qu’à partir de trois', () => {
    const two = weeklyReview(
      input({
        feedbacks: [
          { sleepH: 6, pain: false },
          { sleepH: 5.5, pain: false },
        ],
      }),
    )
    const three = weeklyReview(
      input({
        feedbacks: [
          { sleepH: 6, pain: false },
          { sleepH: 5.5, pain: false },
          { sleepH: 6.2, pain: true },
        ],
      }),
    )

    expect(two.highlights).not.toContain(ReviewHighlight.ShortNights)
    expect(three.highlights).toContain(ReviewHighlight.ShortNights)
    expect(three.highlights).toContain(ReviewHighlight.PainReported)
  })
})
