import { useEffect, type ReactNode } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { colors, radius, spacing } from '@/theme';
import { hapticCommit } from '@/lib/haptics';

/** Apple sheet ayarı: damping 0.8, ~300 ms; jest hızı devredilir. */
const SHEET_SPRING = { duration: 300, dampingRatio: 0.8 } as const;

function project(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}
function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

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
  testID?: string;
}

/**
 * Harita üstünde kalıcı alt sheet (Plotline/Rhyme/Mapstr kalıbı): tutamaç, iki detent, 1:1 sürükleme,
 * bırakınca momentum projeksiyonuyla en yakın detent'e yay. Reduce-motion: yay yerine anında konum.
 */
export function MapSheet({ children, peekHeight, bottomInset, detent, onDetentChange, onDismissBelowPeek, onHeightChange, testID }: MapSheetProps) {
  const { height: screenH } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const halfHeight = Math.round(screenH * 0.46);
  const height = useSharedValue(peekHeight);
  const startHeight = useSharedValue(peekHeight);

  const target = detent === 'half' ? halfHeight : peekHeight;
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
      const max = halfHeight;
      const min = peekHeight * 0.5;
      if (raw > max) height.set(max + rubberband(raw - max, max));
      else if (raw < min) height.set(min - rubberband(min - raw, peekHeight));
      else height.set(raw);
    })
    .onEnd((e) => {
      const projected = height.get() - project(e.velocityY);
      const mid = (peekHeight + halfHeight) / 2;
      let next: SheetDetent = projected > mid ? 'half' : 'peek';
      if (e.velocityY > 900) next = 'peek';
      if (e.velocityY < -900) next = 'half';
      const dismiss = next === 'peek' && projected < peekHeight * 0.55 && !!onDismissBelowPeek;
      height.set(withSpring(next === 'half' ? halfHeight : peekHeight, { ...SHEET_SPRING, velocity: -e.velocityY }));
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
            boxShadow: '0 -8px 28px rgba(17, 24, 39, 0.14)',
            paddingBottom: bottomInset,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        {/* HIG Sheets: tutamaç sürüklenebilirliği gösterir; dokununca detent'ler arasında geçiş yapar (VoiceOver ile de çalışır). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={detent === 'half' ? 'Sheet küçült' : 'Sheet büyüt'}
          onPress={() => {
            hapticCommit();
            onDetentChange(detent === 'half' ? 'peek' : 'half');
          }}
          hitSlop={12}
          style={{ alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.xs }}
        >
          <View style={{ width: 36, height: 5, borderRadius: radius.chip, backgroundColor: 'rgba(17,24,39,0.16)' }} />
        </Pressable>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
