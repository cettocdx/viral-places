import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { CATEGORY_META, type Category } from '@viral-places/domain';
import { categoryColor, mapTheme, radius, shadows, spacing, type } from '@/theme';
import { useT } from '@/hooks/use-t';
import { Icon } from '@/components/icon';
import { StickerText } from './sticker-text';
import { thumbUrl } from '@/lib/media-url';

export interface VenueMarkerProps {
  category: Category;
  thumbnailUrl?: string | null;
  selected: boolean;
  showLabel: boolean;
  /** Sticker angle in degrees; stable per venue (see stickerTilt). */
  tilt?: number;
  /** Focused from the card carousel: accent ring and label (ADR-021). */
  highlighted?: boolean;
  /** Refresh the native map snapshot after the image has actually loaded (or failed). */
  onArtworkLoad?: () => void;
}

/** Cover rendition size shared by all pins and the map's prefetch. */
export const PIN_THUMB_PX = 64;
export const MARKER_WIDTH = mapTheme.marker.width;
export const MARKER_HEIGHT = mapTheme.marker.height;
const LABEL_SIZE = 15;
/** The sticker overlaps the photo's top edge, as in the reference. */
const LABEL_OVERLAP = 9;

export function pinSize(selected: boolean, showLabel = false): number {
  return selected ? mapTheme.marker.selectedSize : showLabel ? mapTheme.marker.regularSize : mapTheme.marker.compactSize;
}

function ringWidth(size: number): number {
  return size >= mapTheme.marker.regularSize ? 3.5 : 2.5;
}

/** Selection changes the artwork, never the geographic centre of the annotation. */
export function markerAnchor(_selected?: boolean): { x: number; y: number } {
  return { x: 0.5, y: mapTheme.marker.centerY / MARKER_HEIGHT };
}

/** Distance from the anchor (photo centre) to the top of the drawn pin; the card's tail stops above it. */
export function pinTopExtent(selected: boolean, showLabel: boolean): number {
  const size = pinSize(selected, showLabel);
  const outer = size / 2 + ringWidth(size);
  return selected || showLabel ? outer + LABEL_SIZE * 1.15 + 6 - LABEL_OVERLAP : outer;
}

/** A stable -9…9° tilt per venue, so stickers look hand-placed but never jump between renders. */
export function stickerTilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 19) - 9;
}

/**
 * Cover with recovery (owner, 29.10.2026: "blue sign instead of the photo"): a failed small rendition retries once,
 * then falls back to the original file; only if both fail does a quiet dark disc with a soft icon show.
 * No bright category colour on the map (ADR-027).
 */
function MarkerArtwork({ url: fullUrl, category, size, onLoad }: { url?: string | null; category: Category; size: number; onLoad?: () => void }) {
  const meta = CATEGORY_META[category];
  // One rendition for every pin size, so zooming (compact ↔ labelled) hits the same cached file.
  const small = thumbUrl(fullUrl, PIN_THUMB_PX);
  const candidates = small ? (small !== fullUrl && fullUrl ? [small, `${small}&r=1`, fullUrl] : [small, `${small}${small.includes('?') ? '&' : '?'}r=1`]) : [];
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Clusters swap their cover when members change: start over for a new file.
  useEffect(() => { setAttempt(0); setLoaded(false); }, [fullUrl]);
  const url = candidates[attempt] ?? null;
  const exhausted = !url;
  return (
    <View style={{ flex: 1, width: '100%', backgroundColor: mapTheme.land, alignItems: 'center', justifyContent: 'center' }}>
      {exhausted || !loaded ? <Icon sf={meta.sfSymbol} material={meta.materialIcon as never} size={size * 0.36} color="rgba(255,255,255,0.55)" /> : null}
      {url ? (
        <Image
          key={url}
          source={{ uri: url }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={url}
          style={{ position: 'absolute', inset: 0 }}
          onLoad={() => { setLoaded(true); onLoad?.(); }}
          onError={() => { setLoaded(false); setAttempt((n) => n + 1); onLoad?.(); }}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      ) : null}
    </View>
  );
}

/** Small white pointer under the photo, like a speech bubble. */
function PinTail({ width, top }: { width: number; top: number }) {
  return (
    <View
      style={{
        position: 'absolute',
        top,
        left: (MARKER_WIDTH - width) / 2,
        width: 0,
        height: 0,
        borderLeftWidth: width / 2,
        borderRightWidth: width / 2,
        borderTopWidth: width * 0.62,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: mapTheme.paper,
      }}
    />
  );
}

/** Photo pin with a die-cut category sticker, after the Places, Map & Pins reference (ADR-020). */
export function VenueMarker({ category, thumbnailUrl, selected, showLabel, tilt = 0, highlighted = false, onArtworkLoad }: VenueMarkerProps) {
  const { t } = useT();
  const size = pinSize(selected, showLabel || highlighted);
  const ring = ringWidth(size);
  const outer = size + ring * 2;
  const labelled = selected || showLabel || highlighted;
  const top = mapTheme.marker.centerY - outer / 2;
  return (
    <View collapsable={false} style={{ width: MARKER_WIDTH, height: MARKER_HEIGHT }}>
      <PinTail width={labelled ? 14 : 9} top={top + outer - ring - 1} />
      <View
        style={{
          position: 'absolute',
          top,
          left: (MARKER_WIDTH - outer) / 2,
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          padding: ring,
          backgroundColor: highlighted ? mapTheme.accent : mapTheme.paper,
          boxShadow: highlighted ? `0 0 0 3px ${mapTheme.paper}, 0 6px 18px rgba(213, 244, 154, 0.55)` : shadows.marker,
        }}
      >
        <View style={{ flex: 1, borderRadius: size / 2, overflow: 'hidden' }}>
          <MarkerArtwork url={thumbnailUrl} category={category} size={size} onLoad={onArtworkLoad} />
        </View>
      </View>
      {labelled ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: MARKER_HEIGHT - top - LABEL_OVERLAP, alignItems: 'center' }}>
          <View style={{ transform: [{ rotate: `${tilt}deg` }] }}>
            <StickerText size={LABEL_SIZE}>{t(`pin.${category}`)}</StickerText>
          </View>
        </View>
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

/**
 * Küme (29.10.2026, "yerler daha güzel"): tek kapak yerine en fazla üç üyenin fotoğrafı yelpaze gibi açılır, sayı
 * köşede beyaz rozet. Üye verisi olmayan sunucu kümeleri sade sayı dairesi olarak kalır.
 */
export function ClusterMarker({ count, accessibilityLabel, selected = false, tint, thumbnailUrl, thumbnails, category = 'food', onArtworkLoad }: {
  count: number;
  accessibilityLabel?: string;
  selected?: boolean;
  tint?: string;
  thumbnailUrl?: string | null;
  /** Up to three member covers for the fan. */
  thumbnails?: (string | null | undefined)[];
  category?: Category;
  onArtworkLoad?: () => void;
}) {
  const size = clusterMarkerSize(count) - spacing.md;
  const covers = (thumbnails?.filter(Boolean) as string[] | undefined)?.slice(0, 3) ?? (thumbnailUrl ? [thumbnailUrl] : []);
  const fan = covers.length > 1;
  const box = size + spacing.md + (fan ? 18 : 0);
  const ring = selected ? mapTheme.accent : mapTheme.paper;
  // Yelpaze: arkadakiler sola/sağa yatık, ilk üyenin kapağı önde ve dik. slot: 0 sol, 1 orta, 2 sağ.
  const SLOT = [{ dx: -11, angle: -13 }, { dx: 0, angle: 0 }, { dx: 11, angle: 13 }];
  const layers = covers.length === 3 ? [{ url: covers[1]!, slot: 0 }, { url: covers[2]!, slot: 2 }, { url: covers[0]!, slot: 1 }]
    : covers.length === 2 ? [{ url: covers[1]!, slot: 2 }, { url: covers[0]!, slot: 1 }]
    : covers.map((url) => ({ url, slot: 1 }));
  const disc = ({ url, slot }: { url: string; slot: number }) => (
    <View key={url} style={{ position: 'absolute', left: (box - size) / 2 + SLOT[slot]!.dx, top: spacing.xs, width: size, height: size, borderRadius: size / 2, borderWidth: selected ? 3 : 2.5, borderColor: ring, overflow: 'hidden', backgroundColor: mapTheme.land, transform: [{ rotate: `${SLOT[slot]!.angle}deg` }], boxShadow: shadows.marker }}>
      <MarkerArtwork url={url} category={category} size={size} onLoad={onArtworkLoad} />
    </View>
  );
  return (
    <View accessibilityLabel={accessibilityLabel ?? `${count}`} accessibilityState={{ selected }} style={{ width: box, height: size + spacing.md }}>
      {covers.length ? (
        layers.map(disc)
      ) : (
        <View style={{ position: 'absolute', left: (box - size) / 2, top: spacing.xs, width: size, height: size, borderRadius: size, backgroundColor: tint ?? mapTheme.land, borderWidth: selected ? 3 : 2.5, borderColor: ring, alignItems: 'center', justifyContent: 'center' }}>
          <Text allowFontScaling={false} style={{ ...type.headline, color: mapTheme.paper, fontVariant: ['tabular-nums'] }}>{clusterLabel(count)}</Text>
        </View>
      )}
      {covers.length ? (
        <View style={{ position: 'absolute', right: fan ? 2 : 0, bottom: spacing.xxs, minWidth: 26, height: 22, paddingHorizontal: spacing.xs + 2, backgroundColor: mapTheme.paper, borderRadius: 11, alignItems: 'center', justifyContent: 'center', boxShadow: shadows.marker }}>
          <Text allowFontScaling={false} style={{ ...type.caption2, color: mapTheme.ink, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{clusterLabel(count)}</Text>
        </View>
      ) : null}
    </View>
  );
}
