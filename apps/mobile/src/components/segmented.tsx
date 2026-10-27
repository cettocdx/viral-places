import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { mapTheme } from '@/theme';
import { hapticSelection } from '@/lib/haptics';

/**
 * Night-edition segmented control (ADR-025): dark track, white thumb that springs between segments.
 * The system control stayed light inside Expo Go and broke the dark pages.
 */
export function Segmented({ values, index, onChange, testID }: { values: string[]; index: number; onChange: (i: number) => void; testID?: string }) {
  const [width, setWidth] = useState(0);
  const seg = values.length ? (width - 8) / values.length : 0;
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(index * seg, { damping: 18, stiffness: 260 }) }] }), [index, seg]);
  return (
    <View accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: 44, borderRadius: 22, padding: 4, backgroundColor: 'rgba(255,255,255,0.08)', flexDirection: 'row' }} testID={testID}>
      {seg > 0 ? <Animated.View style={[{ position: 'absolute', top: 4, left: 4, width: seg, height: 36, borderRadius: 18, backgroundColor: mapTheme.paper, boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }, thumb]} /> : null}
      {values.map((v, i) => (
        <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: i === index }} onPress={() => { if (i !== index) { hapticSelection(); onChange(i); } }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: i === index ? mapTheme.ink : mapTheme.textMuted }}>{v}</Text>
        </Pressable>
      ))}
    </View>
  );
}
