<script setup lang="ts">
/**
 * Le pied d'une tuile qui ne montre qu'une page : où l'on en est, sur combien,
 * et de quoi avancer. Sous deux pages il ne s'affiche pas — une liste courte
 * n'a rien à paginer.
 */
const page = defineModel<number>({ required: true })

const props = defineProps<{ total: number; perPage: number }>()

const pageCount = computed(() => pageCountOf(props.total, props.perPage))
const from = computed(() => (props.total === 0 ? 0 : (page.value - 1) * props.perPage + 1))
const to = computed(() => Math.min(page.value * props.perPage, props.total))
</script>

<template>
  <div v-if="pageCount > 1" class="flex items-center gap-3 border-t border-line-soft pt-2">
    <span class="mono text-meta text-text-dim">{{ from }}–{{ to }} sur {{ total }}</span>

    <div class="ml-auto flex items-center gap-2">
      <button
        type="button"
        class="btn btn-ghost px-0 lean:h-7 lean:w-7"
        :disabled="page === 1"
        aria-label="Page précédente"
        @click="page -= 1"
      >
        <UiAppIcon name="chevron" :size="14" class="rotate-180" />
      </button>

      <span class="mono text-meta text-text-dim">{{ page }} / {{ pageCount }}</span>

      <button
        type="button"
        class="btn btn-ghost px-0 lean:h-7 lean:w-7"
        :disabled="page === pageCount"
        aria-label="Page suivante"
        @click="page += 1"
      >
        <UiAppIcon name="chevron" :size="14" />
      </button>
    </div>
  </div>
</template>
