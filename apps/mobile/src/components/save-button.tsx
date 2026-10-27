import { colors, mapTheme } from '@/theme';
import { useT } from '@/hooks/use-t';
import { useIsSaved } from '@/features/library/store';
import { Button, IconButton } from './button';
import { Icon } from './icon';

/** Tek "Kaydet" aksiyonu; yinelenen bookmark/kalp yok (§7.3). Kaydedilmişse durumu gösterir. */
export function SaveButton({ venueId, onPress, variant = 'full', size = 'lg', appearance = 'surface' }: { venueId: string; onPress: () => void; variant?: 'full' | 'icon'; size?: 'md' | 'lg'; appearance?: 'surface' | 'map' }) {
  const { t } = useT();
  const saved = useIsSaved(venueId);
  if (variant === 'icon') {
    return (
      <IconButton appearance={appearance} accessibilityLabel={saved ? t('place.saved') : t('place.save')} selected={saved} onPress={onPress} testID={`save-icon-${venueId}`}>
        <Icon sf={saved ? 'bookmark.fill' : 'bookmark'} material={saved ? 'bookmark' : 'bookmark-border'} size={20} color={appearance === 'map' ? saved ? mapTheme.ink : mapTheme.text : saved ? colors.surface : colors.textPrimary} />
      </IconButton>
    );
  }
  return (
    <Button
      title={saved ? t('place.saved') : t('place.save')}
      variant={saved ? 'secondary' : 'primary'}
      size={size}
      onPress={onPress}
      icon={<Icon sf={saved ? 'bookmark.fill' : 'bookmark'} material={saved ? 'bookmark' : 'bookmark-border'} size={size === 'md' ? 16 : 18} color={saved ? colors.textPrimary : colors.surface} />}
      testID={`save-${venueId}`}
    />
  );
}
