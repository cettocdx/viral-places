import { ActivityIndicator, View } from 'react-native';
import { colors, radius, spacing, surfaceMuted } from '@/theme';
import { Button } from './button';
import { ThemedText } from './themed-text';

export function EmptyState({ title, hint, actionTitle, onAction, testID }: { title: string; hint?: string; actionTitle?: string; onAction?: () => void; testID?: string }) {
  return (
    <View testID={testID} style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xxl }}>
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
