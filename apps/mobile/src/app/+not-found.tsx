import { View } from 'react-native';
import { Link } from 'expo-router';
import { colors, spacing } from '@/theme';
import { ThemedText } from '@/components/themed-text';

export default function NotFound() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background, padding: spacing.xxl }}>
      <ThemedText variant="headline">404</ThemedText>
      <Link href="/(tabs)">
        <ThemedText style={{ color: colors.food }}>Keşfet</ThemedText>
      </Link>
    </View>
  );
}
