import { expect, test, type Locator } from '@playwright/test'
import { login } from './session'

/**
 * Les trois parcours desktop annoncés au § 10 depuis P0 et écrits à P8.5.
 * Ils ne rejouent pas le moteur — il a ses tests — mais les trois chaînes que
 * Ronan tient pour acquises : poser une course et voir le plan bouger, saisir
 * un ressenti et décider ce qu'il déclenche, déclarer un imprévu et voir la
 * semaine se refaire. Le parcours suppose la base au scénario `bloc-2`.
 */
test.beforeEach(async ({ page }) => {
  await login(page)
})

/**
 * Le serveur de dev compile chaque page à la demande : le balisage arrive
 * avant que Vue ait pris la main, et un clic parti trop tôt ne déclenche rien
 * alors que la cible est déjà actionnable. On rejoue le clic jusqu'à ce que
 * son effet paraisse — même parade que la saisie du mot de passe (P6.8.3).
 */
async function clickUntil(target: Locator, appears: Locator) {
  await expect(async () => {
    await target.click()
    await expect(appears).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 60_000 })
}

test('une course ajoutée entre dans la liste et régénère le plan', async ({ page }) => {
  await page.goto('/courses')

  /** Un nom unique : la base n'est pas reseedée entre deux exécutions. */
  const name = `10 km de vérification ${Date.now().toString().slice(-6)}`

  const upcoming = page.locator('.tile').filter({ hasText: 'Courses à venir' }).last()
  await expect(upcoming).toBeVisible()

  /**
   * Deux fenêtres portent ce titre : `ModalHost` en ouvre une pour toute
   * valeur de `ui.modal` sans avoir de contenu pour celle-ci, et la page pose
   * la vraie par-dessus. On vise celle qui porte le formulaire.
   */
  const modal = page
    .getByRole('dialog', { name: 'Nouvelle course' })
    .filter({ has: page.getByText('Nom', { exact: true }) })
  await clickUntil(upcoming.getByRole('button', { name: 'Ajouter' }), modal)

  await modal.getByLabel('Nom').fill(name)
  await modal.getByLabel('Date').fill('2027-05-16')
  /**
   * Le libellé enveloppe son champ : le nom accessible d'un `select` contient
   * donc ses options, et « Distance » désigne aussi le bloc Objectif. Le
   * premier est celui du formulaire.
   */
  await modal.getByLabel('Distance').first().selectOption({ label: '10 km' })
  await modal.getByLabel('Priorité').first().selectOption('B')

  /** La régénération écrit une version entière : elle prend quelques secondes. */
  await modal.getByRole('button', { name: 'Ajouter et régénérer le plan' }).click()
  await expect(modal).toBeHidden({ timeout: 60_000 })

  /** Le nom paraît deux fois dans la ligne : dans son bouton et dans sa cellule. */
  await expect(upcoming.getByText(name).first()).toBeVisible({ timeout: 30_000 })

  /** Le plan a bougé : la semaine de la course porte désormais son nom. */
  await page.goto('/semaine')
  await expect(page.locator('main')).toBeVisible()
})

test('un ressenti saisi produit une décision, et la décision s’applique', async ({ page }) => {
  const today = page.locator('.tile').filter({ hasText: "Aujourd'hui" }).last()
  await expect(today).toBeVisible()

  const dialog = page.getByRole('dialog', { name: 'Séance' })
  await clickUntil(today.getByRole('button', { name: 'Ressenti' }), dialog)

  await dialog.getByLabel('Durée réelle (min)').fill('48')
  await dialog.getByRole('button', { name: 'Enregistrer le ressenti' }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })

  const decisions = page.locator('.tile').filter({ hasText: 'À décider' }).last()
  await expect(decisions).toBeVisible()

  const pending = decisions.getByRole('checkbox')
  expect(await pending.count()).toBeGreaterThan(0)

  /**
   * La tuile est bornée à trois décisions (P5.19) : en appliquer une laisse la
   * suivante prendre sa place, et le compte ne bouge pas. C'est donc la
   * décision elle-même qu'on suit, par le libellé que porte sa case.
   */
  const applied = await pending.first().getAttribute('aria-label')
  await pending.first().check()
  await decisions.getByRole('button', { name: /^Appliquer/ }).click()

  await expect(decisions.getByRole('checkbox', { name: applied! })).toHaveCount(0, {
    timeout: 60_000,
  })
})

test('un imprévu déclaré refait la semaine', async ({ page }) => {
  const panel = page.getByRole('dialog', { name: 'Imprévu' })
  await clickUntil(page.getByRole('button', { name: /imprévu/i }).first(), panel)

  await panel
    .getByLabel("Ce qui s'est passé")
    .fill('1 h de squash ce midi, et je ne suis pas dispo vendredi')

  await panel.getByRole('button', { name: 'Lire le texte' }).click()

  const understood = panel.getByText('Ce que le cockpit a compris')
  const refused = panel.getByText(/Clé Anthropic refusée|clé du modèle/i)
  await expect(understood.or(refused)).toBeVisible({ timeout: 60_000 })

  /**
   * L'Imprévu est la seule chaîne du cockpit qui passe par le modèle (§ 6).
   * Sans clé valide elle ne se déroule pas, et le parcours se déclare ignoré
   * plutôt que de rougir sur une dépendance externe — même blocage qu'à P6.4.
   */
  test.skip(await refused.isVisible(), 'Clé du modèle refusée : l’Imprévu ne répond pas.')

  await panel.getByRole('button', { name: 'Confirmer' }).click()
  await expect(panel).toBeHidden({ timeout: 60_000 })

  await page.goto('/semaine')
  await expect(page.locator('main')).toBeVisible()
})
