<script setup lang="ts">
import { CALL_LABELS } from '~~/server/domain/shared/external-call'

const { clear: clearSession } = useUserSession()
const { data: account, error: accountError, refresh } = await useFetch('/api/account')

/**
 * `useFetch` ne lève pas : sans ce garde, une session refusée peignait la
 * page entière à vide — tuiles sans contenu, section Invitations absente —
 * au lieu de dire qu'il faut se reconnecter (§ 8).
 */
if (accountError.value) {
  await clearSession()
  await navigateTo('/login')
}
const { data: invitations, refresh: refreshInvitations } = await useFetch('/api/invitations', {
  /** Réservée au compte principal : les autres n'ont rien à y lire. */
  immediate: false,
  default: () => [],
})

if (account.value?.owner) await refreshInvitations()

const label = ref('')
const confirmation = ref('')
const error = ref('')
const copied = ref<number | null>(null)

const origin = computed(() => (import.meta.client ? window.location.origin : ''))
const linkFor = (token: string) => `${origin.value}/rejoindre/${token}`

async function createInvitation() {
  error.value = ''
  try {
    await $fetch('/api/invitations', { method: 'POST', body: { label: label.value || null } })
    label.value = ''
    await refreshInvitations()
  } catch (failure) {
    error.value = apiMessage(failure, 'Invitation impossible.')
  }
}

async function revoke(id: number) {
  await $fetch(`/api/invitations/${id}`, { method: 'DELETE' })
  await refreshInvitations()
}

async function copy(item: { id: number; token: string }) {
  await navigator.clipboard.writeText(linkFor(item.token))
  copied.value = item.id
}

async function removeAccount() {
  error.value = ''
  try {
    await $fetch('/api/account', { method: 'DELETE', body: { login: confirmation.value } })
    await clearSession()
    await navigateTo('/login')
  } catch (failure) {
    error.value = apiMessage(failure, 'Suppression impossible.')
    await refresh()
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="tile">
      <span class="label">Compte</span>
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span class="display text-[24px] font-semibold">{{ account?.login }}</span>
        <span v-if="account?.createdAt" class="mono text-[12px] text-text-dim">
          ouvert le {{ formatDate(String(account.createdAt).slice(0, 10)) }}
        </span>
        <span v-if="account?.owner" class="pill ml-auto">compte principal</span>
      </div>
    </div>

    <div class="tile">
      <span class="label">Ce que le cockpit garde</span>
      <p class="text-[13px] text-text-dim">
        Tout reste sur la base du cockpit. Rien n'est vendu, rien n'est partagé, et aucune donnée
        d'entraînement n'est envoyée à un modèle de langage.
      </p>
      <ul class="flex flex-col gap-2">
        <li v-for="item in account?.stored ?? []" :key="item.label" class="flex flex-col gap-px">
          <span class="text-[14px]">{{ item.label }}</span>
          <span class="text-[12px] text-text-dim">{{ item.why }}</span>
        </li>
      </ul>
    </div>

    <div class="tile">
      <span class="label">Appels externes du jour</span>
      <p class="text-[13px] text-text-dim">
        L'Imprévu, la recherche de course et les itinéraires passent par des services payés par le
        compte principal. Au-delà du quota, la fonction attend demain ; le reste du cockpit
        fonctionne.
      </p>
      <p v-if="(account?.usage ?? []).length === 0" class="mono text-[12px] text-text-dim">
        Aucun appel aujourd'hui.
      </p>
      <div
        v-for="item in account?.usage ?? []"
        :key="item.kind"
        class="flex items-baseline gap-3 text-[13px]"
      >
        <span>{{ CALL_LABELS[item.kind] }}</span>
        <span class="mono ml-auto text-[12px] text-text-dim">
          {{ item.calls }} / {{ item.quota }}
        </span>
      </div>
    </div>

    <div v-if="account?.owner" class="tile">
      <span class="label">Invitations</span>
      <p class="text-[13px] text-text-dim">
        Le cockpit est fermé : on n'y entre que par un lien, transmis de la main à la main. Un lien
        ne sert qu'une fois.
      </p>

      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-1 flex-col gap-[6px]">
          <span class="label text-[10.5px]">Pour qui (facultatif)</span>
          <input v-model="label" type="text" class="input" placeholder="Camille" />
        </label>
        <UiActionButton class="btn" :action="createInvitation"> Générer un lien </UiActionButton>
      </div>

      <div
        v-for="item in invitations ?? []"
        :key="item.id"
        class="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line-soft pt-2"
      >
        <!-- Le sujet de la ligne est l'invitation, pas la personne : « Louise
             utilisée par… » faisait porter l'accord sur le mauvais mot. -->
        <span class="text-[13px]">
          {{ item.label ? `Pour ${item.label}` : 'Sans destinataire' }}
        </span>
        <span v-if="item.consumedAt" class="mono text-[12px] text-ok">
          compte ouvert : {{ item.consumedLogin }}
        </span>
        <span v-else class="mono text-[12px] text-text-dim">
          expire le {{ formatDate(String(item.expiresAt).slice(0, 10)) }}
        </span>
        <template v-if="!item.consumedAt">
          <button type="button" class="btn btn-ghost ml-auto" @click="copy(item)">
            {{ copied === item.id ? 'Lien copié' : 'Copier le lien' }}
          </button>
          <UiActionButton class="btn btn-ghost" :action="() => revoke(item.id)">
            Révoquer
          </UiActionButton>
        </template>
      </div>
    </div>

    <!-- Une personne qui teste doit pouvoir partir, et emporter ses données (§ 11). -->
    <div v-if="!account?.owner" class="tile" style="border-color: rgba(242, 162, 58, 0.35)">
      <span class="label">Supprimer mon compte</span>
      <p class="text-[13px] text-text-dim">
        Tout part : le plan, les courses, les séances, les ressentis, la charge, les propositions et
        le compte lui-même. C'est définitif et il n'y a pas de copie.
      </p>
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-1 flex-col gap-[6px]">
          <span class="label text-[10.5px]">Retape ton identifiant pour confirmer</span>
          <input
            v-model="confirmation"
            type="text"
            class="input"
            :placeholder="account?.login ?? ''"
          />
        </label>
        <UiActionButton
          class="btn"
          :disabled="confirmation.trim().toLowerCase() !== account?.login"
          :action="removeAccount"
        >
          Supprimer définitivement
        </UiActionButton>
      </div>
    </div>

    <p v-if="error" class="text-[13px] text-warn">{{ error }}</p>
  </div>
</template>
