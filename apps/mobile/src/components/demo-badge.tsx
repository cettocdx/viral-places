import { View } from 'react-native';
import { colors, radius, spacing, trendingTint } from '@/theme';
import { useT } from '@/hooks/use-t';
import { ThemedText } from './themed-text';

/** Görünür DEMO etiketi (§32): fixture veri gerçek entegrasyon gibi gösterilmez. */
export function DemoBadge({ compact = false }: { compact?: boolean }) {
  const { t } = useT();
  return (
    <View
      accessibilityLabel={t('a11y.demoBadge')}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: trendingTint,
        borderRadius: radius.chip,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
      }}
    >
      <ThemedText variant="caption" style={{ color: colors.trending, letterSpacing: 0.4 }}>
        {compact ? 'DEMO' : 'DEMO VERİ'}
      </ThemedText>
    </View>
  );
}

export function DemoBanner() {
  const { t } = useT();
  return (
    <View
      accessibilityRole="text"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.cardSmall,
        borderCurve: 'continuous',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        boxShadow: '0 1px 2px rgba(17, 24, 39, 0.06)',
      }}
    >
      <DemoBadge compact />
      <ThemedText variant="helper" tone="secondary" style={{ flex: 1 }}>
        {t('demo.banner')}
      </ThemedText>
    </View>
  );
}
