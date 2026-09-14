import { useLocalSearchParams } from 'expo-router';
import { AddToPlanSheet } from '@/screens/sheets/add-to-plan';

export default function AddToPlanRoute() {
  const { venueId, createOnly } = useLocalSearchParams<{ venueId?: string; createOnly?: string }>();
  return <AddToPlanSheet venueId={venueId ? String(venueId) : null} createOnly={createOnly === '1'} />;
}
