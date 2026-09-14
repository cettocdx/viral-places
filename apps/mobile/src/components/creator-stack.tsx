import { Pressable, View } from 'react-native';
import type { CreatorRefDto } from '@viral-places/contracts';
import { colors, radius, spacing } from '@/theme';
import { useT } from '@/hooks/use-t';
import { CreatorAvatar } from './creator-avatar';
import { ThemedText } from './themed-text';

/** Creator atıf yığını (Mapstr/corner kalıbı): üst üste avatarlar + "N creator paylaştı". Onay/endorsement ima etmez. */
export function CreatorStack({ creators, onPress }: { creators: CreatorRefDto[]; onPress?: (creatorId: string) => void }) {
  const { t } = useT();
  const unique = creators.filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
  if (unique.length === 0) return null;
  const shown = unique.slice(0, 4);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('place.sharedBy', { count: unique.length })} onPress={() => shown[0] && onPress?.(shown[0].id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', paddingVertical: spacing.xs, paddingRight: spacing.md, paddingLeft: spacing.xs, borderRadius: radius.chip, backgroundColor: pressed ? 'rgba(17,24,39,0.05)' : colors.surface, borderWidth: 1, borderColor: 'rgba(17,24,39,0.08)' })}>
      <View style={{ flexDirection: 'row' }}>
        {shown.map((c, i) => (
          <View key={c.id} style={{ marginLeft: i === 0 ? 0 : -8, borderWidth: 2, borderColor: colors.surface, borderRadius: radius.chip }}>
            <CreatorAvatar name={c.displayName} url={c.avatarUrl} size={26} />
          </View>
        ))}
      </View>
      <ThemedText variant="helper" style={{ fontWeight: '600' }}>
        {t('place.sharedBy', { count: unique.length })}
      </ThemedText>
    </Pressable>
  );
}
