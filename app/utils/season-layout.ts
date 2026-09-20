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

/** Douze semaines : un bloc et son allégée, plus la bascule qui suit. */
export const WINDOW_SPAN = 12

export interface WindowColumn {
  index: number
  /** Nuls quand le plan n'est pas daté. */
  startDate: string | null
  endDate: string | null
  phaseType: string
  targetRunM: number
  light: boolean
  test: boolean
  current: boolean
  /** La course qui tombe cette semaine-là, s'il y en a une. */
  race: SeasonRace | null
}

export interface WindowSegment {
  id: number
  type: string
  /** Colonnes de la fenêtre que la phase couvre. */
  columns: number
  sharePct: number
  current: boolean
  /** Position dans la phase entière, pas dans la fenêtre. */
  weekInPhase: number | null
  phaseWeeks: number
}

export interface SeasonWindow {
  columns: WindowColumn[]
  segments: WindowSegment[]
  /** Position et largeur de la fenêtre dans la jauge, en % ; nulles sans semaine. */
  fromPct: number
  widthPct: number
  /** Index de la première colonne, pour que la jauge sache où elle est. */
  firstIndex: number
  dated: boolean
}

export interface SeasonWindowInput extends SeasonLayoutInput {
  /** Nombre de colonnes ; la saison plus courte en rend moins. */
  span?: number
  /**
   * Semaine autour de laquelle centrer la fenêtre ; sans valeur, la semaine
   * courante. La jauge la déplace sans toucher à la saison.
   */
  anchor?: number | null
}

/**
 * La fenêtre de douze semaines de la page Courses : ce qui se lit, à côté de la
 * jauge qui porte la saison entière (§ 9, P6.37). Même géométrie que
 * `seasonLayout`, dont elle ne duplique ni le repli des courses ni l'axe.
 */
export function seasonWindow(input: SeasonWindowInput): SeasonWindow {
  const { phases, weeks, races, today, dated } = input
  const span = Math.max(1, input.span ?? WINDOW_SPAN)

  const empty: SeasonWindow = {
    columns: [],
    segments: [],
    fromPct: 0,
    widthPct: 0,
    firstIndex: 0,
    dated: false,
  }
  if (weeks.length === 0) return empty

  const ordered = [...weeks].sort((a, b) => a.index - b.index)
  const currentWeek = dated
    ? ordered.find((week) => week.startDate <= today && today <= week.endDate)
    : undefined

  /** La fenêtre se cale sur la saison : ni index négatif au début, ni débordement à la fin. */
  const centre = input.anchor ?? currentWeek?.index ?? ordered[0]!.index
  const position = Math.max(
    0,
    ordered.findIndex((week) => week.index === centre),
  )
  const start = Math.min(
    Math.max(0, position - Math.floor(span / 2)),
    Math.max(0, ordered.length - span),
  )
  const visible = ordered.slice(start, start + span)

  const raceOn = (week: SeasonWeek) =>
    dated
      ? ([...races]
          .sort((a, b) => a.date.localeCompare(b.date))
          .find((race) => week.startDate <= race.date && race.date <= week.endDate) ?? null)
      : null

  const columns: WindowColumn[] = visible.map((week) => ({
    index: week.index,
    startDate: dated ? week.startDate : null,
    endDate: dated ? week.endDate : null,
    phaseType: week.phaseType,
    targetRunM: week.targetRunM,
    light: week.light,
    test: week.test,
    current: currentWeek !== undefined && week.index === currentWeek.index,
    race: raceOn(week),
  }))

  return {
    columns,
    segments: windowSegments(columns, phases, currentWeek?.index ?? null),
    fromPct: (start / ordered.length) * 100,
    widthPct: (visible.length / ordered.length) * 100,
    firstIndex: visible[0]?.index ?? 0,
    dated,
  }
}

/**
 * Les phases de la fenêtre, segmentées sur elle seule : chaque segment a donc
 * la place d'écrire son nom, et le segment courant porte sa position dans la
 * phase entière — pas dans la fenêtre, qui n'en montre qu'un morceau. Le
 * découpage suit `phases`, qui fait foi, et non le type porté par la semaine.
 */
function windowSegments(
  columns: WindowColumn[],
  phases: SeasonPhase[],
  currentIndex: number | null,
): WindowSegment[] {
  const segments: WindowSegment[] = []

  for (const column of columns) {
    const phase = phases.find(
      (item) => column.index >= item.startWeek && column.index <= item.endWeek,
    )
    const last = segments.at(-1)

    if (last && phase !== undefined && last.id === phase.id) {
      last.columns += 1
      last.current ||= column.current
    } else {
      segments.push({
        id: phase?.id ?? 0,
        type: phase?.type ?? column.phaseType,
        columns: 1,
        sharePct: 0,
        current: column.current,
        weekInPhase: null,
        phaseWeeks: phase ? phase.endWeek - phase.startWeek + 1 : 0,
      })
    }

    if (phase && currentIndex !== null && column.index === currentIndex) {
      segments.at(-1)!.weekInPhase = currentIndex - phase.startWeek + 1
    }
  }

  for (const segment of segments) segment.sharePct = (segment.columns / columns.length) * 100
  return segments
}
