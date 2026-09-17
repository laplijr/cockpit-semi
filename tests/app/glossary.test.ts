import { describe, expect, it } from 'vitest'
import { GLOSSARY } from '~/utils/glossary'

const entries = Object.entries(GLOSSARY)

describe('glossaire (§ 11, P5.13)', () => {
  it('explique chaque notion sans dépasser deux phrases courtes', () => {
    for (const [term, entry] of entries) {
      expect(entry.title.trim(), term).not.toBe('')
      expect(entry.text.trim(), term).not.toBe('')
      expect(entry.text.length, term).toBeLessThanOrEqual(240)
    }
  })

  it('ne dit jamais deux fois la même chose', () => {
    const titles = entries.map(([, entry]) => entry.title)
    const texts = entries.map(([, entry]) => entry.text)

    expect(new Set(titles).size).toBe(titles.length)
    expect(new Set(texts).size).toBe(texts.length)
  })
})
