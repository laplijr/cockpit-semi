<script setup lang="ts">
import type { OpenPause } from '~/stores/plan'

defineProps<{ pause: OpenPause }>()
const emit = defineEmits<{ resume: [] }>()

const plan = usePlanStore()
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
      <span class="mono ml-auto text-[11.5px] text-text-muted">
        depuis le {{ formatDate(pause.startDate) }}
      </span>
    </div>

    <p v-if="pause.notes" class="text-[13px] text-text-dim">{{ pause.notes }}</p>

    <div class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">Autorisé</span>
      <ul class="flex flex-col gap-1 text-[13px]">
        <li v-for="item in allowanceRows(pause)" :key="item.label" class="flex items-center gap-2">
          <UiAppIcon
            :name="item.allowed ? 'check' : 'close'"
            :size="14"
            :class="item.allowed ? 'text-ok' : 'text-text-muted'"
          />
          <span :class="item.allowed ? 'text-text' : 'text-text-muted'">{{ item.label }}</span>
        </li>
      </ul>
      <p
        v-for="condition in pause.allowances.conditions ?? []"
        :key="condition"
        class="text-[12px] text-text-muted"
      >
        {{ condition }}
      </p>
    </div>

    <div v-if="pause.watchZones.length > 0" class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">À surveiller à la reprise</span>
      <span class="text-[13px] text-text-dim">{{ pause.watchZones.join(' · ') }}</span>
    </div>

    <div>
      <button type="button" class="btn" :disabled="pending" @click="resume">
        Marquer la reprise
      </button>
    </div>
  </div>
</template>
