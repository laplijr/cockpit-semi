import type { IsoDate } from '~~/server/domain/plan/calendar'

/**
 * Ce qui mérite un rappel, et rien d'autre (§ 9, P7.2). Deux motifs : une
 * saisie qui manque, une décision qui attend. **Jamais une séance à faire** —
 * « tu n'as pas couru » n'est pas un rappel, c'est un reproche, et le cockpit
 * n'en fait pas (§ 1).
 */
export enum NoticeKind {
  MissingFeedback = 'ressenti_manquant',
  PendingProposal = 'proposition_en_attente',
}

export interface Notice {
  kind: NoticeKind
  title: string
  body: string
}

export interface NoticeState {
  today: IsoDate
  /** Séances déjà passées, et si leur ressenti a été saisi. */
  sessions: { date: IsoDate; done: boolean; hasFeedback: boolean }[]
  pendingProposals: number
  /** Ce qui a déjà été notifié, par motif : la date du dernier rappel. */
  lastNotified: Partial<Record<NoticeKind, IsoDate>>
}

export function pendingNotices(state: NoticeState): Notice[] {
  const found: Notice[] = []

  const missing = state.sessions.filter(
    (item) => item.date <= state.today && item.done && !item.hasFeedback,
  )
  if (missing.length > 0 && !alreadyToday(state, NoticeKind.MissingFeedback)) {
    found.push({
      kind: NoticeKind.MissingFeedback,
      title: missing.length === 1 ? 'Un ressenti à saisir' : `${missing.length} ressentis à saisir`,
      body:
        missing.length === 1
          ? 'Une séance faite attend son ressenti.'
          : 'Des séances faites attendent leur ressenti.',
    })
  }

  if (state.pendingProposals > 0 && !alreadyToday(state, NoticeKind.PendingProposal)) {
    found.push({
      kind: NoticeKind.PendingProposal,
      title:
        state.pendingProposals === 1
          ? 'Une proposition attend'
          : `${state.pendingProposals} propositions attendent`,
      body: 'Le cockpit a recalculé : à toi de décider.',
    })
  }

  return found
}

/** Un motif ne se rappelle qu'une fois par jour : deux, c'est du harcèlement. */
function alreadyToday(state: NoticeState, kind: NoticeKind): boolean {
  return state.lastNotified[kind] === state.today
}
