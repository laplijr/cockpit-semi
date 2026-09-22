<script setup lang="ts">
/**
 * L'interrupteur des rappels (§ 9, P7.2). La permission se demande sur ce
 * clic et jamais au chargement : un navigateur refuse la demande spontanée,
 * et la refuser une fois la ferme pour de bon.
 */
const notices = useBrowserNotices()
</script>

<template>
  <div class="tile">
    <span class="label">Rappels du navigateur</span>

    <p class="text-[13px] text-text-dim">
      Un rappel quand un ressenti manque ou qu'une décision attend, depuis un onglet ouvert.
    </p>

    <template v-if="!notices.supported">
      <span class="mono text-[12px] text-text-dim">
        Ce navigateur ne sait pas afficher de notification.
      </span>
    </template>

    <template v-else-if="notices.permission.value === 'denied'">
      <span class="mono text-[12px] text-warn">
        Les notifications sont bloquées pour ce site. Elles se débloquent depuis les réglages du
        navigateur, pas depuis le cockpit.
      </span>
    </template>

    <template v-else-if="notices.enabled.value">
      <span class="mono text-[12px] text-text-dim">Rappels actifs sur cet appareil.</span>
      <button type="button" class="btn btn-ghost self-start" @click="notices.disable()">
        Désactiver les rappels
      </button>
    </template>

    <template v-else>
      <button type="button" class="btn self-start" @click="notices.enable()">
        Activer les rappels
      </button>
    </template>
  </div>
</template>
