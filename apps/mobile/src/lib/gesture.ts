/**
 * Sürükle-bırak fiziği (Apple "Designing Fluid Interfaces"). Alt sayfa ve önizleme kartı aynı çekirdeği
 * paylaşır; önceden iki dosyada birebir kopyaydı (apple-design turu, 20.09.2026).
 * Saf worklet modülü: React'e ve tasarım tokenlarına bağlı değil, testten çalıştırılabilir.
 */

/** Momentum projeksiyonu: parmak bırakıldığında hareketin duracağı yeri tahmin eder. */
export function project(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Lastik bant: sınırın ötesine çekişte sert durmak yerine artan direnç. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
