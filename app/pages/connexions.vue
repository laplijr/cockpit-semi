<script setup lang="ts">
import { ImportOutcome, type ImportReport } from '~~/server/application/import-activities'

const { data, refresh } = await useFetch('/api/activities/latest')

/** Ce qu'il est advenu de chaque fichier, dit en toutes lettres (§ 9, P6.7). */
const OUTCOME_LABELS: Record<string, string> = {
  [ImportOutcome.Linked]: 'rattachée',
  [ImportOutcome.Unplanned]: 'hors plan',
  [ImportOutcome.Duplicate]: 'déjà connue',
  [ImportOutcome.Unreadable]: 'illisible',
}

const report = ref<ImportReport | null>(null)
const pending = ref(false)
const error = ref<string | null>(null)
const dropping = ref(false)
const input = useTemplateRef<HTMLInputElement>('picker')

async function send(files: File[]) {
  if (files.length === 0 || pending.value) return

  pending.value = true
  error.value = null

  const body = new FormData()
  for (const file of files) body.append('files', file)

  try {
    report.value = await $fetch<ImportReport>('/api/activities/import', { method: 'POST', body })
    await refresh()
  } catch (cause) {
    error.value = apiMessage(cause, 'L’import a échoué.')
  } finally {
    pending.value = false
  }
}

function onDrop(event: DragEvent) {
  dropping.value = false
  send([...(event.dataTransfer?.files ?? [])])
}

function onPick(event: Event) {
  const picked = (event.target as HTMLInputElement).files
  send([...(picked ?? [])])
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!--
      Deux API fermées à deux jours d'écart : la page dit les deux décisions
      côte à côte, puis ce qui les remplace (§ 7, P6.7).
    -->
    <div class="tile">
      <div class="flex items-center gap-2">
        <UiAppIcon name="strava" class="text-strava" />
        <span class="label">Strava</span>
        <span class="pill ml-auto">non connectée</span>
      </div>
      <p class="text-[13px] text-text-dim">
        L'accès à l'API Strava est passé derrière l'abonnement payant. Le cockpit n'a donc aucune
        connexion automatique : le réalisé se saisit à la main, ou s'importe depuis un fichier.
      </p>
      <div class="flex flex-col gap-1 border-t border-line-soft pt-2">
        <span class="label text-[10px]">Ce que ça change</span>
        <ul class="flex flex-col gap-1 text-[13px] text-text-dim">
          <li>
            Une séance se marque faite depuis le cockpit, ressenti compris, en une vingtaine de
            secondes.
          </li>
          <li>
            Le ratio de charge attend 28 jours de saisie au lieu d'être fourni d'emblée par
            l'import.
          </li>
          <li>Les allures et la FC ne remontent pas seules : elles sont saisies ou importées.</li>
        </ul>
      </div>
    </div>

    <div class="tile">
      <div class="flex items-center gap-2">
        <UiAppIcon name="watch" />
        <span class="label">Garmin</span>
        <span class="pill ml-auto">par câble</span>
      </div>
      <p class="text-[13px] text-text-dim">
        La Training API de Garmin publierait les séances structurées dans le calendrier de la
        montre, mais le programme développeur est réservé aux personnes morales et les approbations
        sont suspendues. Reste le câble, qui ne dépend d'aucune politique commerciale : branchée en
        USB, la montre se monte comme un disque.
      </p>
      <div class="flex flex-col gap-1 border-t border-line-soft pt-2">
        <span class="label text-[10px]">Les deux sens du pont</span>
        <ul class="flex flex-col gap-1 text-[13px] text-text-dim">
          <li>
            La séance part depuis son dialog, en un fichier à déposer dans
            <span class="mono">GARMIN/NEWFILES/</span>.
          </li>
          <li>
            Le réalisé revient ici : les fichiers de
            <span class="mono">GARMIN/ACTIVITY/</span> se déposent ci-dessous.
          </li>
        </ul>
      </div>
    </div>

    <div class="tile">
      <span class="label">Importer des activités</span>

      <!-- Déposer un dossier entier doit marcher : l'import est idempotent. -->
      <div
        class="flex flex-col items-center gap-2 rounded border border-dashed border-line px-4 py-6 text-center"
        :class="dropping && 'border-accent bg-surface-inset'"
        @dragover.prevent="dropping = true"
        @dragleave.prevent="dropping = false"
        @drop.prevent="onDrop"
      >
        <span class="text-[13px] text-text-dim">
          Déposez ici les fichiers <span class="mono">.fit</span> de la montre, ou
        </span>

        <button type="button" class="btn btn-ghost" :disabled="pending" @click="input?.click()">
          <UiAppIcon name="plug" :size="15" />
          {{ pending ? 'Import en cours…' : 'Choisir des fichiers' }}
        </button>

        <span class="mono text-[11.5px] text-text-dim">
          Un fichier déjà importé est reconnu et ignoré.
        </span>

        <input ref="picker" type="file" accept=".fit" multiple class="hidden" @change="onPick" />
      </div>

      <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>

      <!-- Le compte rendu, ligne par ligne : c'est lui qui dit ce qui est entré. -->
      <template v-if="report">
        <div class="flex items-baseline gap-3 border-t border-line-soft pt-2">
          <span class="label text-[10px]">Compte rendu</span>
          <span class="mono text-[11.5px] text-text-dim">
            {{ report.linked }} rattachée{{ report.linked > 1 ? 's' : '' }} ·
            {{ report.unplanned }} hors plan · {{ report.duplicates }} déjà connue{{
              report.duplicates > 1 ? 's' : ''
            }}
            · {{ report.unreadable }} illisible{{ report.unreadable > 1 ? 's' : '' }}
          </span>
        </div>

        <div
          v-for="line in report.lines"
          :key="line.file"
          class="flex items-baseline gap-3 border-t border-line-soft py-[6px] text-[13px] first:border-t-0"
        >
          <span class="mono min-w-0 flex-1 truncate text-text-dim">{{ line.file }}</span>

          <span v-if="line.date" class="mono text-[11.5px] text-text-dim">
            {{ formatDate(line.date) }}
            <template v-if="line.distanceM"> · {{ formatDistance(line.distanceM) }}</template>
          </span>

          <span
            class="pill"
            :class="{
              'pill-done': line.outcome === ImportOutcome.Linked,
              'pill-warn': line.outcome === ImportOutcome.Unreadable,
            }"
          >
            {{ OUTCOME_LABELS[line.outcome] }}
            <template v-if="line.sessionCode">
              · {{ SESSION_LABELS[line.sessionCode] ?? line.sessionCode }}
            </template>
          </span>
        </div>

        <p class="text-[13px] text-text-dim">
          L'import remplit le réalisé, pas le ressenti : le RPE est déduit de la fréquence
          cardiaque, les sensations et le sommeil restent à saisir dans le retour de séance.
        </p>
      </template>

      <div class="flex flex-col gap-1 border-t border-line-soft pt-2">
        <span class="label text-[10px]">Dernier import</span>
        <span class="mono text-[15px]">
          {{ data?.lastImportedDate ? formatDate(data.lastImportedDate) : 'aucun' }}
        </span>
      </div>
    </div>
  </div>
</template>
