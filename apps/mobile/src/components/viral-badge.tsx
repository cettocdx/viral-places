import { View } from 'react-native';
import { colors, radius, shadows, spacing, surfaceMuted, trendingTint } from '@/theme';
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
  // Skor yoksa rozet çizilmez: "Veri birikiyor" boş bilgi taşıyordu (ürün sahibi, 21.09.2026).
  if (!hasScore) return null;
  const label = status === 'stale' ? `${score} · ${t('viral.stale')}` : `${t('viral.label')} ${score}`;
  const a11y = t('viral.scoreA11y', { score }) + (status === 'stale' ? `, ${t('viral.stale')}` : '');
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
        boxShadow: trending || !hasScore ? 'none' : shadows.card,
      }}
    >
      {trending ? <Icon sf="flame.fill" material="local-fire-department" size={size === 'sm' ? 12 : 14} color={colors.trending} /> : null}
      <ThemedText variant={size === 'sm' ? 'caption' : 'helperStrong'} style={{ color: tint, fontVariant: ['tabular-nums'] }}>
        {label}
      </ThemedText>
    </View>
  );
}
