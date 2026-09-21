import { expect, test } from '@playwright/test'
import { login } from './session'

/**
 * La boucle du jour au pouce (§ 10, P6.8). Ce qui se vérifie ici n'est pas le
 * moteur — il a ses tests — mais que les quatre gestes de terrain se font à
 * 390 px : lire la séance du jour, la saisir, décider ce qui attend, et passer
 * d'un onglet à l'autre. Le parcours suppose la base au scénario `bloc-2`.
 */
test.beforeEach(async ({ page }) => {
  await login(page)
})

test('la barre du bas remplace la barre latérale et mène aux quatre destinations', async ({
  page,
}) => {
  const bar = page.getByRole('navigation', { name: 'Navigation' })

  await expect(page.locator('aside')).toBeHidden()
  await expect(bar).toBeVisible()

  await bar.getByRole('link', { name: 'Semaine' }).click()
  await expect(page).toHaveURL('/semaine')

  await bar.getByRole('link', { name: 'Propositions' }).click()
  await expect(page).toHaveURL('/propositions')

  await bar.getByRole('button', { name: 'Plus' }).click()
  const sheet = page.getByRole('dialog', { name: 'Plus' })
  await expect(sheet).toBeVisible()

  await sheet.getByRole('button', { name: 'Progression' }).click()
  await expect(page).toHaveURL('/progression')
  await expect(sheet).toBeHidden()
})

test('la séance du jour se lit, se saisit, et la décision se prend', async ({ page }) => {
  const today = page.locator('.tile').filter({ hasText: "Aujourd'hui" })
  await expect(today).toBeVisible()

  await today.getByRole('button', { name: 'Ressenti' }).click()
  const dialog = page.getByRole('dialog', { name: 'Séance' })
  await expect(dialog).toBeVisible()

  // Le corps de la feuille défile, la tête ne bouge pas : l'action reste joignable.
  const save = dialog.getByRole('button', { name: 'Enregistrer le ressenti' })
  await save.scrollIntoViewIfNeeded()
  await expect(save).toBeVisible()

  await dialog.getByLabel('Durée réelle (min)').fill('52')
  await save.click()
  await expect(dialog).toBeHidden()

  // Une décision se prend depuis le cockpit, sans quitter la page.
  const badge = page.getByRole('navigation', { name: 'Navigation' }).locator('.badge')
  const before = await badge.textContent()

  const decisions = page.locator('.tile').filter({ hasText: 'À décider' })
  await decisions.getByRole('checkbox').first().check()
  await decisions.getByRole('button', { name: /^Appliquer/ }).click()

  await expect(badge).not.toHaveText(before ?? '', { timeout: 30_000 })
})
