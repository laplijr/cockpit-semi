import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Tous les fichiers d'une arborescence, chemins relatifs à la racine du dépôt. */
export function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}
