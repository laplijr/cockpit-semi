import { describe, expect, it } from 'vitest'
import { NoticeKind, pendingNotices, type NoticeState } from '~/utils/notices'

const TODAY = '2026-11-22'

const state = (over: Partial<NoticeState> = {}): NoticeState => ({
  today: TODAY,
  sessions: [],
  pendingProposals: 0,
  lastNotified: {},
  ...over,
})

describe('ce qui mérite un rappel (§ 9, P7.2)', () => {
  it('ne rappelle rien quand tout est saisi et rien ne se décide', () => {
    const notices = pendingNotices(
      state({ sessions: [{ date: '2026-11-21', done: true, hasFeedback: true }] }),
    )

    expect(notices).toEqual([])
  })

  it('rappelle un ressenti manquant sur une séance faite', () => {
    const notices = pendingNotices(
      state({ sessions: [{ date: '2026-11-21', done: true, hasFeedback: false }] }),
    )

    expect(notices.map((item) => item.kind)).toEqual([NoticeKind.MissingFeedback])
    expect(notices[0]!.title).toBe('Un ressenti à saisir')
  })

  it('ne rappelle jamais une séance qui n’a pas été faite', () => {
    const notices = pendingNotices(
      state({
        sessions: [
          { date: '2026-11-21', done: false, hasFeedback: false },
          { date: '2026-11-23', done: false, hasFeedback: false },
        ],
      }),
    )

    expect(notices).toEqual([])
  })

  it('rappelle les propositions en attente, au pluriel quand il y en a plusieurs', () => {
    const notices = pendingNotices(state({ pendingProposals: 3 }))

    expect(notices.map((item) => item.kind)).toEqual([NoticeKind.PendingProposal])
    expect(notices[0]!.title).toBe('3 propositions attendent')
  })

  it('ne redit pas le même motif deux fois le même jour', () => {
    const notices = pendingNotices(
      state({
        pendingProposals: 2,
        sessions: [{ date: '2026-11-21', done: true, hasFeedback: false }],
        lastNotified: { [NoticeKind.PendingProposal]: TODAY },
      }),
    )

    expect(notices.map((item) => item.kind)).toEqual([NoticeKind.MissingFeedback])
  })

  it('redit un motif rappelé la veille', () => {
    const notices = pendingNotices(
      state({
        pendingProposals: 1,
        lastNotified: { [NoticeKind.PendingProposal]: '2026-11-21' },
      }),
    )

    expect(notices.map((item) => item.kind)).toEqual([NoticeKind.PendingProposal])
  })
})
