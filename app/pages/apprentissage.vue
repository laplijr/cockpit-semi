<script setup lang="ts">
const { data, refresh } = await useFetch('/api/learning')

const busy = ref(0)

const habits = computed(() => data.value?.habits ?? [])
const pending = computed(() => habits.value.filter((item) => item.status === 'detectee'))
const applied = computed(() => habits.value.filter((item) => item.status === 'acceptee'))
const refused = computed(() => habits.value.filter((item) => item.status === 'refusee'))

const calibrations = computed(() => data.value?.calibrations ?? [])
const latest = computed(() => calibrations.value[0] ?? null)
/** Les trois semaines qui précèdent la mesure courante : au-delà, la tendance ne se lit plus. */
const previous = computed(() => calibrations.value.slice(1, 4))

async function decide(id: number, status: string) {
  busy.value = id
  try {
    await $fetch(`/api/habits/${id}`, { method: 'PUT', body: { status } })
    await refresh()
  } finally {
    busy.value = 0
  }
}
</script>

<template>
  <div v-if="data" class="flex flex-col gap-4">
    <!-- Ce qui attend une décision passe devant : c'est la seule zone d'action. -->
    <section class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label"><UiInfoHint term="habitude">À décider</UiInfoHint></span>
        <!-- Un paramètre de lecture, pas une définition : combien attendent (§ 8, P6.35). -->
        <span class="mono text-[11.5px] text-text-dim">
          {{ pending.length }} détectée{{ pending.length > 1 ? 's' : '' }}
        </span>
      </div>

      <p v-if="pending.length === 0" class="text-[13px] text-text-dim">Aucune habitude détectée.</p>

      <div
        v-for="item in pending"
        :key="item.id"
        class="flex items-start gap-4 border-t border-line-soft py-3 first:border-t-0"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-px">
          <span class="text-[13.5px]">{{ item.statement }}</span>
          <span class="mono text-[11.5px] text-text-dim">
            {{ HABIT_LABELS[item.type] ?? item.type }} · {{ item.matched }} cas sur
            {{ item.total }} · confiance {{ Math.round(item.confidence * 100) }} %
          </span>
        </div>
        <button
          type="button"
          class="btn shrink-0"
          :disabled="busy === item.id"
          @click="decide(item.id, 'acceptee')"
        >
          Accepter
        </button>
        <button
          type="button"
          class="shrink-0 text-[12.5px] text-text-dim hover:text-text"
          :disabled="busy === item.id"
          @click="decide(item.id, 'refusee')"
        >
          Refuser
        </button>
      </div>
    </section>

    <section class="grid grid-cols-2 gap-4">
      <div class="tile">
        <span class="label"><UiInfoHint term="regleApprise">Règles personnelles</UiInfoHint></span>

        <p v-if="applied.length === 0" class="text-[13px] text-text-dim">Aucune règle apprise.</p>

        <div
          v-for="item in applied"
          :key="item.id"
          class="flex items-start gap-3 border-t border-line-soft py-2 first:border-t-0"
        >
          <div class="flex min-w-0 flex-1 flex-col gap-px">
            <span class="text-[13px]">{{ item.statement }}</span>
            <span class="mono text-[11.5px] text-text-dim">
              {{ item.matched }} / {{ item.total }} · confiance
              {{ Math.round(item.confidence * 100) }} %
            </span>
          </div>
          <button
            type="button"
            class="shrink-0 text-[12.5px] text-text-dim hover:text-text"
            :disabled="busy === item.id"
            @click="decide(item.id, 'detectee')"
          >
            Retirer
          </button>
        </div>
      </div>

      <div class="tile">
        <div class="flex items-baseline gap-3">
          <span class="label"><UiInfoHint term="calibration">Calibration</UiInfoHint></span>
          <span v-if="latest" class="mono text-[11.5px] text-text-dim">
            semaine du {{ formatDate(latest.date) }}
          </span>
        </div>

        <p v-if="!latest" class="text-[13px] text-text-dim">Aucune mesure de calibration.</p>

        <template v-else>
          <div class="grid grid-cols-3 gap-3">
            <div class="flex flex-col">
              <span class="label text-[10px]">Écart de RPE</span>
              <span class="mono text-[17px]" :class="latest.rpeError > 0.5 && 'text-warn'">
                {{ latest.rpeError > 0 ? '+' : '' }}{{ formatDecimal(latest.rpeError) }}
              </span>
              <span class="mono text-[10.5px] text-text-dim">
                {{ latest.samples.rpe }} séances
              </span>
            </div>
            <div class="flex flex-col">
              <span class="label text-[10px]">Acceptation</span>
              <span class="mono text-[17px]">
                {{
                  latest.acceptanceRate === null
                    ? '—'
                    : `${Math.round(latest.acceptanceRate * 100)} %`
                }}
              </span>
              <span class="mono text-[10.5px] text-text-dim">
                {{ latest.samples.decisions }} décisions
              </span>
            </div>
            <div class="flex flex-col">
              <span class="label text-[10px]">Projection</span>
              <span class="mono text-[17px]">
                {{ formatDecimal(latest.projectionGap) }}
              </span>
              <span class="mono text-[10.5px] text-text-dim">
                {{ latest.samples.tests }} test{{ latest.samples.tests > 1 ? 's' : '' }}
              </span>
            </div>
          </div>

          <table v-if="previous.length > 0" class="w-full text-[12.5px]">
            <tbody>
              <tr v-for="week in previous" :key="week.date" class="border-t border-line-soft">
                <td class="mono py-[5px] text-text-dim">{{ formatDate(week.date) }}</td>
                <td class="mono py-[5px] text-right">
                  RPE {{ week.rpeError > 0 ? '+' : '' }}{{ formatDecimal(week.rpeError) }}
                </td>
                <td class="mono py-[5px] text-right text-text-dim">
                  {{
                    week.acceptanceRate === null
                      ? '—'
                      : `${Math.round(week.acceptanceRate * 100)} %`
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>
    </section>

    <section v-if="refused.length > 0" class="tile">
      <span class="label">Écartées</span>
      <div
        v-for="item in refused"
        :key="item.id"
        class="flex items-baseline gap-3 border-t border-line-soft py-2 first:border-t-0"
      >
        <span class="text-[13px] text-text-dim">{{ item.statement }}</span>
        <button
          type="button"
          class="mono ml-auto text-[11.5px] text-text-dim hover:text-text"
          :disabled="busy === item.id"
          @click="decide(item.id, 'detectee')"
        >
          Remettre à décider
        </button>
      </div>
    </section>
  </div>
</template>
