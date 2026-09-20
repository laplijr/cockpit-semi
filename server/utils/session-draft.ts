import { z } from 'zod'
import { MIN_MANUAL_MIN } from '../domain/plan/manual-edit'
import { Sport } from '../domain/shared/sport'

/** Ce que l'écran envoie pour poser une séance : un sport, un type, une taille. */
export const draftSchema = z.object({
  sport: z.enum([Sport.Running, Sport.Cycling]),
  code: z.string().min(1),
  distanceM: z.number().positive().optional(),
  durationMin: z.number().min(MIN_MANUAL_MIN).optional(),
})

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
