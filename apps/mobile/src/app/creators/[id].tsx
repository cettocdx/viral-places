import { useLocalSearchParams } from 'expo-router';
import { CreatorProfileScreen } from '@/screens/creator-profile';

export default function CreatorRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CreatorProfileScreen id={String(id)} />;
}
