import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { colors, durations, hexToRgba, radius, shadows, spacing } from '@/theme';
import { hapticCommit } from '@/lib/haptics';
import { project, rubberband } from '@/lib/gesture';
import { useT } from '@/hooks/use-t';

/** Apple sheet ayarı: damping 0.8, ~300 ms; jest hızı devredilir. */
const SHEET_SPRING = { duration: durations.slow, dampingRatio: 0.8 } as const;
/** Tutamaç alanı yüksekliği (padding + çubuk). */
const GRABBER_HEIGHT = 18;

export type SheetDetent = 'peek' | 'half';

export interface MapSheetProps {
  children: ReactNode;
  /** Kısa durum yüksekliği (pt). */
  peekHeight: number;
  /** Alt boşluk (tab bar + safe area). */
  bottomInset: number;
  detent: SheetDetent;
  onDetentChange: (d: SheetDetent) => void;
  /** Kısa durumun altına fırlatılınca (seçimi bırakmak için). */
  onDismissBelowPeek?: () => void;
  onHeightChange?: (h: number) => void;
  /** 'peek': yalnız kısa durum (mekan/küme içeriği); yukarı çekme lastiklenir. Varsayılan 'half'. */
  maxDetent?: SheetDetent;
  testID?: string;
}

/**
 * Harita üstünde TEK kalıcı alt sheet (ürün sahibi, 21.09.2026: yükselenler, mekan önizlemesi ve küme listesi ayrı
 * kartlar değil, aynı yüzeyin içerikleri): tutamaç, iki detent, 1:1 sürükleme, bırakınca momentum projeksiyonuyla
 * en yakın detent'e yay; içerik değişince yükseklik ölçülen içeriğe yaylanır. Reduce-motion: anında konum.
 */
export function MapSheet({ children, peekHeight, bottomInset, detent, onDetentChange, onDismissBelowPeek, onHeightChange, maxDetent = 'half', testID }: MapSheetProps) {
  const { t } = useT();
  const [contentHeight, setContentHeight] = useState(0);
  const { height: screenH } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const halfHeight = Math.round(screenH * 0.46);
  const height = useSharedValue(peekHeight);
  const startHeight = useSharedValue(peekHeight);

  // Peek yüksekliği içerikten gelir; sabit değer yazı tipi büyüdüğünde ya kırpıyor ya boş alan bırakıyordu.
  const peek = contentHeight > 0 ? contentHeight + GRABBER_HEIGHT : peekHeight;
  const canHalf = maxDetent === 'half';
  const target = detent === 'half' && canHalf ? halfHeight : peek;
  useEffect(() => {
    height.set(reducedMotion ? target : withSpring(target, SHEET_SPRING));
    onHeightChange?.(target);
  }, [target, reducedMotion, height, onHeightChange]);

  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onStart(() => {
      startHeight.set(height.get());
    })
    .onChange((e) => {
      const raw = startHeight.get() - e.translationY;
      const max = canHalf ? halfHeight : peek;
      const min = peek * 0.5;
      if (raw > max) height.set(max + rubberband(raw - max, max));
      else if (raw < min) height.set(min - rubberband(min - raw, peek));
      else height.set(raw);
    })
    .onEnd((e) => {
      const projected = height.get() - project(e.velocityY);
      const mid = (peek + halfHeight) / 2;
      let next: SheetDetent = projected > mid ? 'half' : 'peek';
      if (e.velocityY > 900) next = 'peek';
      if (e.velocityY < -900) next = 'half';
      if (!canHalf) next = 'peek';
      const dismiss = next === 'peek' && projected < peek * 0.55 && !!onDismissBelowPeek;
      height.set(withSpring(next === 'half' ? halfHeight : peek, { ...SHEET_SPRING, velocity: -e.velocityY }));
      scheduleOnRN(hapticCommit);
      if (dismiss) scheduleOnRN(onDismissBelowPeek!);
      scheduleOnRN(onDetentChange, next);
    });

  const style = useAnimatedStyle(() => ({ height: height.get() + bottomInset }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        testID={testID}
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            borderCurve: 'continuous',
            boxShadow: shadows.sheet,
            paddingBottom: bottomInset,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <SheetGrabber
          accessibilityLabel={!canHalf ? t('common.close') : detent === 'half' ? t('sheet.collapse') : t('sheet.expand')}
          onPress={() => {
            hapticCommit();
            if (!canHalf) onDismissBelowPeek?.();
            else onDetentChange(detent === 'half' ? 'peek' : 'half');
          }}
        />
        <View onLayout={(e) => setContentHeight(Math.round(e.nativeEvent.layout.height))}>{children}</View>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Alt yüzey tutamacı (HIG "Sheets": grabber sürüklenebilirliği gösterir ve VoiceOver ile çalışır).
 * Tek tanım: alt sayfa ve önizleme kartı aynı tutamacı kullanır.
 */
export function SheetGrabber({ accessibilityLabel, onPress }: { accessibilityLabel: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={12}
      style={{ alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.xs }}
    >
      <View style={{ width: 36, height: 5, borderRadius: radius.chip, backgroundColor: hexToRgba(colors.textSecondary, 0.35) }} />
    </Pressable>
  );
}
