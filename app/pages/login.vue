<script setup lang="ts">
definePageMeta({ layout: false })

const password = ref('')
const error = ref('')
const pending = ref(false)
const { fetch: refreshSession } = useUserSession()

async function submit() {
  pending.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { password: password.value } })
    await refreshSession()
    await navigateTo('/')
  } catch {
    error.value = 'Mot de passe incorrect'
    password.value = ''
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <form class="tile w-[360px] gap-4" @submit.prevent="submit">
      <div
        class="display flex items-center gap-[10px] text-xl font-bold tracking-[0.06em] uppercase"
      >
        <UiAppIcon name="logo" :size="20" class="text-accent" />
        <span>Cockpit</span>
      </div>
      <label class="flex flex-col gap-[6px]">
        <span class="label">Mot de passe</span>
        <input v-model="password" type="password" class="input" autocomplete="current-password" />
      </label>
      <span v-if="error" class="text-[13px] text-warn">{{ error }}</span>
      <button type="submit" class="btn btn-lg" :disabled="pending || !password">Entrer</button>
    </form>
  </div>
</template>
