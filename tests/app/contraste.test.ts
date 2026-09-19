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

/**
 * L'aide ne se signale plus par un glyphe : le mot est son propre déclencheur
 * (§ 8, P6.36). Deux portes restent fermées — aucune icône d'information dans
 * l'app, aucun `title` natif.
 */
describe('plus aucune marque d’aide (§ 8, P6.36)', () => {
  it('n’a plus de forme « info » à poser', () => {
    const icons = readFileSync('app/components/ui/AppIcon.vue', 'utf8')

    expect(icons).not.toMatch(/^\s*info:/m)
    /** `pen` reste : la barre du haut s'en sert pour l'Imprévu. */
    expect(icons).toMatch(/^\s*pen:/m)
  })

  it('n’emploie plus de `title` natif : la bulle dit tout', () => {
    /**
     * Un `title` n'est natif que s'il est posé sur une balise HTML. Sur un
     * composant — `ShellAppModal`, `ShellAppPanel`, `UiNoteHint` — c'est une
     * prop, et Vue distingue les deux par la majuscule du nom de balise.
     */
    const offenders = vueFiles('app')
      .filter((path) => path.endsWith('.vue'))
      .flatMap((path) => nativeTitles(path, readFileSync(path, 'utf8')))

    expect(offenders).toEqual([])
  })
})

function nativeTitles(path: string, source: string): string[] {
  const found: string[] = []

  for (const match of source.matchAll(/\s:?title="/g)) {
    const opening = source.lastIndexOf('<', match.index)
    const tag = /^<([A-Za-z][\w.-]*)/.exec(source.slice(opening))?.[1]
    if (tag && /^[a-z]/.test(tag)) {
      found.push(`${path}:${source.slice(0, match.index).split('\n').length}`)
    }
  }

  return found
}
