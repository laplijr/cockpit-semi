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

  /**
   * Vrai quand le serveur a fermé la session sous nos pieds : compte
   * supprimé, ou base rejouée. La coque n'a alors rien à peindre, elle
   * renvoie à la porte plutôt que d'afficher une erreur (§ 9, P8.4).
   */
  const rejected = ref(false)

  async function load() {
    try {
      athlete.value = await request<AthleteView>('/api/athlete')
      rejected.value = false
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 401) throw error
      athlete.value = undefined
      rejected.value = true
    }
  }

  async function ensureLoaded() {
    if (!athlete.value) await load()
  }

  const onboarded = computed(() => athlete.value?.onboarded ?? false)

  /** Sans liste déclarée, les trois sports : la navigation ne cache rien (§ 5, P8.1). */
  const sports = computed(() => athlete.value?.constraints?.sports)

  return { athlete, rejected, load, ensureLoaded, onboarded, sports }
})
