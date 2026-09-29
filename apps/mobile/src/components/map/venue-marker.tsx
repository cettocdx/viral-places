import { Text, View } from 'react-native';
import { CATEGORY_META, type Category } from '@viral-places/domain';
import { currentColorScheme } from '@viral-places/design-tokens';
import { categoryColor, colors, spacing, trendingColor } from '@/theme';
import { Icon } from '@/components/icon';

export interface VenueMarkerProps {
  category: Category;
  score: number | null;
  trending: boolean;
  selected: boolean;
  /** Yoğun alanda etiket gizlenir; yalnız seçili/uygun zoom'da kısa skor rozeti gösterilir (§7.2). */
  showLabel: boolean;
}

/**
 * Apple Haritalar sadeliği (HIG Maps: "Use standard annotation appearance when possible; keep custom
 * annotations simple and legible"): küçük kategori dairesi, ince beyaz halka, yumuşak gölge.
 * Seçili pin büyür ve altına ince bir işaretçi ekler; trend yalnız küçük bir alev noktasıyla belirtilir.
 */
const PIN = 30;
const SELECTED_PIN = 44;
const POINTER = 8;
/** Sabit genişlik: rozet açılıp kapanınca pin koordinattan kaymaz. */
export const MARKER_WIDTH = 104;
const MARKER_HEIGHT = SELECTED_PIN + POINTER + 4;

export function pinSize(selected: boolean): number {
  return selected ? SELECTED_PIN : PIN;
}

/** Anchor: normal pin merkezi koordinatta; seçili pinde işaretçi ucu koordinatta. */
export function markerAnchor(selected: boolean): { x: number; y: number } {
  const size = pinSize(selected);
  const centerY = MARKER_HEIGHT / 2;
  const y = selected ? (centerY + size / 2 + POINTER) / MARKER_HEIGHT : 0.5;
  return { x: SELECTED_PIN / 2 / MARKER_WIDTH, y };
}

function ring(): string {
  return currentColorScheme() === 'dark' ? 'rgba(255,255,255,0.92)' : '#FFFFFF';
}

export function VenueMarker({ category, score, trending, selected, showLabel }: VenueMarkerProps) {
  const meta = CATEGORY_META[category];
  const fill = categoryColor(category);
  const size = pinSize(selected);
  const iconSize = selected ? 20 : 14;
  const badge = (showLabel || selected) && score !== null;
  return (
    <View style={{ width: MARKER_WIDTH, height: MARKER_HEIGHT, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: SELECTED_PIN, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: fill,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: selected ? 3 : 2,
            borderColor: ring(),
            boxShadow: selected ? '0 2px 5px rgba(0, 0, 0, 0.25)' : '0 1.5px 4px rgba(0, 0, 0, 0.22)',
          }}
        >
          <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={iconSize} color="#FFFFFF" />
        </View>
        {selected ? (
          <View style={{ width: 0, height: 0, marginTop: -1, borderLeftWidth: POINTER * 0.7, borderRightWidth: POINTER * 0.7, borderTopWidth: POINTER, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: ring() }} />
        ) : null}
        {trending && !selected ? (
          <View style={{ position: 'absolute', top: (MARKER_HEIGHT - PIN) / 2 - 3, right: (SELECTED_PIN - PIN) / 2 - 3, width: 11, height: 11, borderRadius: 6, backgroundColor: trendingColor, borderWidth: 2, borderColor: ring() }} />
        ) : null}
      </View>
      {badge ? (
        <View
          style={{
            marginLeft: 2,
            backgroundColor: colors.surface,
            borderRadius: 999,
            paddingHorizontal: 7,
            paddingVertical: 2,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.18)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {trending ? <Icon sf="flame.fill" material="local-fire-department" size={10} color={trendingColor} /> : null}
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] }}>{score}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Küme pini: Apple Haritalar küme görünümü gibi — nötr daire, kalın sayı, ince halka. */
export function ClusterMarker({ count, accessibilityLabel, selected = false }: { count: number; accessibilityLabel?: string; selected?: boolean }) {
  const size = count >= 100 ? 44 : count >= 10 ? 38 : 34;
  const dark = currentColorScheme() === 'dark';
  return (
    <View
      accessibilityLabel={accessibilityLabel ?? `${count}`}
      accessibilityState={{ selected }}
      style={{
        minWidth: size + (selected ? 6 : 0),
        height: size + (selected ? 6 : 0),
        paddingHorizontal: spacing.xs,
        borderRadius: 999,
        backgroundColor: dark ? '#F2F4F7' : '#1D2635',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: ring(),
        boxShadow: selected ? '0 2px 5px rgba(0, 0, 0, 0.25)' : '0 1.5px 4px rgba(0, 0, 0, 0.22)',
      }}
    >
      <Text style={{ fontSize: count >= 100 ? 13 : 15, fontWeight: '700', color: dark ? '#0B0F14' : '#FFFFFF', fontVariant: ['tabular-nums'] }}>{count}</Text>
    </View>
  );
}
