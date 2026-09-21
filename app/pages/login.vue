<script setup lang="ts">
definePageMeta({ layout: false })

const login = ref('')
const password = ref('')
const error = ref('')
/** Verrou du chemin clavier : Entrée passe par le formulaire, pas par le bouton. */
const pending = ref(false)
const { fetch: refreshSession } = useUserSession()

async function submit() {
  pending.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { login: login.value, password: password.value },
    })
    await refreshSession()
    await navigateTo('/')
  } catch {
    /** Un seul message : dire lequel des deux est faux dirait qui a un compte. */
    error.value = 'Identifiant ou mot de passe incorrect'
    password.value = ''
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center px-4">
    <form class="tile w-full max-w-[360px] gap-4" @submit.prevent="submit">
      <div
        class="display flex items-center gap-[10px] text-xl font-bold tracking-[0.06em] uppercase"
      >
        <UiAppIcon name="logo" :size="20" class="text-accent" />
        <span>Cockpit</span>
      </div>
      <label class="flex flex-col gap-[6px]">
        <span class="label">Identifiant</span>
        <input v-model="login" type="text" class="input" autocomplete="username" />
      </label>
      <label class="flex flex-col gap-[6px]">
        <span class="label">Mot de passe</span>
        <input v-model="password" type="password" class="input" autocomplete="current-password" />
      </label>
      <span v-if="error" class="text-[13px] text-warn">{{ error }}</span>
      <UiActionButton
        type="submit"
        class="btn btn-lg"
        :disabled="!login || !password"
        :pending="pending"
        :action="submit"
      >
        Entrer
      </UiActionButton>
      <p class="text-[12px] text-text-dim">
        Pas de mot de passe oublié : le cockpit est fermé, une nouvelle invitation le remplace.
      </p>
    </form>
  </div>
</template>
