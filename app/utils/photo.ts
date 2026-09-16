import { MAX_AVATAR_BYTES } from '~~/server/domain/athlete/profile'

/** Côté de la photo de profil, en pixels : elle ne s'affiche jamais plus grand. */
export const AVATAR_SIZE = 160

export { MAX_AVATAR_BYTES }
export class PhotoTooLargeError extends Error {
  constructor(readonly bytes: number) {
    super(`Photo trop lourde : ${Math.round(bytes / 1000)} Ko pour 100 Ko au plus.`)
  }
}

/**
 * Redimensionne une photo en carré de 160 px et la rend en data URL webp.
 * Le recadrage est centré : une photo de profil se cadre sur le visage, pas
 * sur les bords. Au-delà de 100 Ko, on refuse plutôt que de tronquer.
 */
export async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)

  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas indisponible')

  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  )
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/webp', 0.8)
  if (dataUrl.length > MAX_AVATAR_BYTES) throw new PhotoTooLargeError(dataUrl.length)

  return dataUrl
}
