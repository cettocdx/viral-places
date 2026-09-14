/**
 * Kullanıcı link importu (§19.2 POST /imports): TikTok/Instagram URL'lerini platform + kimliğe ayrıştırır.
 * Kısa linkler (vm.tiktok.com, /t/…) çözümlenmeden kimlik üretmez; çözümleme sağlayıcı/worker işidir (SSRF: yalnız allowlist host).
 */
export type ImportTarget =
  | { kind: 'post'; platform: 'tiktok'; platformPostId: string; handle: string | null; normalizedUrl: string }
  | { kind: 'post'; platform: 'instagram'; shortcode: string; normalizedUrl: string }
  | { kind: 'profile'; platform: 'tiktok' | 'instagram'; handle: string; normalizedUrl: string }
  | { kind: 'short_link'; platform: 'tiktok' | 'instagram'; normalizedUrl: string }
  | { kind: 'unsupported'; reason: 'host_not_allowed' | 'unparsable' | 'not_https' };

const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com']);
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'instagr.am']);

export function parseImportUrl(raw: string): ImportTarget {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { kind: 'unsupported', reason: 'unparsable' };
  }
  if (u.protocol !== 'https:') return { kind: 'unsupported', reason: 'not_https' };
  const host = u.hostname.toLowerCase();
  const segs = u.pathname.split('/').filter(Boolean);
  if (TIKTOK_HOSTS.has(host)) {
    if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com' || segs[0] === 't') return { kind: 'short_link', platform: 'tiktok', normalizedUrl: `https://${host}/${segs.join('/')}` };
    // /@handle/video/123 veya /@handle/photo/123
    if (segs[0]?.startsWith('@') && (segs[1] === 'video' || segs[1] === 'photo') && /^\d{1,30}$/.test(segs[2] ?? '')) {
      const handle = segs[0].slice(1);
      return { kind: 'post', platform: 'tiktok', platformPostId: segs[2]!, handle, normalizedUrl: `https://www.tiktok.com/@${handle}/video/${segs[2]}` };
    }
    if (segs[0] === 'video' && /^\d{1,30}$/.test(segs[1] ?? '')) return { kind: 'post', platform: 'tiktok', platformPostId: segs[1]!, handle: null, normalizedUrl: `https://www.tiktok.com/video/${segs[1]}` };
    if (segs.length === 1 && segs[0]!.startsWith('@')) return { kind: 'profile', platform: 'tiktok', handle: segs[0]!.slice(1), normalizedUrl: `https://www.tiktok.com/${segs[0]}` };
    return { kind: 'unsupported', reason: 'unparsable' };
  }
  if (INSTAGRAM_HOSTS.has(host)) {
    if ((segs[0] === 'p' || segs[0] === 'reel' || segs[0] === 'reels' || segs[0] === 'tv') && /^[A-Za-z0-9_-]{5,20}$/.test(segs[1] ?? '')) {
      const kind = segs[0] === 'p' ? 'p' : 'reel';
      return { kind: 'post', platform: 'instagram', shortcode: segs[1]!, normalizedUrl: `https://www.instagram.com/${kind}/${segs[1]}/` };
    }
    if (segs.length === 1 && /^[A-Za-z0-9_.]{1,30}$/.test(segs[0]!) && !['explore', 'accounts', 'direct'].includes(segs[0]!)) {
      return { kind: 'profile', platform: 'instagram', handle: segs[0]!, normalizedUrl: `https://www.instagram.com/${segs[0]}/` };
    }
    if (segs[0] === 'share') return { kind: 'short_link', platform: 'instagram', normalizedUrl: `https://www.instagram.com/${segs.join('/')}` };
    return { kind: 'unsupported', reason: 'unparsable' };
  }
  return { kind: 'unsupported', reason: 'host_not_allowed' };
}

/** Yönlendirme çözümleme için izinli hedef host kontrolü (SSRF önlemi): yalnız bilinen platform hostları. */
export function isAllowedRedirectHost(host: string): boolean {
  const h = host.toLowerCase();
  return TIKTOK_HOSTS.has(h) || INSTAGRAM_HOSTS.has(h);
}
