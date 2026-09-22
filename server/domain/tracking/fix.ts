import { distanceBetween } from '../routes/geometry'
import type { GeoPoint } from '../routes/route'

/**
 * Un relevé du navigateur, tel que `watchPosition` le donne (§ 9, P10). Le
 * domaine ne connaît ni la géolocalisation ni l'écran : il ne voit qu'une
 * suite de positions horodatées, et c'est ce qui le rend testable sans sortir
 * courir.
 */
export interface GeoFix extends GeoPoint {
  /** Précision horizontale annoncée par le navigateur, en mètres. */
  accuracyM: number
  /** Horodatage du relevé, en millisecondes depuis l'époque. */
  at: number
}

/**
 * Seuils de la capture, tous tirés du même constat : un GPS de téléphone
 * mesure mal à l'arrêt et bien en mouvement.
 */
export const FIX_TOLERANCE = {
  /** Au-delà, la position est un nuage : elle ne dit pas où on est. */
  accuracyM: 25,
  /** Précision à atteindre avant de lancer le chrono. */
  startAccuracyM: 20,
  /**
   * Déplacement minimal pour compter de la distance. Sans ce seuil, trente
   * secondes à un feu rouge fabriquent quarante mètres de course.
   */
  minMoveM: 5,
  /** Vitesse au-delà de laquelle le relevé est un saut, pas une course. */
  maxSpeedMS: 10,
  /**
   * La même borne à vélo : une descente à 60 km/h n'est pas un saut de
   * position, et le seuil de la course jetterait la moitié de la sortie
   * (§ 9, P10.3).
   */
  cyclingMaxSpeedMS: 25,
  /**
   * Trou entre deux relevés à partir duquel le temps ne compte plus : pause
   * déclarée ou signal perdu, dans les deux cas on n'était pas en train de
   * courir un temps qu'on ne sait pas mesurer.
   */
  gapS: 10,
  /** Fenêtre de lissage de l'allure affichée : une allure instantanée est illisible. */
  paceWindowS: 30,
  /**
   * Bruit d'altitude d'un téléphone, bien au-delà de celui d'un service de
   * routage : c'est ce seuil qui empêche un D+ de sortir de nulle part.
   */
  elevationNoiseM: 5,
  /** Écart à la trace au-delà duquel on n'est plus sur la boucle proposée. */
  offTrackM: 40,
  /** Sous cette distance, il n'y a pas de sortie à enregistrer. */
  minRunM: 500,
} as const

const secondsBetween = (from: GeoFix, to: GeoFix) => (to.at - from.at) / 1000

/**
 * Un relevé retenu est précis, postérieur au précédent, et n'implique pas une
 * vitesse impossible. Le troisième critère est le seul qui demande le
 * précédent : c'est lui qui écarte les sauts de position en ville.
 */
export function acceptFix(
  fix: GeoFix,
  previous?: GeoFix,
  maxSpeedMS: number = FIX_TOLERANCE.maxSpeedMS,
): boolean {
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lon)) return false
  if (fix.accuracyM > FIX_TOLERANCE.accuracyM) return false
  if (previous === undefined) return true

  const seconds = secondsBetween(previous, fix)
  if (seconds <= 0) return false

  return distanceBetween(previous, fix) / seconds <= maxSpeedMS
}
