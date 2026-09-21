<script setup lang="ts">
const route = useRoute()
const emit = defineEmits<{ navigate: [] }>()
const athlete = useAthleteStore()

const groups = computed(() => moreGroupsFor(athlete.sports))

async function go(path: string) {
  emit('navigate')
  await navigateTo(path)
}
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
        :class="route.path === item.to && 'bg-surface-raised text-text'"
        :aria-current="route.path === item.to ? 'page' : undefined"
        @click="go(item.to)"
      >
        <UiAppIcon
          :name="item.icon"
          :class="route.path === item.to ? 'text-accent' : 'text-icon'"
        />
        <span>{{ item.label }}</span>
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
