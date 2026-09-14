import { View } from 'react-native';
import type { CoverageDto } from '@viral-places/contracts';
import { colors, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import type { TranslationKey } from '@/i18n';
import { Icon } from './icon';
import { ThemedText } from './themed-text';

/** Kapsam açıklaması (§8.2, §12.4): "Kapsamımız gelişiyor" + izlenen creator sayısı. */
export function CoverageNotice({ coverage }: { coverage: CoverageDto }) {
  const { t } = useT();
  if (coverage.status === 'covered' || !coverage.noteKey) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.cardSmall, borderCurve: 'continuous', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, boxShadow: '0 1px 2px rgba(17, 24, 39, 0.06)' }}>
      <Icon sf="info.circle" material="info-outline" size={16} color={colors.textSecondary} weight="regular" />
      <ThemedText variant="helper" tone="secondary" style={{ flex: 1 }}>
        {t(coverage.noteKey as TranslationKey)}
        {coverage.monitoredCreators !== null ? ` · ${t('coverage.monitored', { count: coverage.monitoredCreators })}` : ''}
      </ThemedText>
    </View>
  );
}
