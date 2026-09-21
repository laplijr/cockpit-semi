import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

/**
 * Le test d'isolation de P8.3 parle à une vraie base : il lit l'URL des
 * fichiers d'environnement locaux, et se saute quand il n'y en a pas.
 */
function databaseUrl(): string {
  for (const name of ['.env.local', '.env']) {
    const path = `${rootDir}${name}`
    if (!existsSync(path)) continue
    const match = readFileSync(path, 'utf8').match(/^NUXT_DATABASE_URL=(.*)$/m)
    if (match) return match[1]!.trim().replace(/^["']|["']$/g, '')
  }
  return process.env.NUXT_DATABASE_URL ?? ''
}

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'domain',
          environment: 'node',
          include: ['tests/domain/**/*.test.ts'],
        },
        resolve: { alias: { '~~': rootDir } },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          env: { NUXT_DATABASE_URL: databaseUrl() },
          /** Deux athlètes se rejouent sur la même base : jamais en parallèle. */
          fileParallelism: false,
          testTimeout: 60_000,
        },
        resolve: { alias: { '~~': rootDir } },
      },
      await defineVitestProject({
        test: {
          name: 'app',
          environment: 'nuxt',
          include: ['tests/app/**/*.test.ts'],
        },
      }),
    ],
  },
})
