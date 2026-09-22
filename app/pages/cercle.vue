<script setup lang="ts">
/**
 * Le cercle (§ 8, P9) : l'axe des semaines, les jours du plus récent au plus
 * ancien, les publications en grille. **Une semaine, pas un flux** — on recule
 * d'une semaine à la fois, il n'y a pas de défilement infini, et la semaine à
 * venir n'existe pas puisqu'on ne publie que du passé.
 */
import { weekOf } from '~~/server/domain/circle/post'

const circle = useCircleStore()

/** Ouvrir la page, c'est avoir vu : le point s'éteint ici et nulle part ailleurs. */
const { markSeen } = useCircleUnread()

/**
 * La semaine se charge après la page, jamais avant. Un `await` dans `setup`
 * suspendait le changement de route : l'écran gardait la page précédente le
 * temps de la requête, et le geste n'avait aucune trace. Souvent le menu a
 * déjà lancé la requête, et il n'y a plus rien à attendre.
 */
onMounted(() => {
  circle.ensureLoaded()
  markSeen()
})

const view = computed(() => circle.view)

/**
 * Cinq semaines sur l'axe, et **la semaine courante en fait toujours partie**
 * tant qu'elle est à moins de cinq : une fenêtre qui ne montrerait que le
 * passé de la semaine lue laisserait sans chemin de retour.
 */
const axis = computed(() => {
  const from = view.value?.week.from
  if (!from || !view.value) return []

  const current = weekOf(view.value.today).from
  const gap = Math.round((Date.parse(current) - Date.parse(from)) / (7 * 86_400_000))
  const ahead = Math.min(4, Math.max(0, gap))

  return Array.from({ length: 5 }, (_, index) => shiftFrom(from, index - (4 - ahead)))
})

function shiftFrom(from: string, weeks: number): string {
  return new Date(new Date(`${from}T00:00:00Z`).getTime() + weeks * 7 * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

/** « 16 – 22 nov. » : le jour de la semaine n'apprend rien sur une plage. */
function rangeLabel(from: string): string {
  const to = new Date(new Date(`${from}T00:00:00Z`).getTime() + 6 * 86_400_000)
    .toISOString()
    .slice(0, 10)
  return `${Number(from.slice(8))} – ${formatDate(to).replace(/^\S+\s/, '')}`
}

const postsOfDay = (date: string) => circle.posts.filter((post) => post.date === date)
</script>

<template>
  <div v-if="circle.view" class="flex flex-col gap-4">
    <!-- L'axe des semaines défile, il ne se replie pas (§ 8). -->
    <div class="tile flex-row flex-wrap items-center gap-x-4 gap-y-3 py-3">
      <span class="label shrink-0">Semaine</span>

      <UiAxisScroller class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <button
            v-for="from in axis"
            :key="from"
            type="button"
            class="pill-tap mono shrink-0 rounded-[4px] px-[10px] text-[12px] whitespace-nowrap lean:h-[26px]"
            :class="
              from === view?.week.from
                ? 'bg-accent font-semibold text-on-accent'
                : 'bg-surface-inset text-text-dim hover:bg-surface-muted'
            "
            @click="circle.go(from)"
          >
            {{ rangeLabel(from) }}
          </button>
        </div>
      </UiAxisScroller>

      <div
        class="flex shrink-0 items-center gap-[10px] lean:border-l lean:border-line-soft lean:pl-4"
      >
        <div class="flex">
          <UiAvatar
            v-for="(one, index) in circle.members"
            :key="one.id"
            :first-name="one.firstName"
            :avatar="one.avatar"
            :size="24"
            class="border-[1.5px] border-surface"
            :class="index > 0 ? '-ml-[7px]' : ''"
          />
        </div>
        <span class="text-[12.5px] text-text-dim">
          {{ circle.members.length }} membre{{ circle.members.length > 1 ? 's' : '' }}
        </span>
      </div>
    </div>

    <template v-for="day in circle.days" :key="day">
      <div class="flex flex-col gap-2">
        <div class="flex items-baseline gap-2">
          <span class="label">
            {{ day === view?.today ? 'Aujourd’hui' : formatDate(day) }}
          </span>
          <span v-if="day === view?.today" class="mono text-[11px] text-text-dim">
            {{ formatDate(day) }}
          </span>
        </div>

        <div class="grid gap-3 wide:grid-cols-2">
          <CirclePostTile
            v-for="post in postsOfDay(day)"
            :key="post.id"
            :post="post"
            :author="circle.authorsById.get(post.athleteId)"
          />
        </div>
      </div>
    </template>

    <!-- Un vide se dit, il ne se comble pas : aucun encouragement (§ 1 principe 9). -->
    <div v-if="circle.posts.length === 0" class="tile">
      <span class="mono text-[12px] text-text-dim">
        {{ view ? rangeLabel(view.week.from) : '' }}
      </span>
      <span class="text-[14px] text-text-dim">Personne n’a publié cette semaine.</span>
    </div>
  </div>

  <UiPageSkeleton v-else :columns="2" :tiles="2" :lines="2" />
</template>
