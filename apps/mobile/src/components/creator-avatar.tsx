import { View } from 'react-native';
import { Image } from 'expo-image';
import { colors, radius, surfaceMuted } from '@/theme';
import { ThemedText } from './themed-text';

/** Avatar yalnız hak izniyle gerçek görsel; aksi halde baş harf. Uydurma fotoğraf yok (§7.4). */
export function CreatorAvatar({ name, url, size = 28 }: { name: string; url: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase('tr');
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: radius.chip }} accessibilityLabel={name} />;
  }
  return (
    <View
      accessibilityLabel={name}
      style={{ width: size, height: size, borderRadius: radius.chip, backgroundColor: surfaceMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.surface }}
    >
      <ThemedText variant="caption" style={{ fontSize: Math.max(10, size * 0.38), lineHeight: size * 0.5 }}>
        {initials}
      </ThemedText>
    </View>
  );
}
