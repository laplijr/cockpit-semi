<script setup lang="ts">
const route = useRoute()
const athlete = useAthleteStore()

const groups = computed(() => navGroupsFor(athlete.sports, athlete.inCircle))
const { unread } = useCircleUnread()
</script>

<template>
  <!--
    Trois états, deux points de rupture (§ 8) : absente sur téléphone, où la
    barre du bas prend le relais ; réduite à ses icônes sur tablette, l'intitulé
    en `aria-label` et en bulle ; entière à partir de l'écran de référence.
  -->
  <aside
    class="hidden w-14 shrink-0 flex-col gap-[18px] border-r border-line-soft bg-ink-deep px-2 pt-5 pb-4 lean:flex wide:w-(--spacing-sidebar) wide:px-[14px]"
  >
    <NuxtLink
      to="/"
      aria-label="Cockpit"
      class="display flex items-center justify-center gap-[10px] text-xl font-bold tracking-[0.06em] uppercase wide:justify-start wide:px-[10px]"
    >
      <UiAppIcon name="logo" :size="20" class="text-accent" />
      <span class="hidden wide:inline">Cockpit</span>
    </NuxtLink>

    <nav v-for="group in groups" :key="group.title" class="flex flex-col gap-[2px]">
      <span
        class="hidden px-[10px] pb-[6px] text-[10px] font-semibold tracking-[0.12em] text-text-dim uppercase wide:block"
      >
        {{ group.title }}
      </span>
      <NuxtLink
        v-for="item in group.items"
        :key="item.to"
        :to="item.to"
        :aria-label="item.label"
        class="group relative flex h-[34px] items-center justify-center gap-[10px] rounded-md text-[13.5px] text-text-dim hover:bg-surface-raised wide:justify-start wide:px-[10px]"
        :class="route.path === item.to && 'bg-surface-raised text-text'"
      >
        <UiAppIcon
          :name="item.icon"
          :class="route.path === item.to ? 'text-accent' : 'text-icon'"
        />
        <span class="hidden wide:inline">{{ item.label }}</span>

        <!-- Un point, pas un nombre : il y a du neuf, on ne doit rien (§ 8, P9). -->
        <span
          v-if="item.to === '/cercle' && unread"
          aria-label="publications non lues"
          class="absolute top-[9px] right-[9px] size-[7px] rounded-full bg-accent wide:static wide:ml-auto"
        />

        <!-- Sans intitulé à l'écran, la bulle le rend au survol et au focus. -->
        <span
          class="bubble pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2 px-2 py-1 text-[12px] whitespace-nowrap text-text opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 wide:hidden"
        >
          {{ item.label }}
        </span>
      </NuxtLink>
    </nav>

    <div class="mt-auto flex flex-col gap-2 border-t border-line-soft pt-3 wide:px-[10px]">
      <div class="flex items-center gap-2 self-center text-xs text-text-dim wide:self-stretch">
        <UiAppIcon name="strava" class="text-strava" />
        <span class="hidden wide:inline">Strava</span>
        <span class="ml-auto hidden size-2 rounded-full bg-line-strong wide:inline-block" />
      </div>
      <span class="mono hidden text-[11px] text-text-dim wide:inline">non connectée</span>
    </div>
  </aside>
</template>
