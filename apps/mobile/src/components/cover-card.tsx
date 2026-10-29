import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { mapTheme } from '@/theme';
import { usePlace } from '@/lib/api/hooks';
import { Icon } from './icon';

/**
 * Gece baskısı kapak kartı (ADR-021): beyaz çerçeve, kaynak fotoğrafı, alt degradede başlık. Kapak, koleksiyonun/planın
 * ilk mekanının gösterim hakkı olan kaynak görselidir; yoksa ikonlu koyu zemin (hayali fotoğraf yok).
 */
export function CoverCard({ venueId, title, subtitle, icon, width, onPress, onLongPress, accessibilityLabel, testID }: {
  venueId: string | null;
  title: string;
  subtitle: string;
  icon: { sf: string; material: string };
  width: number;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  const place = usePlace(venueId ?? undefined);
  const cover = place.data?.sources.find((s) => s.media.mode !== 'unavailable' && s.media.thumbnailUrl)?.media.thumbnailUrl ?? null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })} testID={testID}>
      <View style={{ width, height: Math.round(width * 1.28), borderRadius: 20, borderCurve: 'continuous', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
        <View style={{ flex: 1, borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: mapTheme.land, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf={icon.sf} material={icon.material as never} size={34} color={mapTheme.textMuted} />
          {cover ? <Image source={{ uri: cover }} contentFit="cover" transition={200} style={{ position: 'absolute', inset: 0 }} accessibilityIgnoresInvertColors /> : null}
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%', experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.8) 100%)' }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
            <Text style={{ fontSize: 17, lineHeight: 21, fontWeight: '700', letterSpacing: -0.3, color: mapTheme.paper }} numberOfLines={2}>{title}</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }} numberOfLines={1}>{subtitle}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Izgaradaki "yeni" kartı: kesik kenarlı, aynı ölçüde. */
export function NewCoverCard({ title, width, onPress, testID }: { title: string; width: number; onPress: () => void; testID?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })} testID={testID}>
      <View style={{ width, height: Math.round(width * 1.28), borderRadius: 26, borderCurve: 'continuous', borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: mapTheme.paper, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="plus" material="add" size={22} color={mapTheme.ink} />
        </View>
        <Text style={{ fontSize: 15, fontWeight: '600', color: mapTheme.text, textAlign: 'center', paddingHorizontal: 12 }}>{title}</Text>
      </View>
    </Pressable>
  );
}
