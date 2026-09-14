/**
 * Creator seçim puanı v0 (§12.3). Ürün kararıdır, doğrulanmış formül değildir. Hak/erişim uygunsuzluğu puan indirimi değil ayrı engeldir.
 * CreatorFit = .25 konu + .20 mekan çıkarılabilirliği + .20 hedef coğrafya + .15 süreklilik + .10 izlenme istikrarı (medyan) + .10 özgünlük
 */
export interface CreatorSample {
  platform: 'tiktok' | 'instagram';
  handle: string;
  /** Örneklenen gönderi sayısı (≥20 yoksa insufficient_sample). */
  sampledPosts: number;
  /** Mekan/tavsiye konulu gönderi oranı (0–1) — etiketleme ile. */
  topicShare: number;
  /** Adı/adresi okunabilir gönderi oranı (0–1). */
  extractableShare: number;
  /** Hedef şehir(ler)e düşen gönderi oranı (0–1). */
  targetGeoShare: number;
  /** Son 90 günde aktif hafta oranı (0–1). */
  recentActivityShare: number;
  /** Gönderi izlenmeleri (medyan ile istikrar). */
  viewsSample: number[];
  /** Kopya/tekrar değil özgün bilgi oranı (0–1) — editoryal etiket. */
  originalityShare: number;
  /** Ayrı engel: hak/erişim uygun değilse puan üretilse de aday listeye alınmaz. */
  accessBlocked: boolean;
  disclosesSponsorship: boolean | null;
}

export interface CreatorFitResult {
  handle: string;
  platform: 'tiktok' | 'instagram';
  fit: number | null;
  status: 'scored' | 'insufficient_sample' | 'access_blocked';
  components: Record<'topic' | 'extractable' | 'geo' | 'continuity' | 'viewStability' | 'originality', number | null>;
  notes: string[];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** İzlenme istikrarı: medyan/ortalama oranı; tek uç viral gönderi ortalamayı şişirse de medyan sabit kalır. */
export function viewStability(views: number[]): number | null {
  const m = median(views);
  if (m === null || views.length < 5) return null;
  const mean = views.reduce((a, b) => a + b, 0) / views.length;
  if (mean <= 0) return 0;
  return clamp01(m / mean);
}

export function creatorFit(s: CreatorSample, minSample = 20): CreatorFitResult {
  const notes: string[] = [];
  const components = {
    topic: clamp01(s.topicShare),
    extractable: clamp01(s.extractableShare),
    geo: clamp01(s.targetGeoShare),
    continuity: clamp01(s.recentActivityShare),
    viewStability: viewStability(s.viewsSample),
    originality: clamp01(s.originalityShare),
  };
  if (s.accessBlocked) return { handle: s.handle, platform: s.platform, fit: null, status: 'access_blocked', components, notes: ['access_or_rights_blocked_is_not_a_score_penalty'] };
  if (s.sampledPosts < minSample) return { handle: s.handle, platform: s.platform, fit: null, status: 'insufficient_sample', components, notes: [`sampled ${s.sampledPosts} < ${minSample}`] };
  if (s.disclosesSponsorship === false) notes.push('sponsorship_disclosure_missing_review');
  const weights: Array<[keyof typeof components, number]> = [
    ['topic', 0.25],
    ['extractable', 0.2],
    ['geo', 0.2],
    ['continuity', 0.15],
    ['viewStability', 0.1],
    ['originality', 0.1],
  ];
  const avail = weights.filter(([k]) => components[k] !== null);
  const wsum = avail.reduce((a, [, w]) => a + w, 0);
  const fit = avail.reduce((a, [k, w]) => a + w * (components[k] as number), 0) / wsum;
  if (avail.length < weights.length) notes.push('view_stability_missing_reweighted');
  return { handle: s.handle, platform: s.platform, fit: Number(fit.toFixed(4)), status: 'scored', components, notes };
}
