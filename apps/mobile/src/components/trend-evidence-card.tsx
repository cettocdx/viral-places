import { Pressable, View } from 'react-native';
import type { TrendSummaryDto } from '@viral-places/contracts';
import { formatCompactCount } from '@viral-places/domain';
import { colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { FreshnessLabel } from './freshness-label';
import { Icon } from './icon';
import { ThemedText } from './themed-text';
import { ViralBadge } from './viral-badge';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, gap: 2, alignItems: 'center' }}>
      <ThemedText variant="sectionTitle" style={{ fontVariant: ['tabular-nums'] }} selectable>
        {value}
      </ThemedText>
      <ThemedText variant="helper" tone="secondary" numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

/** Trend kartı (§7.3, §8.1) — sade: rozet + üç sayı + tazelik. Ayrıntı/formül ekranı kaldırıldı (ürün sahibi, 19.09.2026). */
export function TrendEvidenceCard({ trend }: { trend: TrendSummaryDto }) {
  const { t, locale } = useT();
  const views = formatCompactCount(trend.accessibleViews, locale);
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.cardLarge,
        borderCurve: 'continuous',
        padding: spacing.lg,
        gap: spacing.md,
        borderWidth: 1,
        borderColor: hairline,
      }}
      testID="trend-card"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <ThemedText variant="headline">{t('trend.title')}</ThemedText>
        <ViralBadge score={trend.score} status={trend.status} trending={trend.trending} size="sm" />
      </View>
      {trend.status === 'insufficient_data' ? (
        <ThemedText variant="helper" tone="secondary">
          {t('trend.insufficientBody')}
        </ThemedText>
      ) : null}
      {trend.status === 'stale' ? (
        <ThemedText variant="helper" tone="secondary">
          {t('trend.staleBody')}
        </ThemedText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.md, backgroundColor: colors.background, borderRadius: radius.cardSmall, borderCurve: 'continuous', paddingVertical: spacing.md, paddingHorizontal: spacing.sm }}>
        <Stat value={String(trend.eligiblePosts)} label={t('trend.posts')} />
        <Stat value={String(trend.distinctCreators)} label={t('trend.creators')} />
        <Stat value={views ?? '—'} label={views ? t('trend.views') : t('trend.viewsNA')} />
      </View>
      <FreshnessLabel observedAt={trend.lastSuccessfulObservationAt} asOf={trend.asOf} />
    </View>
  );
}
