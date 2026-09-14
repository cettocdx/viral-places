import { useLocalSearchParams } from 'expo-router';
import { SaveToCollectionSheet } from '@/screens/sheets/save-to-collection';

export default function SaveToCollectionRoute() {
  const { venueId, createOnly } = useLocalSearchParams<{ venueId?: string; createOnly?: string }>();
  return <SaveToCollectionSheet venueId={venueId ? String(venueId) : null} createOnly={createOnly === '1'} />;
}
