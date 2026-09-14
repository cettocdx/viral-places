import { useCallback } from 'react';
import { usePreferences } from '@/features/preferences/store';
import { translate, type TranslationKey } from '@/i18n';

export function useT() {
  const locale = usePreferences((s) => s.locale);
  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );
  return { t, locale };
}
