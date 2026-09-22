<script setup lang="ts">
const route = useRoute()
const emit = defineEmits<{ navigate: [] }>()
const athlete = useAthleteStore()
const circle = useCircleStore()

const groups = computed(() => moreGroupsFor(athlete.sports, athlete.inCircle))

/**
 * La destination en cours de chargement. Fermer le panneau d'abord laissait
 * l'ancienne page seule à l'écran pendant toute la requête : le geste n'avait
 * plus de trace. Le panneau reste, l'entrée touchée se marque, et il ne se
 * ferme qu'une fois la page arrivée.
 */
const going = ref<string>()

async function go(path: string) {
  if (going.value) return

  going.value = path
  try {
    await navigateTo(path)
    emit('navigate')
  } finally {
    going.value = undefined
  }
}

/**
 * Le doigt qui se pose annonce le clic : on prend cette avance pour chercher
 * le code de la page, et la semaine du cercle qui est la requête la plus
 * lente derrière ce menu.
 */
function warm(path: string) {
  preloadRouteComponents(path)
  if (path === '/cercle') circle.ensureLoaded()
}

onMounted(() => {
  for (const group of groups.value) {
    for (const item of group.items) preloadRouteComponents(item.to)
  }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <nav v-for="group in groups" :key="group.title" class="flex flex-col">
      <span class="pb-1 text-[10px] font-semibold tracking-[0.12em] text-text-dim uppercase">{{
        group.title
      }}</span>
      <button
        v-for="item in group.items"
        :key="item.to"
        type="button"
        class="tap flex items-center gap-3 rounded-md px-2 text-left text-[14px] text-text-dim"
        :class="[
          route.path === item.to && 'bg-surface-raised text-text',
          going === item.to && 'bg-surface-raised text-text',
        ]"
        :aria-current="route.path === item.to ? 'page' : undefined"
        :aria-busy="going === item.to"
        @pointerdown="warm(item.to)"
        @click="go(item.to)"
      >
        <UiAppIcon
          :name="item.icon"
          :class="route.path === item.to || going === item.to ? 'text-accent' : 'text-icon'"
        />
        <span>{{ item.label }}</span>
        <!-- Même rond que `UiActionButton` : l'attente se lit pareil partout,
             et disparaît sous `prefers-reduced-motion` où `aria-busy` suffit. -->
        <span
          v-if="going === item.to"
          aria-hidden="true"
          class="ml-auto size-[14px] animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:hidden"
        />
      </button>
    </nav>

    <!-- L'état de connexion vit en pied de barre latérale : sans barre, il vit ici. -->
    <div class="flex items-center gap-2 border-t border-line-soft pt-3 text-[13px] text-text-dim">
      <UiAppIcon name="strava" class="text-strava" />
      <span>Strava</span>
      <span class="mono ml-auto text-[11.5px]">non connectée</span>
      <span class="inline-block size-2 rounded-full bg-line-strong" />
    </div>
  </div>
</template>
