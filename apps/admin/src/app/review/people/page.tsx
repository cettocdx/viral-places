import { listCreators } from './actions';
import { PeopleClient } from './people-client';

export const dynamic = 'force-dynamic';

/** Kişi onay ekranı: yalnız burada onaylanan hesapların mekan önerileri yayına girer. */
export default async function PeoplePage() {
  const [candidates, approved] = await Promise.all([listCreators('candidate'), listCreators('approved')]);
  return <PeopleClient candidates={candidates} approvedCount={approved.length} />;
}
