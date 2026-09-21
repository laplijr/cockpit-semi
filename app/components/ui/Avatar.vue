<script setup lang="ts">
/**
 * Le visage de quelqu'un, ou ses initiales à défaut. La barre du haut le
 * dessinait seule ; le cercle en pose une par publication, par réaction et
 * par commentaire (§ 8, P9).
 */
const props = withDefaults(
  defineProps<{ firstName?: string | null; avatar?: string | null; size?: number }>(),
  { firstName: null, avatar: null, size: 28 },
)

const source = computed(() => props.avatar ?? avatarDataUrl(props.firstName, props.size * 2))
</script>

<template>
  <img
    :src="source"
    alt=""
    class="shrink-0 rounded-full"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
</template>
