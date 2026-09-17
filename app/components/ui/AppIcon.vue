<script setup lang="ts">
interface Shape {
  tag: 'path' | 'circle' | 'rect'
  attrs: Record<string, string | number>
}

const path = (d: string): Shape => ({ tag: 'path', attrs: { d } })
const circle = (cx: number, cy: number, r: number): Shape => ({
  tag: 'circle',
  attrs: { cx, cy, r },
})
const rect = (x: number, y: number, width: number, height: number, rx: number): Shape => ({
  tag: 'rect',
  attrs: { x, y, width, height, rx },
})

const ICONS = {
  logo: [circle(12, 12, 9), path('M12 7v5l3 2')],
  gauge: [circle(12, 13, 8), path('M12 13l4-4')],
  week: [rect(3, 5, 18, 16, 2), path('M3 10h18M8 3v4M16 3v4')],
  props: [path('M9 6h11M9 12h11M9 18h11'), path('M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2')],
  flag: [path('M5 21V4'), path('M5 4h12l-2 4 2 4H5')],
  run: [
    circle(16.5, 4.5, 2),
    path('M13 21l1.5-6-4-3 1.5-4.5'),
    path('M12 7.5 8 10'),
    path('M14.5 12l4 1 .5 4.5'),
    path('M13.5 8.5 18 10'),
  ],
  muscu: [path('M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12')],
  velo: [circle(6, 16, 3.5), circle(18, 16, 3.5), path('M6 16l4-8h5l3 8M10 8l4 8')],
  nutri: [path('M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z')],
  hist: [circle(12, 12, 8), path('M12 8v4l3 2')],
  learn: [path('M6 3v6a6 6 0 0 0 12 0V3'), path('M12 15v6M8 21h8')],
  plug: [path('M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0z'), path('M12 17v4')],
  user: [circle(12, 8, 4), path('M4 21a8 8 0 0 1 16 0')],
  pen: [path('M12 20h9'), path('M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z')],
  bell: [path('M6 16V11a6 6 0 0 1 12 0v5l2 2H4z'), path('M10 21h4')],
  pause: [path('M9 5v14M15 5v14')],
  warn: [
    path('M12 9v4'),
    path('M12 17h.01'),
    path('M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'),
  ],
  check: [path('M20 6 9 17l-5-5')],
  trash: [path('M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13'), path('M10 11v6M14 11v6')],
  close: [path('M18 6 6 18M6 6l12 12')],
  info: [circle(12, 12, 9), path('M12 11v5'), path('M12 8h.01')],
  fill: [path('M12 4v9'), path('M8.5 10.5 12 14l3.5-3.5'), path('M5 18h14')],
  strava: [path('M8 3l6 12h-4l-2-4-2 4H2z'), path('M14 15l3 6 3-6h-2l-1 2-1-2z')],
} satisfies Record<string, Shape[]>

export type IconName = keyof typeof ICONS

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 16 })

const shapes = computed<Shape[]>(() => ICONS[props.name])
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="shrink-0"
  >
    <component :is="shape.tag" v-for="(shape, index) in shapes" :key="index" v-bind="shape.attrs" />
  </svg>
</template>
