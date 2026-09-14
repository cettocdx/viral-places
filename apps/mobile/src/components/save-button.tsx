import { colors } from '@/theme';
import { useT } from '@/hooks/use-t';
import { useIsSaved } from '@/features/library/store';
import { Button, IconButton } from './button';
import { Icon } from './icon';

/** Tek "Kaydet" aksiyonu; yinelenen bookmark/kalp yok (§7.3). Kaydedilmişse durumu gösterir. */
export function SaveButton({ venueId, onPress, variant = 'full' }: { venueId: string; onPress: () => void; variant?: 'full' | 'icon' }) {
  const { t } = useT();
  const saved = useIsSaved(venueId);
  if (variant === 'icon') {
    return (
      <IconButton accessibilityLabel={saved ? t('place.saved') : t('place.save')} selected={saved} onPress={onPress} testID={`save-icon-${venueId}`}>
        <Icon sf={saved ? 'bookmark.fill' : 'bookmark'} material={saved ? 'bookmark' : 'bookmark-border'} size={20} color={saved ? colors.surface : colors.textPrimary} />
      </IconButton>
    );
  }
  return (
    <Button
      title={saved ? t('place.saved') : t('place.save')}
      variant={saved ? 'secondary' : 'primary'}
      onPress={onPress}
      icon={<Icon sf={saved ? 'bookmark.fill' : 'bookmark'} material={saved ? 'bookmark' : 'bookmark-border'} size={18} color={saved ? colors.textPrimary : colors.surface} />}
      testID={`save-${venueId}`}
    />
  );
}
