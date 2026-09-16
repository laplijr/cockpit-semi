<script setup lang="ts">
const { data } = await useFetch('/api/activities/latest')
</script>

<template>
  <div class="flex max-w-[860px] flex-col gap-4">
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
        <ul class="flex flex-col gap-1 text-[13px] text-text-muted">
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
      <span class="label">Import de fichier</span>
      <p class="text-[13px] text-text-dim">
        L'export officiel de Strava, gratuit, contient l'historique complet en CSV. Le skill
        <span class="mono">strava-import</span> le parse et le verse dans le cockpit.
      </p>
      <div class="flex flex-col gap-1 border-t border-line-soft pt-2">
        <span class="label text-[10px]">Dernier import</span>
        <span class="mono text-[15px]">
          {{ data?.lastImportedDate ? formatDate(data.lastImportedDate) : 'aucun' }}
        </span>
      </div>
    </div>

    <UiPhaseStub phase="P5">
      Connexion Claude pour l'Imprévu en texte libre et la recherche de course.
    </UiPhaseStub>
  </div>
</template>
