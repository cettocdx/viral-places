import { ageHours } from '@viral-places/domain';
import { useT } from '@/hooks/use-t';
import { ThemedText } from './themed-text';

/** "Son güncelleme" = verinin bizim tarafımızdan gözlendiği zaman (§8.1). */
export function FreshnessLabel({ observedAt, asOf }: { observedAt: string | null; asOf: string }) {
  const { t } = useT();
  if (!observedAt) return null;
  const hours = ageHours(observedAt, asOf);
  // Göreli zaman metinleri i18n'de: Intl.RelativeTimeFormat Hermes'te yok (canlı koşu bulgusu, 20.09.2026).
  const text = hours < 1 ? t('time.justNow') : hours < 48 ? t('time.hoursAgo', { count: Math.round(hours) }) : t('time.daysAgo', { count: Math.round(hours / 24) });
  return (
    <ThemedText variant="helper" tone="secondary">
      {t('trend.lastObserved')}: {text}
    </ThemedText>
  );
}
