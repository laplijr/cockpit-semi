import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActionButton from '~/components/ui/ActionButton.vue'

/**
 * Un bouton qui possède son attente (§ 8, P7.3). Ce qui se vérifie ici n'est
 * pas le dessin mais la règle : un geste part une fois, le second clic est
 * avalé, et une attente trop courte ne clignote pas.
 */
describe('bouton qui travaille', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  /**
   * Le bouton ne rattrape pas l'erreur : elle remonte à l'appelant. Ici
   * l'appelant est le test, qui la reçoit comme Vue la lui donnerait.
   */
  const failures: unknown[] = []

  const mount = (props: Record<string, unknown>) =>
    mountSuspended(ActionButton, {
      props,
      slots: { default: () => 'Retirer' },
      global: { config: { errorHandler: (error: unknown) => failures.push(error) } },
    })

  it('lance l’action une fois au clic', async () => {
    const action = vi.fn(() => Promise.resolve())
    const button = await mount({ action })

    await button.find('button').trigger('click')

    expect(action).toHaveBeenCalledTimes(1)
  })

  it('avale le second clic tant que le premier n’a pas répondu', async () => {
    let release = () => {}
    const action = vi.fn(() => new Promise<void>((resolve) => (release = resolve)))
    const button = await mount({ action })

    await button.find('button').trigger('click')
    await button.find('button').trigger('click')
    await button.find('button').trigger('click')

    expect(action).toHaveBeenCalledTimes(1)

    release()
    await vi.runAllTimersAsync()
    await button.find('button').trigger('click')
    expect(action).toHaveBeenCalledTimes(2)
  })

  it('ne montre aucun indicateur quand la réponse arrive avant le seuil', async () => {
    const action = vi.fn(() => Promise.resolve())
    const button = await mount({ action })

    await button.find('button').trigger('click')
    await vi.advanceTimersByTimeAsync(60)

    expect(button.find('.animate-spin').exists()).toBe(false)
    expect(button.find('button').attributes('aria-busy')).toBeUndefined()
  })

  it('montre l’indicateur au-delà du seuil, et le garde le temps qu’il se voie', async () => {
    let release = () => {}
    const action = vi.fn(() => new Promise<void>((resolve) => (release = resolve)))
    const button = await mount({ action })

    await button.find('button').trigger('click')
    expect(button.find('button').attributes('aria-busy')).toBe('true')

    await vi.advanceTimersByTimeAsync(150)
    expect(button.find('.animate-spin').exists()).toBe(true)

    release()
    await vi.advanceTimersByTimeAsync(100)
    expect(button.find('.animate-spin').exists()).toBe(true)

    await vi.runAllTimersAsync()
    expect(button.find('.animate-spin').exists()).toBe(false)
  })

  it('redevient actionnable après une action rejetée', async () => {
    const action = vi.fn(() => Promise.reject(new Error('503')))
    const button = await mount({ action })

    await button.find('button').trigger('click')
    await vi.runAllTimersAsync()

    expect(button.find('button').attributes('aria-disabled')).toBeUndefined()
    expect((failures.at(-1) as Error).message).toBe('503')

    await button.find('button').trigger('click')
    await vi.runAllTimersAsync()
    expect(action).toHaveBeenCalledTimes(2)
  })

  it('se verrouille sur une attente externe sans prétendre travailler', async () => {
    const action = vi.fn(() => Promise.resolve())
    const button = await mount({ action, pending: true })

    await button.find('button').trigger('click')

    expect(action).not.toHaveBeenCalled()
    expect(button.find('button').attributes('aria-disabled')).toBe('true')
    expect(button.find('button').attributes('aria-busy')).toBeUndefined()
    expect(button.find('.animate-spin').exists()).toBe(false)
  })
})
