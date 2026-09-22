<script setup lang="ts">
import { SegmentMode } from '~~/server/domain/races/race'

const props = defineProps<{
  raceId: number
  distanceM: number
  objectifS: number | null
  projectionS: number | null
}>()
const emit = defineEmits<{ saved: [] }>()

const SEGMENT_MODES = [
  { value: SegmentMode.Running, label: 'Couru' },
  { value: SegmentMode.WalkRun, label: 'Marche et course' },
  { value: SegmentMode.Walking, label: 'Marché' },
]

/** Longueur minimale d'un segment continu pour borner la forme (§ 5). */
const MIN_FLOOR_SEGMENT_KM = 10

interface SegmentRow {
  kmDebut: number | null
  kmFin: number | null
  mode: SegmentMode
  allure: string
}

const form = reactive({
  chrono: '',
  representative: true,
  incidentKm: null as number | null,
  incidentType: '',
  incidentNote: '',
  notes: '',
  segments: [] as SegmentRow[],
})

/**
 * Un chrono se saisit comme il se lit sur la montre, d'un seul tenant :
 * « 1:52:30 » ou « 42:15 ». Trois champs faisaient trois décisions pour une
 * seule valeur.
 */
function chronoToSeconds(value: string): number {
  const match = /^(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)$/.exec(value.trim())
  if (!match) return 0
  return Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

const resultatS = computed(() => chronoToSeconds(form.chrono))

/** Une allure se saisit comme elle se lit sur la montre : « 5:10 » au kilomètre. */
function paceToSeconds(value: string): number | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim())
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

const segments = computed(() =>
  form.segments
    .filter((row) => row.kmDebut !== null && row.kmFin !== null && row.kmFin > row.kmDebut)
    .map((row) => ({
      kmDebut: row.kmDebut!,
      kmFin: row.kmFin!,
      mode: row.mode,
      allureSKm: paceToSeconds(row.allure),
      note: null,
    })),
)

/**
 * Un chrono non représentatif n'apprend rien sans portion courue assez longue :
 * le dire avant l'envoi vaut mieux qu'un plancher silencieusement absent.
 */
const teachesNothing = computed(
  () =>
    !form.representative &&
    !segments.value.some(
      (segment) =>
        segment.mode === SegmentMode.Running &&
        segment.allureSKm !== null &&
        segment.kmFin - segment.kmDebut >= MIN_FLOOR_SEGMENT_KM,
    ),
)

function addSegment() {
  form.segments.push({ kmDebut: null, kmFin: null, mode: SegmentMode.Running, allure: '' })
}

const error = ref('')

async function save() {
  error.value = ''
  try {
    await $fetch(`/api/races/${props.raceId}/result`, {
      method: 'POST',
      body: {
        resultatS: resultatS.value,
        representative: form.representative,
        incident:
          form.representative || !form.incidentType.trim()
            ? null
            : {
                km: form.incidentKm ?? 0,
                type: form.incidentType.trim(),
                note: form.incidentNote.trim(),
              },
        segments: form.representative ? [] : segments.value,
        notes: form.notes.trim() || null,
      },
    })
    emit('saved')
  } catch (failure) {
    error.value = apiMessage(failure, 'Enregistrement impossible.')
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="tile bg-surface-inset">
      <span class="label text-[10.5px]">Ce qui était visé</span>
      <div class="grid fold-3 gap-4">
        <div class="flex flex-col">
          <span class="label text-[10px]">Distance</span>
          <span class="mono text-[17px]">{{ formatDistance(distanceM) }}</span>
        </div>
        <div class="flex flex-col">
          <span class="label text-[10px]">Objectif</span>
          <span class="mono text-[17px]">{{ formatDuration(objectifS) }}</span>
        </div>
        <div class="flex flex-col">
          <span class="label text-[10px]">Projection</span>
          <span class="mono text-[17px]">{{ formatDuration(projectionS) }}</span>
        </div>
      </div>
    </div>

    <label class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">Chrono réalisé</span>
      <input v-model="form.chrono" type="text" class="input mono" placeholder="1:52:30" />
      <span v-if="resultatS > 0" class="mono text-[12px] text-text-dim">
        {{ formatDuration(resultatS) }}
      </span>
    </label>

    <label class="flex items-center gap-2 text-[13px]">
      <input v-model="form.representative" type="checkbox" class="accent-accent" />
      <span>Ce chrono reflète ma forme</span>
    </label>
    <span class="text-[12px] text-text-dim">
      Décoche si la course a été faussée par un incident : le chrono est conservé, mais il ne
      calibre pas le VDOT.
    </span>

    <template v-if="!form.representative">
      <div class="grid fold-3 gap-3">
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">Incident au km</span>
          <input v-model.number="form.incidentKm" type="number" min="0" class="input mono" />
        </label>
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">Nature</span>
          <input v-model="form.incidentType" type="text" class="input" placeholder="blessure" />
        </label>
        <label class="flex flex-col gap-[6px]">
          <span class="label text-[10.5px]">Détail</span>
          <input
            v-model="form.incidentNote"
            type="text"
            class="input"
            placeholder="Douleur au genou droit"
          />
        </label>
      </div>

      <div class="flex flex-col gap-[6px]">
        <div class="flex items-center gap-3">
          <span class="label text-[10.5px]">Segments</span>
          <button
            type="button"
            class="btn btn-ghost ml-auto px-[10px] text-[12px] lean:h-7"
            @click="addSegment"
          >
            <UiAppIcon name="plus" :size="14" />
            Ajouter
          </button>
        </div>
        <div v-for="(segment, index) in form.segments" :key="index" class="grid fold-4 gap-3">
          <label class="flex flex-col gap-[6px]">
            <span class="label text-[10px]">Du km</span>
            <input v-model.number="segment.kmDebut" type="number" min="0" class="input mono" />
          </label>
          <label class="flex flex-col gap-[6px]">
            <span class="label text-[10px]">Au km</span>
            <input v-model.number="segment.kmFin" type="number" min="0" class="input mono" />
          </label>
          <label class="flex flex-col gap-[6px]">
            <span class="label text-[10px]">Mode</span>
            <select v-model="segment.mode" class="input">
              <option v-for="mode in SEGMENT_MODES" :key="mode.value" :value="mode.value">
                {{ mode.label }}
              </option>
            </select>
          </label>
          <label class="flex flex-col gap-[6px]">
            <span class="label text-[10px]">Allure (min:s / km)</span>
            <input v-model="segment.allure" type="text" class="input mono" placeholder="5:30" />
          </label>
        </div>
        <span v-if="teachesNothing" class="text-[12px] text-warn">
          Sans portion courue d'au moins {{ MIN_FLOOR_SEGMENT_KM }} km, ce chrono n'apprend rien au
          moteur : la course sera enregistrée sans toucher au VDOT.
        </span>
      </div>
    </template>

    <label class="flex flex-col gap-[6px]">
      <span class="label text-[10.5px]">Note</span>
      <input
        v-model="form.notes"
        type="text"
        class="input"
        placeholder="Couru à fond, sans incident"
      />
    </label>

    <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>

    <UiActionButton class="btn btn-lg" :disabled="resultatS <= 0" :action="save">
      Enregistrer le résultat
    </UiActionButton>
  </div>
</template>
