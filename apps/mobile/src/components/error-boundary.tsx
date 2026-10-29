import { Component, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, mapTheme } from '@/theme';
import { trackError } from '@/lib/telemetry';

/**
 * Ekran düzeyinde hata kalkanı (29.10.2026): bir bileşen çökerse boş/kırmızı ekran yerine sakin bir "tekrar dene"
 * gösterilir ve hata anonim olarak kaydedilir. Metinler i18n'e bağlı değil: çökme i18n'in kendisinde olabilir.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; where: string }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  override componentDidCatch(error: Error) { trackError(error, `boundary:${this.props.where}`); }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }} testID="error-boundary">
        <Text style={{ fontSize: 22, fontWeight: '700', color: mapTheme.paper, textAlign: 'center' }}>Bir şeyler ters gitti</Text>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>Something went wrong. Tekrar deneyebilirsin.</Text>
        <Pressable accessibilityRole="button" onPress={() => this.setState({ error: null })} style={{ height: 48, paddingHorizontal: 28, borderRadius: 24, backgroundColor: mapTheme.paper, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: mapTheme.ink }}>Tekrar dene</Text>
        </Pressable>
      </View>
    );
  }
}
