<script setup lang="ts">
const { data, refresh } = await useFetch('/api/learning')

/** Verrou de rangée : l'habitude qu'on décide, pas le bouton qui la décide. */
const busy = ref(0)

const habits = computed(() => data.value?.habits ?? [])
const pending = computed(() => habits.value.filter((item) => item.status === 'detectee'))
const applied = computed(() => habits.value.filter((item) => item.status === 'acceptee'))
const refused = computed(() => habits.value.filter((item) => item.status === 'refusee'))

/**
 * Le moteur détecte plus vite que Ronan ne décide : neuf habitudes en attente
 * tenaient la tuile sur 690 px. Cinq par page, comme les deux listes qu'elles
 * alimentent (§ 8).
 */
const PER_PAGE = 5
const pendingPage = usePagedList(() => pending.value, PER_PAGE)
const appliedPage = usePagedList(() => applied.value, PER_PAGE)
const refusedPage = usePagedList(() => refused.value, PER_PAGE)

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

      <!--
        Accepter et refuser sont les deux faces d'une même décision : deux
        boutons de même poids, alignés sur la ligne. Un bouton accent par
        habitude ferait neuf actions principales dans une seule tuile, et plus
        aucune ne ressortirait (§ 8).
      -->
      <div
        v-for="item in pendingPage.items"
        :key="item.id"
        class="flex items-center gap-4 border-t border-line-soft py-3 first:border-t-0"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-px">
          <span class="text-[13.5px]">{{ item.statement }}</span>
          <span class="mono text-[11.5px] text-text-dim">
            {{ HABIT_LABELS[item.type] ?? item.type }} · {{ item.matched }} cas sur
            {{ item.total }} · confiance {{ Math.round(item.confidence * 100) }} %
          </span>
        </div>

        <div class="flex shrink-0 gap-2">
          <UiActionButton
            class="btn btn-ghost"
            :pending="busy === item.id"
            :action="() => decide(item.id, 'acceptee')"
          >
            Accepter
          </UiActionButton>
          <UiActionButton
            class="btn btn-ghost"
            :pending="busy === item.id"
            :action="() => decide(item.id, 'refusee')"
          >
            Refuser
          </UiActionButton>
        </div>
      </div>

      <UiPager v-model="pendingPage.page" :total="pendingPage.total" :per-page="PER_PAGE" />
    </section>

    <section class="fold-2 grid gap-4">
      <div class="tile">
        <span class="label"><UiInfoHint term="regleApprise">Règles personnelles</UiInfoHint></span>

        <p v-if="applied.length === 0" class="text-[13px] text-text-dim">Aucune règle apprise.</p>

        <div
          v-for="item in appliedPage.items"
          :key="item.id"
          class="flex items-center gap-3 border-t border-line-soft py-2 first:border-t-0"
        >
          <div class="flex min-w-0 flex-1 flex-col gap-px">
            <span class="text-[13px]">{{ item.statement }}</span>
            <span class="mono text-[11.5px] text-text-dim">
              {{ item.matched }} / {{ item.total }} · confiance
              {{ Math.round(item.confidence * 100) }} %
            </span>
          </div>
          <UiActionButton
            class="btn btn-ghost shrink-0"
            :pending="busy === item.id"
            :action="() => decide(item.id, 'detectee')"
          >
            Retirer
          </UiActionButton>
        </div>

        <UiPager v-model="appliedPage.page" :total="appliedPage.total" :per-page="PER_PAGE" />
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
          <div class="fold-3 grid gap-3">
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

          <UiAxisScroller v-if="previous.length > 0">
            <table class="table-axis w-full text-[12.5px]">
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
          </UiAxisScroller>
        </template>
      </div>
    </section>

    <section v-if="refused.length > 0" class="tile">
      <span class="label">Écartées</span>
      <div
        v-for="item in refusedPage.items"
        :key="item.id"
        class="flex items-center gap-3 border-t border-line-soft py-2 first:border-t-0"
      >
        <span class="min-w-0 flex-1 text-[13px] text-text-dim">{{ item.statement }}</span>
        <UiActionButton
          class="btn btn-ghost ml-auto shrink-0"
          :pending="busy === item.id"
          :action="() => decide(item.id, 'detectee')"
        >
          Remettre à décider
        </UiActionButton>
      </div>

      <UiPager v-model="refusedPage.page" :total="refusedPage.total" :per-page="PER_PAGE" />
    </section>
  </div>
</template>
