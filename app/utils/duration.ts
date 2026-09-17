/** Saisie d'un chrono : « 1:38:00 » ou « 98:00 » d'un côté, des secondes de l'autre. */

export function durationToText(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = Math.round(seconds % 60)
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function textToDuration(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '') return null

  const parts = trimmed.split(':').map(Number)
  if (parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) return null

  return parts.length === 3
    ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
    : parts[0]! * 60 + parts[1]!
}
