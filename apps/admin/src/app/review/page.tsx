import { listQueue } from './actions';
import { QueueClient } from './queue-client';

export const dynamic = 'force-dynamic';

/** Operatör inceleme ekranı (§19.2): açık eşleşmeleri gösterir, tek tek ya da toplu karar verdirir. Yalnız yerel/korunan ortamda çalışır. */
export default async function ReviewPage() {
  const rows = await listQueue(200);
  return <QueueClient rows={rows} />;
}
