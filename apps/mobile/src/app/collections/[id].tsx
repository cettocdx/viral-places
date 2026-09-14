import { useLocalSearchParams } from 'expo-router';
import { CollectionDetailScreen } from '@/screens/collection-detail';

export default function CollectionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CollectionDetailScreen id={String(id)} />;
}
