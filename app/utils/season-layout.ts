/**
 * Géométrie de la frise de saison : c'est la seule partie qui peut être fausse,
 * donc la seule qui a des tests. Les deux composants qui l'affichent — la bande
 * du cockpit et le plateau de la page Courses — la consomment sans recalculer.
 */

const DAY_MS = 86_400_000

/**
 * Deux courses plus proches que ça se gênent : la seconde monte d'un niveau.
 * Mesuré sur la largeur réelle d'une puce « nom · J−n » — environ 130 px sur
 * une frise de 1 160 px, soit un peu plus de 11 %.
 */
export const RACE_COLLISION_PCT = 12

export interface SeasonPhase {
  id: number
  type: string
  startWeek: number
  endWeek: number
  raceId: number | null
}

export interface SeasonWeek {
  index: number
  startDate: string
  endDate: string
  phaseType: string
  targetRunM: number
  light: boolean
  test: boolean
}

export interface SeasonRace {
  id: number
  name: string
  date: string
  priority: string
}

export interface SeasonSegment {
  id: number
  type: string
  startWeek: number
  endWeek: number
  weeks: number
  sharePct: number
  /** Nuls quand le plan n'est pas daté. */
  startDate: string | null
  endDate: string | null
  current: boolean
  raceId: number | null
}

export interface SeasonRaceMark {
  race: SeasonRace
  positionPct: number
  /** 0 au ras de la barre, 1 au-dessus quand deux repères se gênent. */
  level: 0 | 1
  daysUntil: number
}

export interface SeasonTick {
  label: string
  positionPct: number
}

export interface SeasonLayout {
  segments: SeasonSegment[]
  totalWeeks: number
  startDate: string | null
  endDate: string | null
  /** Position d'aujourd'hui en %, nulle hors saison ou sur un plan non daté. */
  todayPct: number | null
  currentWeekIndex: number
  races: SeasonRaceMark[]
  ticks: SeasonTick[]
  dated: boolean
}

export interface SeasonLayoutInput {
  phases: SeasonPhase[]
  weeks: SeasonWeek[]
  races: SeasonRace[]
  today: string
  /**
   * Un plan en pause sans date de reprise ancre ses semaines sur aujourd'hui
   * faute de mieux : seules les phases et les volumes ont un sens (§ 5). La
   * frise se dégrade alors — pas d'axe, pas de repère — au lieu de mentir.
   */
  dated: boolean
}

const MONTH_FORMAT = new Intl.DateTimeFormat('fr-FR', { month: 'short' })

function atNoon(date: string): number {
  return Date.parse(`${date}T12:00:00Z`)
}

export function seasonLayout(input: SeasonLayoutInput): SeasonLayout {
  const { phases, weeks, races, today, dated } = input

  const totalWeeks = weeks.length
  const first = weeks.at(0)
  const last = weeks.at(-1)

  const segments: SeasonSegment[] = phases.map((phase) => {
    const span = phase.endWeek - phase.startWeek + 1
    const startWeek = weeks.find((week) => week.index === phase.startWeek)
    const endWeek = weeks.find((week) => week.index === phase.endWeek)

    return {
      id: phase.id,
      type: phase.type,
      startWeek: phase.startWeek,
      endWeek: phase.endWeek,
      weeks: span,
      sharePct: totalWeeks === 0 ? 0 : (span / totalWeeks) * 100,
      startDate: dated ? (startWeek?.startDate ?? null) : null,
      endDate: dated ? (endWeek?.endDate ?? null) : null,
      current: false,
      raceId: phase.raceId,
    }
  })

  const empty: SeasonLayout = {
    segments,
    totalWeeks,
    startDate: null,
    endDate: null,
    todayPct: null,
    currentWeekIndex: 0,
    races: [],
    ticks: [],
    dated: false,
  }

  if (!dated || !first || !last) return empty

  const from = atNoon(first.startDate)
  const to = atNoon(last.endDate)
  const span = to - from
  if (span <= 0) return empty

  const positionOf = (date: string) => ((atNoon(date) - from) / span) * 100
  const within = (pct: number) => pct >= 0 && pct <= 100

  const currentWeek = weeks.find((week) => week.startDate <= today && today <= week.endDate)
  for (const segment of segments) {
    segment.current =
      currentWeek !== undefined &&
      currentWeek.index >= segment.startWeek &&
      currentWeek.index <= segment.endWeek
  }

  const marks: SeasonRaceMark[] = []
  for (const race of [...races].sort((a, b) => a.date.localeCompare(b.date))) {
    const positionPct = positionOf(race.date)
    if (!within(positionPct)) continue

    const previous = marks.findLast((mark) => mark.level === 0)
    const level: 0 | 1 =
      previous !== undefined && positionPct - previous.positionPct < RACE_COLLISION_PCT ? 1 : 0

    marks.push({
      race,
      positionPct,
      level,
      daysUntil: Math.round((atNoon(race.date) - atNoon(today)) / DAY_MS),
    })
  }

  const todayPct = positionOf(today)

  return {
    segments,
    totalWeeks,
    startDate: first.startDate,
    endDate: last.endDate,
    todayPct: within(todayPct) ? todayPct : null,
    currentWeekIndex: currentWeek?.index ?? 0,
    races: marks,
    ticks: monthTicks(first.startDate, last.endDate, positionOf),
    dated: true,
  }
}

/** Une graduation au premier de chaque mois, l'année marquée en janvier. */
function monthTicks(
  startDate: string,
  endDate: string,
  positionOf: (date: string) => number,
): SeasonTick[] {
  const start = new Date(atNoon(startDate))
  const end = atNoon(endDate)

  const ticks: SeasonTick[] = []
  let year = start.getUTCFullYear()
  let month = start.getUTCMonth() + 1

  while (Date.UTC(year, month, 1, 12) <= end) {
    const date = new Date(Date.UTC(year, month, 1, 12))
    const iso = date.toISOString().slice(0, 10)
    const label =
      date.getUTCMonth() === 0
        ? `${MONTH_FORMAT.format(date)} ${String(date.getUTCFullYear()).slice(2)}`
        : MONTH_FORMAT.format(date)

    ticks.push({ label, positionPct: positionOf(iso) })
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }

  return ticks
}
