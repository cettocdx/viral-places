const ALLOWED_HOSTS = ['www.tiktok.com', 'tiktok.com', 'vm.tiktok.com', 'www.instagram.com', 'instagram.com'];

/** Yalnız HTTPS ve izinli platform host'ları (§23.1). Ağ çağrısı yok; işleme M1'de BLOCKED. */
export function validateSocialUrl(input: string): 'invalid' | 'valid' {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== 'https:') return 'invalid';
    if (!ALLOWED_HOSTS.includes(u.hostname)) return 'invalid';
    return 'valid';
  } catch {
    return 'invalid';
  }
}
