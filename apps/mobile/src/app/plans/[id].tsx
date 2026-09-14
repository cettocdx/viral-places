import { useLocalSearchParams } from 'expo-router';
import { PlanDetailScreen } from '@/screens/plan-detail';

export default function PlanRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlanDetailScreen id={String(id)} />;
}
