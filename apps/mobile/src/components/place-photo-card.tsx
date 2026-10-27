import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { MapPlaceItemDto } from '@viral-places/contracts';
import { CATEGORY_META } from '@viral-places/domain';
import { categoryColor, durations, mapTheme, trendingColor } from '@/theme';
import { useT } from '@/hooks/use-t';
import { Icon } from './icon';

/**
 * A venue as a white-framed photo card (ADR-020/021): the shared unit of the map carousel, collections and plans.
 * The photo is the venue's displayable source cover; without one, the category colour and icon (no stock photo).
 */
export function PlacePhotoCard({ item, width, height, onPress, onLongPress, accessory, testID }: {
  item: MapPlaceItemDto;
  width: number;
  height: number;
  onPress: () => void;
  onLongPress?: () => void;
  /** Top-right control (e.g. remove); the rising flame moves aside for it. */
  accessory?: ReactNode;
  testID?: string;
}) {
  const { t } = useT();
  const meta = CATEGORY_META[item.category];
  const photo = item.media.mode !== 'unavailable' ? item.media.thumbnailUrl : null;
  const [failed, setFailed] = useState(false);
  const big = width >= 170;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${t(meta.labelKey)}${item.neighborhood ? `, ${item.neighborhood}` : ''}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}
      testID={testID}
    >
      <View style={{ width, height, padding: 5, borderRadius: 24, borderCurve: 'continuous', backgroundColor: mapTheme.paper, boxShadow: '0 10px 28px rgba(0, 0, 0, 0.35)' }}>
        <View style={{ flex: 1, borderRadius: 19, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: categoryColor(item.category), alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={30} color={mapTheme.paper} />
          {photo && !failed ? <Image source={{ uri: photo }} contentFit="cover" transition={durations.fast} onError={() => setFailed(true)} style={{ position: 'absolute', inset: 0 }} accessibilityIgnoresInvertColors /> : null}
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%', experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.78) 100%)' }} />
          {item.trend.trending ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 8, [accessory ? 'left' : 'right']: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: mapTheme.paper, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="flame.fill" material="local-fire-department" size={13} color={trendingColor} />
            </View>
          ) : null}
          {accessory ? <View style={{ position: 'absolute', top: 6, right: 6 }}>{accessory}</View> : null}
          <View pointerEvents="none" style={{ position: 'absolute', left: 10, right: 10, bottom: 9 }}>
            <Text style={{ fontSize: big ? 17 : 15, lineHeight: big ? 21 : 18, fontWeight: '600', letterSpacing: -0.2, color: mapTheme.paper }} numberOfLines={2}>{item.name}</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 }} numberOfLines={1}>{t(`pin.${item.category}`)}{item.neighborhood ? ` · ${item.neighborhood}` : ''}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
