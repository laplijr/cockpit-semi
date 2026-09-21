import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { filesUnder } from './helpers/files'

describe('règle de dépendance (§ 3)', () => {
  it('aucun module de domaine n’importe infra', () => {
    const offenders = filesUnder('server/domain')
      .filter((path) => path.endsWith('.ts'))
      .filter((path) => /from '[^']*infra/.test(readFileSync(path, 'utf8')))

    expect(offenders).toEqual([])
  })
})
