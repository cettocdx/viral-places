import { View } from 'react-native';
import { colors, radius, shadows, spacing, trendingTint } from '@/theme';
import { useT } from '@/hooks/use-t';
import { appConfig } from '@/lib/config';
import { ThemedText } from './themed-text';

/** Görünür DEMO etiketi (§32): fixture veri gerçek entegrasyon gibi gösterilmez. Canlı modda hiç görünmez (ürün sahibi, 19.09.2026). */
export function DemoBadge({ compact = false }: { compact?: boolean }) {
  const { t } = useT();
  if (appConfig.dataMode !== 'demo') return null;
  return (
    <View
      accessibilityLabel={t('a11y.demoBadge')}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: trendingTint,
        borderRadius: radius.chip,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
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
  if (appConfig.dataMode !== 'demo') return null;
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
        boxShadow: shadows.card,
      }}
    >
      <DemoBadge compact />
      <ThemedText variant="helper" tone="secondary" style={{ flex: 1 }}>
        {t('demo.banner')}
      </ThemedText>
    </View>
  );
}
