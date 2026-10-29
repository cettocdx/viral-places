import { useMemo } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import type { PlaceDetailDto } from '@viral-places/contracts';
import { useT } from '@/hooks/use-t';
import { hhmm, localNow, openState, parseOpeningHours } from '@/lib/opening-hours';
import { Icon } from '@/components/icon';

/** "Şu an açık · 23:00'e kadar" — yalnız saatler okunabiliyorsa; bilinmiyorsa hiçbir şey (uydurma "açık" yok). */
export function OpenNow({ place, color, mutedColor, size = 13.5 }: { place: Pick<PlaceDetailDto, 'practical' | 'city'>; color: string; mutedColor: string; size?: number }) {
  const { t } = useT();
  const state = useMemo(() => openState(parseOpeningHours(place.practical.openingHours), localNow(place.city.timezone)), [place.practical.openingHours, place.city.timezone]);
  if (!state) return null;
  const text = state.open
    ? state.until != null ? t('practical.openUntil', { time: hhmm(state.until) }) : t('practical.open')
    : state.until != null ? t('practical.closedOpensAt', { time: hhmm(state.until) }) : t('practical.closedToday');
  return (
    <Text style={{ fontSize: size, fontWeight: '600', color: mutedColor }} numberOfLines={1}>
      <Text style={{ color: state.open ? '#34C759' : '#FF6B6B' }}>{state.open ? t('practical.openNow') : t('practical.closed')}</Text>
      {` · ${text}`}
    </Text>
  );
}

/** Adres, mutfak, telefon, web: dokunulabilir satırlar; kaynak OSM ise atıf. Hiç bilgi yoksa çizilmez. */
export function PracticalRows({ place, textColor, mutedColor, divider }: { place: PlaceDetailDto; textColor: string; mutedColor: string; divider: string }) {
  const { t } = useT();
  const p = place.practical;
  const rows = [
    p.cuisine ? { key: 'cuisine', sf: 'fork.knife', material: 'restaurant', text: p.cuisine.replace(/(^|, )\w/g, (c) => c.toUpperCase()) } : null,
    p.address ? { key: 'address', sf: 'mappin.and.ellipse', material: 'place', text: p.address } : null,
    p.openingHours ? { key: 'hours', sf: 'clock', material: 'schedule', text: p.openingHours.replace(/;\s*/g, '\n') } : null,
    p.phone ? { key: 'phone', sf: 'phone', material: 'phone', text: p.phone, onPress: () => void Linking.openURL(`tel:${p.phone!.replace(/[^\d+]/g, '')}`) } : null,
    place.websiteUrl ? { key: 'web', sf: 'safari', material: 'public', text: new URL(place.websiteUrl).hostname.replace(/^www\./, ''), onPress: () => void Linking.openURL(place.websiteUrl!) } : null,
  ].filter((r): r is NonNullable<typeof r> => !!r);
  if (rows.length === 0) return null;
  return (
    <View testID="practical-rows">
      {rows.map((r, i) => (
        <Pressable key={r.key} disabled={!('onPress' in r)} onPress={'onPress' in r ? r.onPress : undefined} accessibilityRole={'onPress' in r ? 'link' : 'text'} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: divider, opacity: pressed ? 0.6 : 1 })}>
          <View style={{ width: 20, alignItems: 'center', paddingTop: 1 }}><Icon sf={r.sf} material={r.material as never} size={15} color={mutedColor} /></View>
          <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: 'onPress' in r ? '#5AA9FF' : textColor }}>{r.text}</Text>
        </Pressable>
      ))}
      {p.source === 'osm' ? <Text style={{ fontSize: 11, color: mutedColor, marginTop: 4 }}>{t('practical.osmAttribution')}</Text> : null}
    </View>
  );
}
