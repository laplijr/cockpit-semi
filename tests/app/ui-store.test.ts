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

  it('vise un objet avec la fenêtre, et oublie la cible en fermant', () => {
    const ui = useUiStore()
    ui.openModal('seance', 42)

    expect(ui.modal).toBe('seance')
    expect(ui.modalTargetId).toBe(42)

    ui.closeModal()
    expect(ui.modalTargetId).toBeNull()
  })

  it('ouvre le détail d’un cadran, qui n’a pas d’identifiant en base', () => {
    const ui = useUiStore()
    ui.openDial('charge')

    expect(ui.modal).toBe('cadran')
    expect(ui.modalDial).toBe('charge')
    expect(ui.modalTargetId).toBeNull()
  })

  it('oublie le cadran quand la fenêtre suivante vise un objet', () => {
    const ui = useUiStore()
    ui.openDial('vdot')
    ui.openModal('seance', 7)

    expect(ui.modalDial).toBeNull()
    expect(ui.modalTargetId).toBe(7)
  })
})
