<script setup lang="ts">
const proposals = usePropositionsStore()
const plan = usePlanStore()
const ui = useUiStore()
const applying = ref(false)

async function apply() {
  applying.value = true
  try {
    await proposals.applySelected()
    await plan.load()
  } finally {
    applying.value = false
  }
}
</script>

<template>
  <div class="tile">
    <div class="flex items-baseline gap-3">
      <span class="label">À décider</span>
      <span class="mono text-[11.5px] text-text-muted">
        {{ proposals.pendingCount }} en attente
      </span>
    </div>

    <p v-if="proposals.pendingCount === 0" class="text-[13px] text-text-muted">
      Rien à décider. Les propositions apparaissent après un retour de séance.
    </p>

    <div
      v-for="item in proposals.pending"
      :key="item.id"
      class="flex items-start gap-3 border-t border-line-soft py-[10px] first:border-t-0"
    >
      <input
        type="checkbox"
        class="mt-1 accent-accent"
        :checked="proposals.selected.includes(item.id)"
        @change="proposals.toggle(item.id)"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-baseline gap-2">
          <span class="pill">{{ item.ruleId }}</span>
          <span class="mono text-[13px]">
            <span class="text-text-muted line-through">{{ item.before }}</span>
            <span class="mx-1 text-text-muted">→</span>
            <span>{{ item.after }}</span>
          </span>
        </div>
        <button
          type="button"
          class="self-start text-left text-[12.5px] text-text-muted hover:text-text"
          @click="ui.openPanel('proposition', item.id)"
        >
          {{ item.explanation }}
        </button>
      </div>
      <button
        type="button"
        class="text-[12.5px] text-text-muted hover:text-text"
        @click="proposals.refuse(item.id)"
      >
        Refuser
      </button>
    </div>

    <div v-if="proposals.selected.length > 0">
      <button type="button" class="btn" :disabled="applying" @click="apply">
        Appliquer {{ proposals.selected.length }}
      </button>
    </div>
  </div>
</template>
