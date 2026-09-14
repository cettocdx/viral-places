import { View } from 'react-native';
import { colors, radius, spacing, surfaceMuted, trendingTint } from '@/theme';
import { useT } from '@/hooks/use-t';
import { Icon } from './icon';
import { ThemedText } from './themed-text';

export interface ViralBadgeProps {
  score: number | null;
  status: 'ready' | 'insufficient_data' | 'stale' | 'withheld';
  trending: boolean;
  size?: 'sm' | 'md';
}

/**
 * Skor rozeti (§8, §17.5). Sayı yoksa uydurulmaz: "Veri birikiyor" / "Güncel değil" gerçek durumlardır.
 * Yükselen vurgusu ek sinyaldir; kategori rengini silmez.
 */
export function ViralBadge({ score, status, trending, size = 'md' }: ViralBadgeProps) {
  const { t } = useT();
  const hasScore = score !== null && status !== 'withheld';
  const label =
    status === 'withheld'
      ? t('viral.withheld')
      : !hasScore
        ? t('viral.insufficient')
        : status === 'stale'
          ? `${score} · ${t('viral.stale')}`
          : `${t('viral.label')} ${score}`;
  const a11y = hasScore ? t('viral.scoreA11y', { score: score ?? '' }) + (status === 'stale' ? `, ${t('viral.stale')}` : '') : t('viral.insufficientA11y');
  const tint = trending ? colors.trending : hasScore ? colors.primaryAction : colors.textSecondary;
  const bg = trending ? trendingTint : hasScore && status !== 'stale' ? colors.surface : surfaceMuted;
  return (
    <View
      accessibilityLabel={a11y}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: bg,
        borderRadius: radius.chip,
        paddingHorizontal: size === 'sm' ? spacing.sm : spacing.md,
        paddingVertical: size === 'sm' ? 3 : spacing.xs + 2,
        boxShadow: trending || !hasScore ? 'none' : '0 1px 2px rgba(17, 24, 39, 0.08)',
      }}
    >
      {trending ? <Icon sf="flame.fill" material="local-fire-department" size={size === 'sm' ? 12 : 14} color={colors.trending} /> : null}
      <ThemedText variant={size === 'sm' ? 'caption' : 'helper'} style={{ color: tint, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
        {label}
      </ThemedText>
    </View>
  );
}
