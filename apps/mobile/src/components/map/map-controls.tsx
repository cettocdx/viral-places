import { Fragment, useEffect, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { categoryColor, mapTheme } from '@/theme';
import { hapticSelection } from '@/lib/haptics';
import { Icon } from '@/components/icon';
import { GlassSurface } from '@/components/glass-surface';

/** Map chrome sizes (ADR-025): one control height everywhere, Apple Maps–style grouped glass. */
export const CONTROL = 44;
const HAIRLINE = 'rgba(255,255,255,0.14)';

export interface ControlItem {
  key: string;
  sf: string;
  material: string;
  label: string;
  onPress: () => void;
  /** Filled accent (white) button, e.g. the reels entry. */
  emphasized?: boolean;
  /** Small accent dot (an active filter). */
  dot?: boolean;
  expanded?: boolean;
  testID?: string;
}

/** Several map actions in one glass capsule, separated by hairlines (Apple Maps control stack). */
export function ControlCluster({ items, direction = 'column' }: { items: ControlItem[]; direction?: 'row' | 'column' }) {
  const row = direction === 'row';
  return (
    <GlassSurface appearance="map" style={{ flexDirection: direction, borderRadius: CONTROL / 2, overflow: 'hidden' }}>
      {items.map((it, i) => (
        <Fragment key={it.key}>
          {i > 0 ? <View style={row ? { width: 1, marginVertical: 10, backgroundColor: HAIRLINE } : { height: 1, marginHorizontal: 10, backgroundColor: HAIRLINE }} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={it.label}
            accessibilityState={it.expanded === undefined ? undefined : { expanded: it.expanded }}
            onPress={() => { hapticSelection(); it.onPress(); }}
            testID={it.testID}
            style={({ pressed }) => ({ width: CONTROL, height: CONTROL, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent' })}
          >
            {it.emphasized ? (
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: mapTheme.paper, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf={it.sf} material={it.material as never} size={14} color={mapTheme.ink} />
              </View>
            ) : (
              <Icon sf={it.sf} material={it.material as never} size={17} color={it.expanded ? mapTheme.accent : mapTheme.text} weight="semibold" />
            )}
            {it.dot ? <View style={{ position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: mapTheme.accent }} /> : null}
          </Pressable>
        </Fragment>
      ))}
    </GlassSurface>
  );
}

/** Guest avatar: gradient disc in a white ring, the same sticker language as the pins. */
export function AvatarButton({ onPress, label, open }: { onPress: () => void; label: string; open: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => { hapticSelection(); onPress(); }} hitSlop={4} testID="explore-menu" style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      <View style={{ width: CONTROL, height: CONTROL, borderRadius: CONTROL / 2, padding: 3, backgroundColor: open ? mapTheme.accent : mapTheme.paper, boxShadow: '0 6px 18px rgba(0,0,0,0.35)' }}>
        <View style={{ flex: 1, borderRadius: CONTROL, experimental_backgroundImage: `linear-gradient(135deg, ${categoryColor('nightlife')} 0%, ${categoryColor('food')} 100%)`, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="person.fill" material="person" size={17} color="#FFFFFF" />
        </View>
      </View>
    </Pressable>
  );
}

export interface MenuRow {
  key: string;
  sf: string;
  material: string;
  label: string;
  detail?: string;
  color: string;
  onPress: () => void;
}

/**
 * Account menu over the map (ADR-025): grows from the avatar with a spring, dark glass, tap outside to close.
 * Replaces the hidden tab bar on the map route.
 */
export function AccountMenu({ top, title, subtitle, rows, onClose, footer }: { top: number; title: string; subtitle: string; rows: MenuRow[]; onClose: () => void; footer?: ReactNode }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(reduced ? 1 : 0);
  useEffect(() => { s.value = reduced ? 1 : withSpring(1, { damping: 15, stiffness: 260, mass: 0.6 }); }, [s, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: withTiming(s.value > 0.05 ? 1 : 0, { duration: 100 }), transform: [{ scale: 0.6 + 0.4 * s.value }, { translateY: (1 - s.value) * -8 }] }));
  return (
    <Animated.View entering={reduced ? undefined : FadeIn.duration(120)} exiting={reduced ? undefined : FadeOut.duration(120)} style={{ position: 'absolute', inset: 0 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(5,10,14,0.35)' }} testID="explore-menu-backdrop" />
      <Animated.View style={[{ position: 'absolute', top, right: 16, width: 264, transformOrigin: 'right top' }, style]}>
        {/* Opaque, not glass: over a busy map the glass let street labels bleed through the text. */}
        <View style={{ borderRadius: 26, borderCurve: 'continuous', overflow: 'hidden', paddingVertical: 8, backgroundColor: '#15222B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, padding: 2.5, backgroundColor: mapTheme.paper }}>
              <View style={{ flex: 1, borderRadius: 20, experimental_backgroundImage: `linear-gradient(135deg, ${categoryColor('nightlife')} 0%, ${categoryColor('food')} 100%)`, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf="person.fill" material="person" size={16} color="#FFFFFF" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: mapTheme.text }} numberOfLines={1}>{title}</Text>
              <Text style={{ fontSize: 12.5, color: mapTheme.textMuted, marginTop: 1 }} numberOfLines={1}>{subtitle}</Text>
            </View>
          </View>
          <View style={{ height: 1, marginHorizontal: 16, backgroundColor: HAIRLINE }} />
          {rows.map((r) => (
            <Pressable key={r.key} accessibilityRole="link" accessibilityLabel={r.detail ? `${r.label}, ${r.detail}` : r.label} onPress={() => { hapticSelection(); r.onPress(); }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 50, backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'transparent' })} testID={`explore-menu-${r.key}`}>
              <View style={{ width: 30, height: 30, borderRadius: 9, borderCurve: 'continuous', backgroundColor: r.color, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf={r.sf} material={r.material as never} size={15} color="#FFFFFF" />
              </View>
              <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: mapTheme.text }} numberOfLines={1}>{r.label}</Text>
              {r.detail ? <Text style={{ fontSize: 15, fontWeight: '600', color: mapTheme.textMuted, fontVariant: ['tabular-nums'] }}>{r.detail}</Text> : null}
              <Icon sf="chevron.right" material="chevron-right" size={12} color={mapTheme.textMuted} />
            </Pressable>
          ))}
          {footer}
        </View>
      </Animated.View>
    </Animated.View>
  );
}
