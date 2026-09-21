<script setup lang="ts">
import { MIN_LOGIN_LENGTH, MIN_PASSWORD_LENGTH } from '~~/server/domain/account/account'

definePageMeta({ layout: false })

const route = useRoute()
const token = computed(() => String(route.params.token))

const login = ref('')
const password = ref('')
const error = ref('')
/** Verrou du chemin clavier : Entrée passe par le formulaire, pas par le bouton. */
const pending = ref(false)
/**
 * Le compte vient d'être ouvert : la session passe à « connectée » avant que
 * la navigation parte, et sans ce drapeau l'écran « tu es déjà connecté »
 * s'affiche une fraction de seconde à la place du succès.
 */
const created = ref(false)
const { fetch: refreshSession, clear: clearSession, loggedIn, user } = useUserSession()

/** Un lien d'invitation ouvre un compte : il n'en remplace pas un déjà ouvert. */
async function leave() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clearSession()
}

const canSubmit = computed(
  () =>
    login.value.trim().length >= MIN_LOGIN_LENGTH && password.value.length >= MIN_PASSWORD_LENGTH,
)

async function submit() {
  pending.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { token: token.value, login: login.value, password: password.value },
    })
    created.value = true
    await refreshSession()
    /** Le compte créé, l'onboarding enchaîne : c'est la suite du même geste. */
    await navigateTo('/bienvenue')
  } catch (failure) {
    error.value = apiMessage(failure, 'Création impossible.')
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <form class="tile w-full max-w-[400px] gap-4" @submit.prevent="submit">
      <div
        class="display flex items-center gap-[10px] text-xl font-bold tracking-[0.06em] uppercase"
      >
        <UiAppIcon name="logo" :size="20" class="text-accent" />
        <span>Cockpit</span>
      </div>
      <template v-if="loggedIn && !created">
        <p class="text-[14px]">
          Tu es déjà connecté en tant que
          <span class="mono">{{ user?.login }}</span
          >. Une invitation ouvre un compte, elle n'en remplace pas un : déconnecte-toi pour
          l'utiliser, ou reste où tu es.
        </p>
        <button type="button" class="btn btn-lg" @click="leave">Se déconnecter</button>
        <NuxtLink to="/" class="text-[13px] text-text-dim">Retourner au cockpit</NuxtLink>
      </template>

      <template v-else>
        <p class="text-[14px]">
          Tu as reçu une invitation. Choisis un identifiant et un mot de passe : le cockpit te
          posera ensuite six questions pour construire ton plan.
        </p>
        <label class="flex flex-col gap-[6px]">
          <span class="label">Identifiant</span>
          <input v-model="login" type="text" class="input" autocomplete="username" />
          <span class="text-[12px] text-text-dim">
            Minuscules, chiffres, point, tiret ou souligné. {{ MIN_LOGIN_LENGTH }} caractères au
            moins.
          </span>
        </label>
        <label class="flex flex-col gap-[6px]">
          <span class="label">Mot de passe</span>
          <input v-model="password" type="password" class="input" autocomplete="new-password" />
          <span class="text-[12px] text-text-dim">
            {{ MIN_PASSWORD_LENGTH }} caractères au moins.
          </span>
        </label>
        <span v-if="error" class="text-[13px] text-warn">{{ error }}</span>
        <UiActionButton
          type="submit"
          class="btn btn-lg"
          :disabled="!canSubmit"
          :pending="pending"
          :action="submit"
        >
          Créer mon compte
        </UiActionButton>
      </template>
    </form>
  </div>
</template>
