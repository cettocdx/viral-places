import { ageHours } from '@viral-places/domain';
import { useT } from '@/hooks/use-t';
import { ThemedText } from './themed-text';

/** "Son güncelleme" = verinin bizim tarafımızdan gözlendiği zaman (§8.1). */
export function FreshnessLabel({ observedAt, asOf }: { observedAt: string | null; asOf: string }) {
  const { t, locale } = useT();
  if (!observedAt) {
    return (
      <ThemedText variant="helper" tone="secondary">
        {t('trend.lastObserved')}: {t('common.notAvailable')}
      </ThemedText>
    );
  }
  const hours = ageHours(observedAt, asOf);
  const text =
    hours < 1
      ? locale === 'tr' ? '1 saatten yeni' : 'under 1 hour ago'
      : hours < 48
        ? locale === 'tr' ? `${Math.round(hours)} saat önce` : `${Math.round(hours)} h ago`
        : locale === 'tr'
          ? `${Math.round(hours / 24)} gün önce`
          : `${Math.round(hours / 24)} days ago`;
  return (
    <ThemedText variant="helper" tone="secondary">
      {t('trend.lastObserved')}: {text}
    </ThemedText>
  );
}
