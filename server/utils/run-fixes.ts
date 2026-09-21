import { z } from 'zod'

/**
 * Relevés tels que le navigateur les envoie. Une sortie d'une heure en compte
 * trois mille six cents : la borne est large parce qu'un enregistrement refusé
 * par le réseau renvoie toute la trace, pas seulement sa fin (§ 9, P10).
 */
export const MAX_FIXES = 20_000

export const fixSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  accuracyM: z.number().nonnegative(),
  /** L'altitude manque souvent : elle entre absente plutôt que nulle. */
  elevationM: z
    .number()
    .nullish()
    .transform((value) => value ?? undefined),
  at: z.number().int().positive(),
})

export const fixesSchema = z.array(fixSchema).max(MAX_FIXES)

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
