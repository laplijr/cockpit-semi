/**
 * Avatar de repli, dessiné en SVG à partir du prénom : initiales sur un fond
 * pris dans les tokens. Rien ne part sur le réseau, aucun service tiers, et
 * deux rendus du même prénom sont identiques. Une photo le remplace.
 */

/** Teintes des tokens, choisies pour rester lisibles sous du texte sombre. */
const PALETTE = ['#f2a23a', '#8db8f0', '#7fd67f', '#f7c85d', '#bf7f2f'] as const

export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0]! + words[1]![0]!).toUpperCase()
}

/** Somme des points de code : stable, et suffisante pour choisir une teinte. */
function seedOf(name: string): number {
  let seed = 0
  for (const character of name) seed = (seed + character.codePointAt(0)!) % 4096
  return seed
}

export function avatarColor(name: string | null | undefined): string {
  return PALETTE[seedOf((name ?? '').trim()) % PALETTE.length]!
}

/** SVG encodé en data URL, utilisable directement dans un `src`. */
export function avatarDataUrl(name: string | null | undefined, size = 64): string {
  const initials = initialsOf(name)
  const background = avatarColor(name)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
<rect width="64" height="64" rx="32" fill="${background}"/>
<text x="32" y="41" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-size="30" font-weight="600" fill="#161514" text-anchor="middle">${initials}</text>
</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
