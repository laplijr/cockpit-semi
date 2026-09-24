<script setup lang="ts">
/**
 * Le ratio 7 j / 21 j posé sur l'axe des semaines de « Volume et charge »
 * (P22) : plein jusqu'au trait d'aujourd'hui, en pointillé ensuite, jusqu'au
 * jour J, sur la bande 0,8–1,3. C'est le même axe que les barres, pas un
 * graphe de plus.
 */
interface OverlayWeek {
  startDate: string
  endDate: string
}

const props = defineProps<{
  weeks: OverlayWeek[]
  points: { date: string; ratio: number | null; projected: boolean }[]
  today: string
  reference: { low: number; high: number }
  height: number
}>()

const LOW = 0.4
const HIGH = 1.8

const yOf = (ratio: number) =>
  ((HIGH - Math.min(HIGH, Math.max(LOW, ratio))) / (HIGH - LOW)) * props.height

const ratioOn = computed(() => new Map(props.points.map((point) => [point.date, point.ratio])))

const xOfWeek = (index: number) => ((index + 0.5) / props.weeks.length) * 100

/** Le trait d'aujourd'hui, au jour près dans sa semaine. */
const todayX = computed(() => {
  const index = props.weeks.findIndex(
    (week) => week.startDate <= props.today && props.today <= week.endDate,
  )
  if (index === -1) return null
  const day = (Date.parse(props.today) - Date.parse(props.weeks[index]!.startDate)) / 86_400_000
  return ((index + (day + 0.5) / 7) / props.weeks.length) * 100
})

function line(items: { x: number; ratio: number | null | undefined }[]): string {
  return items
    .filter((item) => item.ratio !== null && item.ratio !== undefined)
    .map((item) => `${item.x.toFixed(2)},${yOf(item.ratio!).toFixed(1)}`)
    .join(' ')
}

const todayPoint = computed(() =>
  todayX.value === null ? [] : [{ x: todayX.value, ratio: ratioOn.value.get(props.today) }],
)

const past = computed(() =>
  line([
    ...props.weeks
      .map((week, index) => ({ week, x: xOfWeek(index) }))
      .filter(({ week }) => week.endDate < props.today)
      .map(({ week, x }) => ({ x, ratio: ratioOn.value.get(week.endDate) })),
    ...todayPoint.value,
  ]),
)

const future = computed(() =>
  line([
    ...todayPoint.value,
    ...props.weeks
      .map((week, index) => ({ week, x: xOfWeek(index) }))
      .filter(({ week }) => week.endDate > props.today)
      .map(({ week, x }) => ({ x, ratio: ratioOn.value.get(week.endDate) })),
  ]),
)
</script>

<template>
  <svg
    :viewBox="`0 0 100 ${height}`"
    preserveAspectRatio="none"
    class="pointer-events-none absolute inset-x-0 top-0 w-full"
    :style="{ height: `${height}px` }"
    aria-hidden="true"
  >
    <rect
      x="0"
      :y="yOf(reference.high)"
      width="100"
      :height="yOf(reference.low) - yOf(reference.high)"
      fill="var(--color-ok)"
      fill-opacity="0.08"
    />
    <line
      v-if="todayX !== null"
      :x1="todayX"
      :x2="todayX"
      y1="0"
      :y2="height"
      stroke="var(--color-text-dim)"
      stroke-width="1"
      vector-effect="non-scaling-stroke"
    />
    <polyline
      :points="past"
      fill="none"
      stroke="var(--color-ok)"
      stroke-width="1.5"
      vector-effect="non-scaling-stroke"
      stroke-linejoin="round"
    />
    <polyline
      :points="future"
      fill="none"
      stroke="var(--color-ok)"
      stroke-width="1.5"
      stroke-dasharray="3 3"
      vector-effect="non-scaling-stroke"
      stroke-linejoin="round"
    />
  </svg>
</template>
