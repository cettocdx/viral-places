import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, hairline, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { usePlace } from '@/lib/api/hooks';
import { Button } from '@/components/button';
import { LoadingState } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { ViralBadge } from '@/components/viral-badge';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: hairline }}>
      <ThemedText tone="secondary">{label}</ThemedText>
      <ThemedText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }} selectable>
        {value}
      </ThemedText>
    </View>
  );
}

/** "Nasıl hesaplandı?" (§8.2, §17.6): kaynak kapsamı paneli, bileşenler, sürüm, kapsam. */
export function TrendExplainerSheet({ placeId }: { placeId: string }) {
  const { t } = useT();
  const router = useRouter();
  const place = usePlace(placeId);
  const fmt = (v: number | null) => (v === null ? t('trend.explainer.na') : v.toFixed(2));
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl }} testID="trend-explainer">
      <ThemedText variant="sectionTitle">{t('viral.howCalculated')}</ThemedText>
      <ThemedText tone="secondary">{t('trend.explainer.body')}</ThemedText>
      {place.isLoading || !place.data ? (
        <LoadingState />
      ) : (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.cardLarge, borderCurve: 'continuous', padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: hairline }}>
          <ViralBadge score={place.data.trend.score} status={place.data.trend.status} trending={place.data.trend.trending} />
          <ThemedText variant="helper" tone="secondary">
            {t('trend.explainer.components')}
          </ThemedText>
          <Row label={t('trend.explainer.momentum')} value={fmt(place.data.trend.components.momentum)} />
          <Row label={t('trend.explainer.diversity')} value={fmt(place.data.trend.components.diversity)} />
          <Row label={t('trend.explainer.freshness')} value={fmt(place.data.trend.components.freshness)} />
          <Row label={t('trend.explainer.outperformance')} value={fmt(place.data.trend.components.outperformance)} />
          <Row label={t('trend.posts')} value={String(place.data.trend.eligiblePosts)} />
          <Row label={t('trend.creators')} value={String(place.data.trend.distinctCreators)} />
          <Row label={t('trend.explainer.version')} value={place.data.trend.scoreVersion} />
          <Row label={t('trend.explainer.scope')} value={place.data.trend.baselineScope ?? t('trend.explainer.na')} />
          {place.data.trend.reasonCodes.length > 0 ? <Row label="reason" value={place.data.trend.reasonCodes.join(', ')} /> : null}
          {place.data.city.coverage.monitoredCreators !== null ? <Row label={t('coverage.monitored', { count: '' }).trim()} value={String(place.data.city.coverage.monitoredCreators)} /> : null}
        </View>
      )}
      <Button title={t('common.close')} variant="secondary" size="md" onPress={() => router.back()} />
    </ScrollView>
  );
}
