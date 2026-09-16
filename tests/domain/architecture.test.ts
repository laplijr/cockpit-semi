import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

describe('règle de dépendance (§ 3)', () => {
  it('aucun module de domaine n’importe infra', () => {
    const offenders = filesUnder('server/domain')
      .filter((path) => path.endsWith('.ts'))
      .filter((path) => /from '[^']*infra/.test(readFileSync(path, 'utf8')))

    expect(offenders).toEqual([])
  })
})
