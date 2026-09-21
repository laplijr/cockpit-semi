import type { AthleteConstraints } from '~~/server/domain/athlete/constraints'
import type { AthleteProfile } from '~~/server/domain/athlete/profile'

export interface AthleteView {
  id: number
  firstName: string | null
  birthDate: string | null
  profile: AthleteProfile | null
  avatar: string | null
  age: number | null
  suggestedMaxHr: number | null
  weightKg: number | null
  homeAddress: string | null
  maxHr: number | null
  startWeeklyVolumeM: number
  peakWeeklyVolumeM: number
  constraints: AthleteConstraints
  onboarded: boolean
}

/**
 * L'athlète courant, chargé une fois pour la coque : le middleware
 * d'onboarding et la navigation le lisent tous les deux (§ 9, P8.2).
 */
export const useAthleteStore = defineStore('athlete', () => {
  const athlete = ref<AthleteView>()
  /** Transmet le cookie de session pendant le rendu serveur. */
  const request = useRequestFetch()

  async function load() {
    athlete.value = await request<AthleteView>('/api/athlete')
  }

  async function ensureLoaded() {
    if (!athlete.value) await load()
  }

  const onboarded = computed(() => athlete.value?.onboarded ?? false)

  /** Sans liste déclarée, les trois sports : la navigation ne cache rien (§ 5, P8.1). */
  const sports = computed(() => athlete.value?.constraints?.sports)

  return { athlete, load, ensureLoaded, onboarded, sports }
})
