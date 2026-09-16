<script setup lang="ts">
const { clear: clearSession } = useUserSession()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clearSession()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <UiPhaseStub phase="P1">
      Poids, FCmax, jours disponibles, contraintes et préférences.
    </UiPhaseStub>
    <div>
      <button type="button" class="btn btn-ghost" @click="logout">Se déconnecter</button>
    </div>
  </div>
</template>
