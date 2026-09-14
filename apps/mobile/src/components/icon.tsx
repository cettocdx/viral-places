import { MaterialIcons } from '@expo/vector-icons';
import { SymbolView, type SymbolWeight } from 'expo-symbols';
import type { ColorValue } from 'react-native';

export interface IconProps {
  /** iOS SF Symbol adı. */
  sf: string;
  /** Android/web Material icon adı (MaterialIcons seti). */
  material: keyof typeof MaterialIcons.glyphMap;
  size?: number;
  color?: ColorValue;
  weight?: SymbolWeight;
  accessibilityLabel?: string;
}

/** Platform ikonları: iOS'ta SF Symbols, Android/web'de Material; emoji ikon yok (§6.2). */
export function Icon({ sf, material, size = 20, color, weight = 'semibold', accessibilityLabel }: IconProps) {
  if (process.env.EXPO_OS === 'ios') {
    return (
      <SymbolView
        // sf-symbols-typescript adları statik liste; bilinen adları geçiriyoruz.
        name={sf as never}
        size={size}
        tintColor={color}
        weight={weight}
        style={{ width: size, height: size }}
        accessibilityLabel={accessibilityLabel}
        fallback={<MaterialIcons name={material} size={size} color={color} />}
      />
    );
  }
  return <MaterialIcons name={material} size={size} color={color} accessibilityLabel={accessibilityLabel} />;
}
