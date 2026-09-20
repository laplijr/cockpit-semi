<script setup lang="ts">
const route = useRoute()

const title = computed(() => navItemFor(route.path)?.label ?? 'Cockpit')
</script>

<template>
  <!-- Sur téléphone le titre est porté par la barre du haut : pas deux fois. -->
  <h1 class="heading hidden lean:block">{{ title }}</h1>
</template>
