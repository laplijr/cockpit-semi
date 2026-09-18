<script setup lang="ts">
const route = useRoute()

const title = computed(() => navItemFor(route.path)?.label ?? 'Cockpit')
</script>

<template>
  <h1 class="heading">{{ title }}</h1>
</template>
