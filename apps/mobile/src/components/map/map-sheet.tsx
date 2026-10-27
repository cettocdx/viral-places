import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
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
const GRABBER_HEIGHT = 24;

export type SheetDetent = 'peek' | 'half';

export interface MapSheetProps {
  children: ReactNode;
  /** Kısa durum yüksekliği (pt). */
  peekHeight: number;
  /** Kart uzadığında harita ve seçili pin için alan bırakır; içerik kendi içinde kaydırılır. */
  maxHeight?: number;
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
  grabberLabel?: string;
  onGrabberPress?: () => void;
}

/**
 * Harita üstünde TEK kalıcı alt sheet (ürün sahibi, 21.09.2026: yükselenler, mekan önizlemesi ve küme listesi ayrı
 * kartlar değil, aynı yüzeyin içerikleri): tutamaç, iki detent, 1:1 sürükleme, bırakınca momentum projeksiyonuyla
 * en yakın detent'e yay; içerik değişince yükseklik ölçülen içeriğe yaylanır. Reduce-motion: anında konum.
 */
export function MapSheet({ children, peekHeight, maxHeight, bottomInset, detent, onDetentChange, onDismissBelowPeek, onHeightChange, maxDetent = 'half', testID, grabberLabel, onGrabberPress }: MapSheetProps) {
  const { t } = useT();
  const [contentHeight, setContentHeight] = useState(0);
  const { height: screenH } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const ceiling = maxHeight ?? Math.round(screenH * 0.6);
  const halfHeight = Math.min(ceiling, Math.round(screenH * 0.46));
  const height = useSharedValue(peekHeight);
  const startHeight = useSharedValue(peekHeight);

  // Peek yüksekliği içerikten gelir; sabit değer yazı tipi büyüdüğünde ya kırpıyor ya boş alan bırakıyordu.
  const peek = Math.min(ceiling, contentHeight > 0 ? contentHeight + GRABBER_HEIGHT : peekHeight);
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
      const settledHeight = next === 'half' ? halfHeight : peek;
      height.set(reducedMotion ? settledHeight : withSpring(settledHeight, { ...SHEET_SPRING, velocity: -e.velocityY }));
      scheduleOnRN(hapticCommit);
      if (dismiss) scheduleOnRN(onDismissBelowPeek!);
      scheduleOnRN(onDetentChange, next);
    });

  const style = useAnimatedStyle(() => ({ height: height.get() }));

  return (
      <Animated.View
        testID={testID}
        style={[
          {
            position: 'absolute',
            left: spacing.md,
            right: spacing.md,
            bottom: bottomInset + spacing.sm,
            backgroundColor: colors.surface,
            borderRadius: radius.cardLarge,
            borderCurve: 'continuous',
            boxShadow: shadows.sheet,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View collapsable={false}>
            <SheetGrabber
              accessibilityLabel={grabberLabel ?? (!canHalf ? t('common.close') : detent === 'half' ? t('sheet.collapse') : t('sheet.expand'))}
              onPress={() => {
                hapticCommit();
                if (onGrabberPress) onGrabberPress();
                else if (!canHalf) onDismissBelowPeek?.();
                else onDetentChange(detent === 'half' ? 'peek' : 'half');
              }}
            />
          </View>
        </GestureDetector>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" bounces={false} nestedScrollEnabled automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="never">
          <View onLayout={(e) => setContentHeight(Math.round(e.nativeEvent.layout.height))}>{children}</View>
        </ScrollView>
      </Animated.View>
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
      style={{ alignItems: 'center', justifyContent: 'center', height: GRABBER_HEIGHT }}
    >
      <View style={{ width: 36, height: 5, borderRadius: radius.chip, backgroundColor: hexToRgba(colors.textSecondary, 0.35) }} />
    </Pressable>
  );
}
