<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <aside
    class="flex w-(--spacing-sidebar) shrink-0 flex-col gap-[18px] border-r border-line-soft bg-ink-deep px-[14px] pt-5 pb-4"
  >
    <NuxtLink
      to="/"
      class="display flex items-center gap-[10px] px-[10px] text-xl font-bold tracking-[0.06em] uppercase"
    >
      <UiAppIcon name="logo" :size="20" class="text-accent" />
      <span>Cockpit</span>
    </NuxtLink>

    <nav v-for="group in NAV_GROUPS" :key="group.title" class="flex flex-col gap-[2px]">
      <span
        class="px-[10px] pb-[6px] text-[10px] font-semibold tracking-[0.12em] text-text-faint uppercase"
      >
        {{ group.title }}
      </span>
      <NuxtLink
        v-for="item in group.items"
        :key="item.to"
        :to="item.to"
        class="flex h-[34px] items-center gap-[10px] rounded-md px-[10px] text-[13.5px] text-text-dim hover:bg-surface-raised"
        :class="route.path === item.to && 'bg-surface-raised text-text'"
      >
        <UiAppIcon
          :name="item.icon"
          :class="route.path === item.to ? 'text-accent' : 'text-icon'"
        />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <div class="mt-auto flex flex-col gap-2 border-t border-line-soft px-[10px] pt-3">
      <div class="flex items-center gap-2 text-xs text-text-dim">
        <UiAppIcon name="strava" class="text-strava" />
        <span>Strava</span>
        <span class="ml-auto inline-block size-2 rounded-full bg-line-strong" />
      </div>
      <span class="mono text-[11px] text-text-muted">non connectée</span>
    </div>
  </aside>
</template>
