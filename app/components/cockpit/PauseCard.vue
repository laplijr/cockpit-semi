<script setup lang="ts">
import type { OpenPause } from '~/stores/plan'

defineProps<{ pause: OpenPause }>()
const emit = defineEmits<{ resume: [] }>()

const plan = usePlanStore()
/**
 * Exception à la règle du § 8 : le libellé se réécrit. L'attente dure des
 * secondes et le mot nomme ce qui se passe ; ailleurs, le dessin suffit.
 */
const pending = ref(false)

async function resume() {
  pending.value = true
  try {
    await plan.markResumption()
    emit('resume')
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="tile" style="border-color: rgba(247, 200, 93, 0.35)">
    <div class="flex items-center gap-2">
      <UiAppIcon name="pause" class="text-warn" />
      <span class="label">Pause en cours · jour {{ pause.day }}</span>
      <span class="mono ml-auto text-meta text-text-dim">
        depuis le {{ formatDate(pause.startDate) }}
      </span>
    </div>

    <p v-if="pause.notes" class="text-body text-text-dim">{{ pause.notes }}</p>

    <div class="flex flex-col gap-[6px]">
      <span class="label text-caption">Autorisé</span>
      <ul class="flex flex-col gap-1 text-body">
        <li v-for="item in allowanceRows(pause)" :key="item.label" class="flex items-center gap-2">
          <UiAppIcon
            :name="item.allowed ? 'check' : 'close'"
            :size="14"
            :class="item.allowed ? 'text-ok' : 'text-text-dim'"
          />
          <span :class="item.allowed ? 'text-text' : 'text-text-dim'">{{ item.label }}</span>
        </li>
      </ul>
      <p
        v-for="condition in pause.allowances.conditions ?? []"
        :key="condition"
        class="text-meta text-text-dim"
      >
        {{ condition }}
      </p>
    </div>

    <div v-if="pause.watchZones.length > 0" class="flex flex-col gap-[6px]">
      <span class="label text-caption">À surveiller à la reprise</span>
      <span class="text-body text-text-dim">{{ pause.watchZones.join(' · ') }}</span>
    </div>

    <div>
      <UiActionButton class="btn" :action="resume">
        {{ pending ? 'Régénération du plan…' : 'Marquer la reprise' }}
      </UiActionButton>
    </div>
  </div>
</template>
