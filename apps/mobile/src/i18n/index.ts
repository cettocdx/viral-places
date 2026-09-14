import { en } from './en';
import { tr, type TranslationKey } from './tr';

export type Locale = 'tr' | 'en';
export type { TranslationKey };

const tables: Record<Locale, Record<TranslationKey, string>> = { tr, en };

export function translate(locale: Locale, key: TranslationKey, params?: Record<string, string | number>): string {
  const raw = tables[locale][key] ?? tables.tr[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => (params[name] !== undefined ? String(params[name]) : `{${name}}`));
}

export const PLATFORM_LABEL: Record<'tiktok' | 'instagram', string> = { tiktok: 'TikTok', instagram: 'Instagram' };
