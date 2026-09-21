import { expect, test, type Browser, type Page } from '@playwright/test'
import { login } from './session'

/**
 * Le cercle est le seul écran qui n'existe qu'à plusieurs (§ 10, P9.3) : un
 * parcours à une session ne prouverait rien. **Deux contextes de navigateur**,
 * donc — deux fenêtres d'un même navigateur partagent leurs cookies, c'est
 * l'écart consigné sous P8.4, et deux contextes ne les partagent pas.
 *
 * Le parcours suppose la base au scénario `cercle`.
 */
async function openAs(browser: Browser, who: string): Promise<Page> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await login(page, who)
  return page
}

test('un bravo et un commentaire partent chez l’un et arrivent chez l’autre', async ({
  browser,
}) => {
  const ronan = await openAs(browser, 'ronan')
  const nour = await openAs(browser, 'nour')

  await ronan.goto('/cercle')

  /** Ronan lit une publication de Nour : c'est tout ce qui traverse le mur. */
  const hers = ronan.locator('.tile-action').filter({ hasText: 'Seize bornes' })
  await expect(hers).toBeVisible()

  /*
   * Le serveur de dev compile la page à la demande : un clic posé avant
   * l'hydratation ne réveille personne. On réessaie jusqu'à ce que Vue ait
   * pris la main, comme le fait la connexion (`session.ts`).
   */
  const dialog = ronan.getByRole('dialog', { name: 'Publication' })
  await expect(async () => {
    await hers.click()
    await expect(dialog).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 60_000 })

  await expect(dialog.getByText('16 km')).toBeVisible()

  const mot = `Vu depuis le parcours ${Date.now()}`
  await dialog.getByLabel('Votre commentaire').fill(mot)
  await dialog.getByRole('button', { name: 'Commenter' }).click()
  await expect(dialog.getByText(mot)).toBeVisible()

  /** Chez Nour, le même commentaire, sous sa propre publication. */
  await nour.goto('/cercle')
  const mine = nour.locator('.tile-action').filter({ hasText: 'Seize bornes' })
  await expect(mine).toBeVisible()

  const hersOpen = nour.getByRole('dialog', { name: 'Publication' })
  await expect(async () => {
    await mine.click()
    await expect(hersOpen).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 60_000 })
  await expect(hersOpen.getByText(mot)).toBeVisible()
  await expect(hersOpen.getByText('Ronan a dit bravo')).toBeVisible()

  /** L'auteure d'une publication reste maîtresse de ce qui s'écrit dessous. */
  const comment = hersOpen.locator('div').filter({ hasText: mot }).last()
  await comment.getByRole('button', { name: 'Retirer' }).click()
  await expect(hersOpen.getByText(mot)).toBeHidden()

  await ronan.context().close()
  await nour.context().close()
})

test('la séance d’un autre reste de l’autre côté du mur', async ({ browser }) => {
  const nour = await openAs(browser, 'nour')

  await nour.goto('/cercle')
  await expect(nour.locator('.tile-action').first()).toBeVisible()

  /** Le cockpit de Nour ne porte que son plan : celui de Ronan n'y entre pas. */
  await nour.goto('/semaine')
  await expect(nour.getByText('Marathon de Nantes')).toHaveCount(0)
  await expect(nour.locator('main')).not.toContainText('Semi de Paris')

  await nour.context().close()
})
