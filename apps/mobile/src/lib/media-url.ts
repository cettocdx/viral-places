/**
 * Small renditions of stored covers (ADR-027): map pins drew 478 KB originals and sat as coloured placeholders
 * while they loaded. Supabase Storage (Pro) resizes on the fly; a 160 px pin cover is ~7 KB. Other hosts pass through.
 */
export function thumbUrl(url: string | null | undefined, px: number): string | null {
  if (!url) return null;
  const marker = '/storage/v1/object/public/';
  if (!url.includes('.supabase.co' + marker)) return url;
  const size = Math.round(px * 2);
  return `${url.replace(marker, '/storage/v1/render/image/public/')}?width=${size}&height=${size}&resize=cover&quality=70`;
}
