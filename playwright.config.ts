import { defineConfig, devices } from '@playwright/test'

/**
 * Parcours de bout en bout (§ 10). Le serveur de test est le serveur de dev,
 * avec l'horloge simulée de P3.5 : sans date fixée, « la séance du jour » n'a
 * pas de sens et le parcours dépendrait du calendrier réel. La base doit
 * porter le scénario correspondant — `pnpm db:seed --scenario=bloc-2`.
 */
const TODAY = '2026-11-22'
const PORT = 3123

export default defineConfig({
  testDir: 'tests/e2e',
  /* `.e2e.ts` et non `.spec.ts` : Vitest ramasse les `*.spec.ts` par défaut, et
     un parcours qui demande un serveur n'a rien à faire dans `pnpm test`. */
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  /* Le serveur de dev compile chaque page à la demande : le premier passage
     sur un écran est lent, et ce n'est pas une lenteur de l'app. */
  timeout: 90_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'telephone',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { NUXT_COCKPIT_TODAY: TODAY, NUXT_E2E: '1' },
  },
})
