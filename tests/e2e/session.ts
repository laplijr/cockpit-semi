import { expect, type Page } from '@playwright/test'

/**
 * Depuis P8.4 la porte demande un identifiant : le mot de passe unique de
 * `NUXT_APP_PASSWORD` n'ouvre plus rien. Les deux valeurs par défaut sont
 * celles que pose `pnpm db:seed` — un secret de développement écrit en clair
 * dans le seed, qui ne protège rien puisque la base est rejouée à chaque fois.
 */
const LOGIN = process.env.NUXT_E2E_LOGIN ?? 'ronan'
const PASSWORD = process.env.NUXT_E2E_PASSWORD ?? 'cockpit-dev-2026'

export async function login(page: Page) {
  await page.goto('/login')

  /*
   * Remplir avant l'hydratation laisse le champ plein et le `v-model` vide :
   * le bouton reste désactivé pour toujours. On resaisit jusqu'à ce que Vue
   * ait pris la main — un serveur de dev compile la page à la demande.
   */
  await expect(async () => {
    await page.getByLabel('Identifiant').fill(LOGIN)
    await page.getByLabel('Mot de passe').fill(PASSWORD)
    await expect(page.getByRole('button', { name: 'Entrer' })).toBeEnabled({ timeout: 1_000 })
  }).toPass({ timeout: 60_000 })

  await page.getByRole('button', { name: 'Entrer' }).click()

  /** Un échec ici veut dire une base non seedée, pas une régression de l'app. */
  await expect(page, `Connexion refusée pour « ${LOGIN} » — la base est-elle seedée ?`).toHaveURL(
    '/',
  )
}
