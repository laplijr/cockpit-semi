import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Sur `surface`, seul `text-dim` passe 4,5:1 (§ 11, P6.35) : `text-muted` et
 * `text-faint` ne sont plus des classes d'écran, seulement des jetons CSS
 * réservés aux placeholders et aux fonds.
 */
function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return vueFiles(path)
    return entry.name.endsWith('.vue') || entry.name.endsWith('.ts') ? [path] : []
  })
}

describe('contraste des petits textes (§ 11, P6.35)', () => {
  it('n’emploie plus text-muted ni text-faint sur du texte', () => {
    const offenders = vueFiles('app').filter((path) =>
      /text-text-(muted|faint)/.test(readFileSync(path, 'utf8')),
    )

    expect(offenders).toEqual([])
  })
})
