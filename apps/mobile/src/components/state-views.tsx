import { ActivityIndicator, View } from 'react-native';
import { categoryColor, colors, radius, spacing, surfaceMuted } from '@/theme';
import { Icon } from './icon';
import { Button } from './button';
import { ThemedText } from './themed-text';

/** Üç eğik, beyaz halkalı ikon: pinlerle aynı sticker dili (ADR-021). Süs; erişilebilirlikten gizli. */
const STICKERS = [
  { category: 'food', sf: 'fork.knife', material: 'restaurant', size: 54, rotate: '-12deg', y: 8 },
  { category: 'nightlife', sf: 'sparkles', material: 'auto-awesome', size: 66, rotate: '0deg', y: 0 },
  { category: 'coffee', sf: 'cup.and.saucer.fill', material: 'local-cafe', size: 54, rotate: '12deg', y: 8 },
] as const;

function StickerCluster() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm }}>
      {STICKERS.map((s, i) => (
        <View key={s.category} style={{ width: s.size, height: s.size, borderRadius: s.size / 2, padding: 3.5, backgroundColor: '#FFFFFF', marginLeft: i === 0 ? 0 : -12, marginTop: s.y, zIndex: i === 1 ? 2 : 1, transform: [{ rotate: s.rotate }], boxShadow: '0 8px 20px rgba(0,0,0,0.3)' }}>
          <View style={{ flex: 1, borderRadius: s.size, backgroundColor: categoryColor(s.category), alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf={s.sf} material={s.material} size={s.size * 0.38} color="#FFFFFF" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function EmptyState({ title, hint, actionTitle, onAction, testID }: { title: string; hint?: string; actionTitle?: string; onAction?: () => void; testID?: string }) {
  return (
    <View testID={testID} style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xxl }}>
      <StickerCluster />
      <ThemedText variant="headline" style={{ textAlign: 'center' }}>
        {title}
      </ThemedText>
      {hint ? (
        <ThemedText tone="secondary" style={{ textAlign: 'center' }}>
          {hint}
        </ThemedText>
      ) : null}
      {actionTitle && onAction ? <Button title={actionTitle} variant="secondary" size="md" onPress={onAction} style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry, retryTitle }: { message: string; onRetry?: () => void; retryTitle: string }) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xxl }}>
      <ThemedText variant="headline" selectable style={{ textAlign: 'center' }}>
        {message}
      </ThemedText>
      {onRetry ? <Button title={retryTitle} variant="secondary" size="md" onPress={onRetry} /> : null}
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xxl }}>
      <ActivityIndicator color={colors.textSecondary} />
      {label ? (
        <ThemedText variant="helper" tone="secondary">
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Bilinen düzen için iskelet; ilk yüklemede boş durum gösterilmez (Spinner Blink yok). */
export function SkeletonBlock({ height, width = '100%', rounded = radius.cardSmall }: { height: number; width?: number | `${number}%`; rounded?: number }) {
  return <View style={{ height, width, borderRadius: rounded, borderCurve: 'continuous', backgroundColor: surfaceMuted }} />;
}
