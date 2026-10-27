import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { CATEGORY_META, type Category } from '@viral-places/domain';
import { categoryColor, mapTheme, radius, shadows, spacing, trendingColor, type } from '@/theme';
import { useT } from '@/hooks/use-t';
import { Icon } from '@/components/icon';

export interface VenueMarkerProps {
  category: Category;
  thumbnailUrl?: string | null;
  score: number | null;
  trending: boolean;
  selected: boolean;
  showLabel: boolean;
  /** Refresh the native map snapshot after the image has actually loaded (or failed). */
  onArtworkLoad?: () => void;
}

export const MARKER_WIDTH = mapTheme.marker.width;
export const MARKER_HEIGHT = mapTheme.marker.height;

export function pinSize(selected: boolean, showLabel = false): number {
  return selected ? mapTheme.marker.selectedSize : showLabel ? mapTheme.marker.regularSize : mapTheme.marker.compactSize;
}

/** Selection changes the artwork, never the geographic centre of the annotation. */
export function markerAnchor(_selected?: boolean): { x: number; y: number } {
  return { x: 0.5, y: mapTheme.marker.centerY / MARKER_HEIGHT };
}

/** A failed/signed-out thumbnail falls back to its category, never an unrelated stock photo. */
function MarkerArtwork({ url, category, size, onLoad }: { url?: string | null; category: Category; size: number; onLoad?: () => void }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const meta = CATEGORY_META[category];
  return (
    <View style={{ flex: 1, width: '100%', backgroundColor: categoryColor(category), alignItems: 'center', justifyContent: 'center' }}>
      <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={size * 0.4} color={mapTheme.paper} />
      {url && failedUrl !== url ? (
        <Image
          source={{ uri: url }}
          resizeMode="cover"
          style={{ position: 'absolute', inset: 0 }}
          onError={() => setFailedUrl(url)}
          onLoadEnd={onLoad}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      ) : null}
    </View>
  );
}

/** Photo stickers inspired by the user's Places, Map & Pins reference (ADR-019). */
export function VenueMarker({ category, thumbnailUrl, score, trending, selected, showLabel, onArtworkLoad }: VenueMarkerProps) {
  const { t } = useT();
  const size = pinSize(selected, showLabel);
  const labelled = selected || showLabel;
  return (
    <View collapsable={false} style={{ width: MARKER_WIDTH, height: MARKER_HEIGHT }}>
      <View
        style={{
          position: 'absolute',
          top: mapTheme.marker.centerY - size / 2,
          left: (MARKER_WIDTH - size) / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: mapTheme.paper,
          borderWidth: selected ? 4 : 2.5,
          borderColor: selected ? mapTheme.accent : mapTheme.paper,
          boxShadow: selected ? shadows.markerSelected : shadows.marker,
        }}
      >
        <View style={{ flex: 1, borderRadius: size, overflow: 'hidden' }}>
          <MarkerArtwork url={thumbnailUrl} category={category} size={size} onLoad={onArtworkLoad} />
        </View>
      </View>
      {labelled ? (
        <View style={{ position: 'absolute', top: mapTheme.marker.centerY - size / 2 - spacing.md, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.chip, backgroundColor: selected ? mapTheme.accent : mapTheme.paper, transform: [{ rotate: '-8deg' }] }}>
            {/* A map annotation is rasterized; its full scalable label lives on the parent Marker and in the list. */}
            <Text allowFontScaling={false} numberOfLines={1} style={{ ...type.caption2, fontWeight: '800', color: mapTheme.ink }}>
              {t(CATEGORY_META[category].labelKey)}
            </Text>
          </View>
        </View>
      ) : null}
      {labelled && score !== null ? (
        <View style={{ position: 'absolute', top: mapTheme.marker.centerY + size / 2 - spacing.sm, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, paddingHorizontal: spacing.xs, borderRadius: radius.chip, backgroundColor: mapTheme.ink, borderWidth: 1.5, borderColor: mapTheme.paper }}>
          {trending ? <Icon sf="flame.fill" material="local-fire-department" size={10} color={mapTheme.accent} /> : null}
          <Text allowFontScaling={false} style={{ ...type.caption2, fontWeight: '700', color: mapTheme.paper, fontVariant: ['tabular-nums'] }}>{score}</Text>
        </View>
      ) : trending ? (
        <View style={{ position: 'absolute', top: mapTheme.marker.centerY + size / 2 - spacing.sm, left: MARKER_WIDTH / 2 - spacing.xs, width: spacing.sm, height: spacing.sm, borderRadius: radius.chip, backgroundColor: trendingColor, borderWidth: 1.5, borderColor: mapTheme.paper }} />
      ) : null}
    </View>
  );
}

export function clusterLabel(count: number): string {
  return count >= 1000 ? '999+' : String(count);
}

export function clusterMarkerSize(count: number): number {
  return (count >= 50 ? 54 : 46) + spacing.md;
}

/** Known members can show a cover; server clusters with no member data retain a clear count. */
export function ClusterMarker({ count, accessibilityLabel, selected = false, tint, thumbnailUrl, category = 'food', onArtworkLoad }: {
  count: number;
  accessibilityLabel?: string;
  selected?: boolean;
  tint?: string;
  thumbnailUrl?: string | null;
  category?: Category;
  onArtworkLoad?: () => void;
}) {
  const size = clusterMarkerSize(count) - spacing.md;
  return (
    <View accessibilityLabel={accessibilityLabel ?? `${count}`} accessibilityState={{ selected }} style={{ width: size + spacing.md, height: size + spacing.md }}>
      <View style={{ position: 'absolute', top: spacing.xs, left: spacing.sm, width: size, height: size, borderRadius: size, backgroundColor: mapTheme.land, borderWidth: 2, borderColor: mapTheme.paper, transform: [{ rotate: '12deg' }] }} />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: tint ?? mapTheme.land, borderWidth: selected ? 3 : 2.5, borderColor: selected ? mapTheme.accent : mapTheme.paper, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {thumbnailUrl ? <MarkerArtwork url={thumbnailUrl} category={category} size={size} onLoad={onArtworkLoad} /> : null}
        {!thumbnailUrl ? <Text allowFontScaling={false} style={{ ...type.headline, color: mapTheme.paper, fontVariant: ['tabular-nums'] }}>{clusterLabel(count)}</Text> : null}
      </View>
      {thumbnailUrl ? (
        <View style={{ position: 'absolute', right: 0, bottom: spacing.xxs, minWidth: 24, paddingHorizontal: spacing.xs, backgroundColor: mapTheme.paper, borderRadius: radius.chip, alignItems: 'center' }}>
          <Text allowFontScaling={false} style={{ ...type.caption2, color: mapTheme.ink, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{clusterLabel(count)}</Text>
        </View>
      ) : null}
    </View>
  );
}
