import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '~/stores/ui'

describe('pile d’affichage de la coque', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('ouvre et ferme un panneau latéral', () => {
    const ui = useUiStore()
    ui.openPanel('imprevu')
    expect(ui.panel).toBe('imprevu')
    ui.closePanel()
    expect(ui.panel).toBeNull()
  })

  it('remplace le panneau ouvert au lieu de les empiler', () => {
    const ui = useUiStore()
    ui.openPanel('imprevu')
    ui.openPanel('pause')
    expect(ui.panel).toBe('pause')
  })

  it('ferme la fenêtre avant le panneau', () => {
    const ui = useUiStore()
    ui.openPanel('imprevu')
    ui.openModal('nouvelle-course')

    ui.closeTopLayer()
    expect(ui.modal).toBeNull()
    expect(ui.panel).toBe('imprevu')

    ui.closeTopLayer()
    expect(ui.panel).toBeNull()
  })
})
