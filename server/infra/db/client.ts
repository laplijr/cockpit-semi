import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

export type Database = ReturnType<typeof create>

function create(url: string) {
  return drizzle(neon(url), { schema })
}

let instance: Database | undefined

export function useDatabase(): Database {
  if (!instance) {
    const { databaseUrl } = useRuntimeConfig()
    if (!databaseUrl) {
      throw createError({
        statusCode: 500,
        statusMessage: 'NUXT_DATABASE_URL manquant',
      })
    }
    instance = create(databaseUrl)
  }
  return instance
}

export { schema }
