<script setup lang="ts">
import { MIN_LOGIN_LENGTH, MIN_PASSWORD_LENGTH } from '~~/server/application/accounts'

definePageMeta({ layout: false })

const route = useRoute()
const token = computed(() => String(route.params.token))

const login = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)
const { fetch: refreshSession } = useUserSession()

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
      <p class="text-[14px]">
        Tu as reçu une invitation. Choisis un identifiant et un mot de passe : le cockpit te posera
        ensuite six questions pour construire ton plan.
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
      <button type="submit" class="btn btn-lg" :disabled="pending || !canSubmit">
        Créer mon compte
      </button>
    </form>
  </div>
</template>
