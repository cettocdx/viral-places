import { useLocalSearchParams } from 'expo-router';
import { TrendExplainerSheet } from '@/screens/sheets/trend-explainer';

export default function TrendExplainerRoute() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  return <TrendExplainerSheet placeId={String(placeId)} />;
}
