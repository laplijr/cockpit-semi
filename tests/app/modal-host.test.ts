import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MODAL_IDS } from '~/stores/ui'

const HOST = 'app/components/shell/ModalHost.vue'

/**
 * Une fenêtre, un hôte (§ 8). `ModalHost` ouvre un `ShellAppModal` dès que
 * `ui.modal` porte une valeur : un identifiant sans contenu chez lui rend une
 * fenêtre vide, que la page qui pose la sienne recouvre alors d'une seconde.
 * C'est ce qui est arrivé à `nouvelle-course` de P5.8 à P8.6.
 */
describe('hôte des fenêtres', () => {
  const host = readFileSync(HOST, 'utf8')

  it('rend un contenu pour chaque identifiant de fenêtre', () => {
    const sansContenu = MODAL_IDS.filter((id) => !host.includes(`ui.modal === '${id}'`))
    expect(sansContenu).toEqual([])
  })

  it('reste le seul à ouvrir une fenêtre', () => {
    const autres = vueFiles('app')
      .filter((path) => path !== HOST)
      .filter((path) => readFileSync(path, 'utf8').includes('<ShellAppModal'))

    expect(autres).toEqual([])
  })
})

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return vueFiles(path)
    return entry.name.endsWith('.vue') ? [path] : []
  })
}
