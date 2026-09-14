import { useLocalSearchParams } from 'expo-router';
import { PlaceDetailScreen } from '@/screens/place-detail';

export default function PlaceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceDetailScreen id={String(id)} />;
}
