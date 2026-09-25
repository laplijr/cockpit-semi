<script setup lang="ts">
import type { PlanSession } from '~/stores/plan'

const { session, plannedMinutes } = defineProps<{ session: PlanSession; plannedMinutes: number }>()
</script>

<template>
  <div class="tile order-3 bg-surface-inset lean:order-none">
    <!-- Trois lignes courtes ne sont pas un objet à axe : la table se
         replie au lieu de défiler, et ses deux titres se disent une fois
         en tête (§ 8, P12). -->
    <!-- Avant le réalisé, le bloc alignait trois tirets : il n'apparaît
         qu'une fois la séance faite, la structure disait déjà le reste (P20). -->
    <span class="label text-caption">Prescrit contre réalisé</span>
    <table class="w-full text-body">
      <thead>
        <tr>
          <th class="label pb-1 text-left text-caption font-semibold"></th>
          <th class="label pb-1 text-right text-caption font-semibold">Prévu</th>
          <th class="label pb-1 text-right text-caption font-semibold">Réalisé</th>
        </tr>
      </thead>
      <tbody>
        <tr class="border-t border-line-soft">
          <td class="py-[6px] text-text-dim">Durée</td>
          <td class="mono py-[6px] text-right">{{ plannedMinutes }} min</td>
          <td class="mono py-[6px] text-right">
            {{ session.actualDurationMin ? `${session.actualDurationMin} min` : '—' }}
          </td>
        </tr>
        <tr v-if="session.prescription.totalDistanceM > 0" class="border-t border-line-soft">
          <td class="py-[6px] text-text-dim">Distance</td>
          <td class="mono py-[6px] text-right">
            {{ formatDistance(session.prescription.totalDistanceM) }}
          </td>
          <td class="mono py-[6px] text-right">
            {{ session.actualDistanceM ? formatDistance(session.actualDistanceM) : '—' }}
          </td>
        </tr>
        <tr class="border-t border-line-soft">
          <td class="py-[6px] text-text-dim">RPE</td>
          <td class="mono py-[6px] text-right">{{ session.prescription.expectedRpe }}</td>
          <td class="mono py-[6px] text-right">{{ session.feedbackRpe ?? '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
