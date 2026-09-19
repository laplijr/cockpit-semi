<script setup lang="ts">
const { data } = await useFetch('/api/nutrition')

const ui = useUiStore()

const today = computed(() => data.value?.days[0])
const raceWeek = computed(() => data.value?.raceWeek ?? null)
</script>

<template>
  <div v-if="data" class="flex flex-col gap-4">
    <!-- Sans le poids, les repères restent en g/kg : ils ne mentent pas. -->
    <div v-if="data.weightKg === null" class="tile border-dashed">
      <span class="label">Poids non renseigné</span>
      <p class="text-[13px] text-text-dim">
        Poids manquant : saisis-le dans Profil pour lire des grammes.
      </p>
    </div>

    <section class="grid grid-cols-2 gap-4">
      <!-- Ouvrir le jour ne génère rien : le détail porte le bouton (§ 1, P6.4). -->
      <button
        v-for="(day, index) in data.days"
        :key="day.date"
        type="button"
        class="tile tile-action text-left"
        @click="ui.openDay(day.date)"
      >
        <div class="flex items-baseline gap-3">
          <span class="label">{{ index === 0 ? "Aujourd'hui" : 'Demain' }}</span>
          <span class="mono text-[11.5px] text-text-dim">{{ formatLongDate(day.date) }}</span>
          <span class="pill ml-auto">{{ DAY_KIND_LABELS[day.kind] ?? day.kind }}</span>
        </div>

        <span class="display text-[30px] leading-none font-bold">
          {{ day.carbsG ? formatRange(day.carbsG, 'g') : formatRange(day.carbsGPerKg, 'g/kg') }}
        </span>
        <span class="mono text-[11.5px] text-text-dim">
          de glucides sur la journée<template v-if="day.carbsG">
            · {{ formatRange(day.carbsGPerKg, 'g/kg') }}</template
          >
        </span>

        <div
          v-for="session in day.sessions"
          :key="session.code"
          class="flex flex-col gap-px border-t border-line-soft pt-2"
        >
          <span class="flex items-baseline gap-2">
            <UiAppIcon
              :name="sportStyle(session.sport).icon"
              :size="14"
              :class="sportStyle(session.sport).tone"
            />
            <span class="text-[13px]">{{ SESSION_LABELS[session.code] ?? session.code }}</span>
            <span class="mono text-[11.5px] text-text-dim">
              {{ formatMinutes(session.durationMin) }}
            </span>
            <span v-if="session.fuel.carbsGPerHour" class="pill ml-auto">
              {{ formatRange(session.fuel.carbsGPerHour, 'g/h') }}
            </span>
            <span v-else class="pill ml-auto">eau seule</span>
          </span>
          <span class="text-[12px] text-text-dim">{{ session.fuel.advice }}</span>
        </div>

        <p v-if="day.sessions.length === 0" class="text-[12.5px] text-text-dim">Aucune séance.</p>

        <span class="mono text-[11.5px]" :class="day.mealPlan ? 'text-text-dim' : 'text-accent'">
          {{ day.mealPlan ? `${day.mealPlan.length} repas proposés` : 'repas à demander' }}
        </span>
      </button>
    </section>

    <!-- Protocole : il n'apparaît qu'à J−7, quand il sert (§ 5). -->
    <section v-if="raceWeek" class="tile" style="border-color: rgba(242, 162, 58, 0.35)">
      <div class="flex items-baseline gap-3">
        <span class="label">Semaine de course · {{ raceWeek.race.name }}</span>
        <span class="mono text-[11.5px] text-text-dim">
          {{ formatDate(raceWeek.race.date) }} · J−{{ raceWeek.daysToRace }}
        </span>
      </div>

      <div
        v-for="day in raceWeek.protocol"
        :key="day.date"
        class="grid grid-cols-[88px_150px_1fr] items-baseline gap-3 border-t border-line-soft py-2 first:border-t-0"
      >
        <span class="mono text-[12px]" :class="day.daysBefore === 0 && 'text-accent'">
          J−{{ day.daysBefore }} · {{ formatDate(day.date) }}
        </span>
        <span class="mono text-[12.5px]">
          {{ day.carbsG ? formatRange(day.carbsG, 'g') : formatRange(day.carbsGPerKg, 'g/kg') }}
        </span>
        <div class="flex flex-col gap-px">
          <span class="text-[13px]">{{ day.headline }}</span>
          <span v-for="detail in day.details" :key="detail" class="text-[12px] text-text-dim">
            {{ detail }}
          </span>
        </div>
      </div>
    </section>

    <section v-if="raceWeek?.fuelPlan" class="tile">
      <div class="flex items-baseline gap-3">
        <span class="label">Ravito et hydratation en course</span>
        <span class="mono text-[11.5px] text-text-dim">
          projection {{ formatDuration(raceWeek.fuelPlan.durationS) }} ·
          {{ formatDistance(raceWeek.fuelPlan.distanceM) }}
          <template v-if="raceWeek.fuelPlan.tempC !== null">
            · {{ raceWeek.fuelPlan.tempC }} °C attendus
          </template>
        </span>
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Glucides</span>
          <span class="mono text-[17px]">
            {{ formatRange(raceWeek.fuelPlan.carbsGPerHour, 'g/h') }}
          </span>
        </div>
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Eau</span>
          <span class="mono text-[17px]">
            {{ formatRange(raceWeek.fuelPlan.waterMlPerHour, 'ml/h') }}
          </span>
        </div>
        <div class="tile bg-surface-inset">
          <span class="label text-[10.5px]">Sodium</span>
          <span class="mono text-[17px]">
            {{ formatRange(raceWeek.fuelPlan.sodiumMgPerHour, 'mg/h') }}
          </span>
        </div>
      </div>

      <RacesFuelIntakes :intakes="raceWeek.fuelPlan.intakes" />

      <p v-for="note in raceWeek.fuelPlan.notes" :key="note" class="text-[12.5px] text-text-dim">
        {{ note }}
      </p>
    </section>

    <section class="tile">
      <span class="label">Repères par type de jour <UiInfoHint term="reperesMacro" /></span>

      <table class="w-full text-[13px]">
        <thead>
          <tr class="text-left">
            <th
              v-for="head in ['Type de jour', 'Glucides', 'Protéines', 'Lipides']"
              :key="head"
              class="label pb-2 text-[10px]"
            >
              {{ head }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in data.references"
            :key="row.kind"
            class="border-t border-line-soft"
            :class="row.kind === today?.kind && 'text-accent'"
          >
            <td class="py-[6px]">{{ DAY_KIND_LABELS[row.kind] ?? row.kind }}</td>
            <td class="mono py-[6px]">
              {{ formatRange(row.carbsGPerKg, 'g/kg') }}
              <span v-if="row.carbsG" class="text-text-dim">
                · {{ formatRange(row.carbsG, 'g') }}
              </span>
            </td>
            <td class="mono py-[6px]">
              {{ formatRange(row.proteinGPerKg, 'g/kg') }}
              <span v-if="row.proteinG" class="text-text-dim">
                · {{ formatRange(row.proteinG, 'g') }}
              </span>
            </td>
            <td class="mono py-[6px]">
              {{ formatRange(row.fatGPerKg, 'g/kg') }}
              <span v-if="row.fatG" class="text-text-dim">
                · {{ formatRange(row.fatG, 'g') }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
