import { Pressable, View } from 'react-native';
import type { TrendSummaryDto } from '@viral-places/contracts';
import { formatCompactCount } from '@viral-places/domain';
import { colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { FreshnessLabel } from './freshness-label';
import { Icon } from './icon';
import { ThemedText } from './themed-text';
import { ViralBadge } from './viral-badge';

function Stat({ value, label, sf, material }: { value: string; label: string; sf: string; material: string }) {
  return (
    <View style={{ flex: 1, gap: spacing.xs, alignItems: 'flex-start' }}>
      <Icon sf={sf} material={material as never} size={18} color={colors.textSecondary} weight="regular" />
      <ThemedText variant="sectionTitle" style={{ fontVariant: ['tabular-nums'] }} selectable>
        {value}
      </ThemedText>
      <ThemedText variant="helper" tone="secondary">
        {label}
      </ThemedText>
    </View>
  );
}

/** Trend kartı (§7.3, §8.1): dönem, paylaşım, farklı creator, erişilebilen görüntülenme, "Nasıl hesaplandı?". */
export function TrendEvidenceCard({ trend, onExplain }: { trend: TrendSummaryDto; onExplain: () => void }) {
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
        <ThemedText variant="helper" tone="secondary">
          {t('trend.window', { days: trend.windowDays })}
        </ThemedText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <ViralBadge score={trend.score} status={trend.status} trending={trend.trending} />
        {trend.baselinePartial ? (
          <ThemedText variant="caption" tone="secondary">
            {t('trend.baselinePartial')}
          </ThemedText>
        ) : null}
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
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Stat value={String(trend.eligiblePosts)} label={t('trend.posts')} sf="doc.text" material="article" />
        <Stat value={String(trend.distinctCreators)} label={t('trend.creators')} sf="person.2" material="group" />
        <Stat value={views ?? '—'} label={views ? t('trend.views') : t('trend.viewsNA')} sf="eye" material="visibility" />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <FreshnessLabel observedAt={trend.lastSuccessfulObservationAt} asOf={trend.asOf} />
        <Pressable accessibilityRole="link" accessibilityLabel={t('viral.howCalculated')} onPress={onExplain} hitSlop={8} testID="trend-explain">
          <ThemedText variant="helper" style={{ color: colors.primaryAction, fontWeight: '600' }}>
            {t('viral.howCalculated')} ›
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
