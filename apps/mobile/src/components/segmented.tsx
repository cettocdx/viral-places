import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { mapTheme } from '@/theme';
import { hapticSelection } from '@/lib/haptics';

/**
 * UISegmentedControl's dark appearance, drawn in JS (the system control stayed light inside Expo Go): systemFill
 * track, raised gray thumb, 13 pt semibold labels, 32 pt tall (owner, 29.10.2026: "native Apple app").
 */
export function Segmented({ values, index, onChange, testID }: { values: string[]; index: number; onChange: (i: number) => void; testID?: string }) {
  const [width, setWidth] = useState(0);
  const seg = values.length ? (width - 4) / values.length : 0;
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(index * seg, { damping: 18, stiffness: 260 }) }] }), [index, seg]);
  return (
    <View accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: 34, borderRadius: 17, padding: 2, backgroundColor: 'rgba(118,118,128,0.24)', flexDirection: 'row' }} testID={testID}>
      {seg > 0 ? <Animated.View style={[{ position: 'absolute', top: 2, left: 2, width: seg, height: 30, borderRadius: 15, backgroundColor: '#636366', boxShadow: '0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)' }, thumb]} /> : null}
      {values.map((v, i) => (
        <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: i === index }} onPress={() => { if (i !== index) { hapticSelection(); onChange(i); } }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: i === index ? '600' : '500', color: mapTheme.paper }}>{v}</Text>
        </Pressable>
      ))}
    </View>
  );
}
