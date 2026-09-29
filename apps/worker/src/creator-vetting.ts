/**
 * Doğru kişileri bul (ürün sahibi, 21.09.2026): "önce doğru kişileri bulmalıyız, sonra onların gerçek mekan önerilerini".
 * Otorite ölçütü yalnız takipçi sayısıyken haber siteleri, markalar, mekanın kendi hesabı ve dizi/podcast hesapları
 * "öneren" sayılmıştı. Bu betik her hesabı iki kaynaktan puanlar ve aday listesi çıkarır; ürün sahibi onay ekranından
 * onaylar. Onaylanmamış hiçbir hesabın önerisi yayına girmez.
 *   1) Veriden kanıt: gönderilerinde İstanbul'da yeme-içme mekanı "öneren" mention sayısı.
 *   2) Kısa sınıflandırma (ucuz model, düşünme kapalı): bio + en çok izlenen 12 açıklama → hesap türü.
 * Karar verilmiş satırlar (ürün sahibi, kural, otomatik red) yeniden çalıştırmada ezilmez; yalnız yeni hesaplar puanlanır.
 * Çalıştırma: set -a; source apps/worker/.env; set +a; npx tsx src/creator-vetting.ts [limit]
 */
import Anthropic from '@anthropic-ai/sdk';
import postgres from 'postgres';

const LIMIT = Number(process.argv[2] ?? 600);
/** Takipçi tabanı ortamdan düşürülebilir: 300k+ izlenen ama 50k altı hesaplar da puanlansın, ekran 50k altını sarı etiketler. */
const MIN_FOLLOWERS = Number(process.env.VP_VET_MIN_FOLLOWERS ?? 50_000);
const CANDIDATES = 100;
const MEDIA_HANDLE = /(haber|gazete|news|medya|ajans|takvim|posta|gzt|sabah|hurriyet|milliyet|sozcu|cnnturk|ntv|trt|tv$|\.com|dizi|podcast|official|resmi)/i;

const KINDS = ['food_reviewer', 'travel_reviewer', 'lifestyle', 'news_media', 'brand', 'venue_own', 'entertainment', 'other'] as const;
type Kind = (typeof KINDS)[number];
interface Verdict { kind: Kind; istanbul_focused: boolean; recommends_venues: boolean; reason: string }

const SYSTEM = `Bir TikTok hesabını sınıflandırıyorsun. Amaç: bu hesap İstanbul'da gerçek yeme-içme mekanlarını
(restoran, kafe, tatlıcı, sokak lezzeti) izleyicisine öneren bağımsız bir içerik üreticisi mi?
Yalnız verilen bio ve açıklamalara dayan; tahmin yürütme. Yalnız şu JSON'u döndür, başka metin yazma:
{"kind": "food_reviewer|travel_reviewer|lifestyle|news_media|brand|venue_own|entertainment|other",
 "istanbul_focused": true|false, "recommends_venues": true|false, "reason": "en fazla 120 karakter Türkçe gerekçe"}
Tanımlar: food_reviewer = mekan/yemek deneyip öneren kişi; travel_reviewer = gezip yer öneren kişi;
lifestyle = günlük hayat, ara sıra mekan; news_media = haber sitesi/gazete/TV; brand = bir markanın hesabı;
venue_own = belirli bir restoran/kafenin kendi hesabı; entertainment = dizi, müzik, komedi, podcast.`;

function parseVerdict(text: string): Verdict | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]) as Partial<Verdict>;
    if (!v.kind || !KINDS.includes(v.kind as Kind)) return null;
    return { kind: v.kind as Kind, istanbul_focused: !!v.istanbul_focused, recommends_venues: !!v.recommends_venues, reason: String(v.reason ?? '').slice(0, 160) };
  } catch {
    return null;
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const model = process.env.VP_EXTRACTION_CHEAP_MODEL ?? process.env.VP_EXTRACTION_MODEL;
  if (!dbUrl || !model) throw new Error('DATABASE_URL ve model gerekli');
  const sql = postgres(dbUrl, { max: 4 });
  const client = new Anthropic({ timeout: 60_000, maxRetries: 2 });

  // Havuz: 50k+ takipçili ya da doğrulanmış, DB'de en az 3 gönderisi olan hesaplar + elle izlenen liste.
  const pool = await sql`
    select a.id, a.handle, a.bio, a.follower_count, c.display_name,
      (select count(*) from private.source_posts p where p.account_id = a.id) total_posts,
      (select count(distinct p.id) from private.source_posts p join private.place_mentions m on m.post_id = p.id
        where p.account_id = a.id and m.recommendation = 'recommend'
          and (m.city_hint ilike '%istanbul%' or m.city_hint ilike '%i̇stanbul%' or m.resolved_venue_id is not null)) recommend_posts,
      exists (select 1 from private.creator_monitoring cm where cm.account_id = a.id and cm.enabled) monitored
    from public.creator_accounts a join public.creators c on c.id = a.creator_id
    where a.platform = 'tiktok' and a.handle not like 'demo%'
      and ((coalesce(a.follower_count, 0) >= ${MIN_FOLLOWERS} or a.verification_kind = 'platform_badge_observed')
           or exists (select 1 from private.creator_monitoring cm where cm.account_id = a.id and cm.enabled))
      and (select count(*) from private.source_posts p where p.account_id = a.id) >= 3
      and not exists (select 1 from private.creator_vetting v where v.account_id = a.id and v.decided_by is not null)
    order by a.follower_count desc nulls last
    limit ${LIMIT}`;

  let classified = 0;
  let autoRejected = 0;
  let failed = 0;
  const queue = [...pool];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (;;) {
        const a = queue.shift();
        if (!a) return;
        const captions = (await sql`
          select left(p.caption, 220) caption from private.source_posts p
          left join lateral (select max(views) v from private.post_metrics m where m.post_id = p.id) mv on true
          where p.account_id = ${a.id} and p.caption is not null and length(p.caption) > 5
          order by mv.v desc nulls last limit 12`).map((r) => String(r.caption));

        let verdict: Verdict | null = null;
        if (MEDIA_HANDLE.test(String(a.handle))) {
          verdict = { kind: 'news_media', istanbul_focused: false, recommends_venues: false, reason: 'Hesap adı haber/medya/marka kalıbına uyuyor.' };
        } else {
          try {
            const res = await client.messages.create({
              model,
              max_tokens: 300,
              system: SYSTEM,
              messages: [{ role: 'user', content: JSON.stringify({ handle: a.handle, name: a.display_name, bio: a.bio ?? '', captions }) }],
            });
            const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
            verdict = parseVerdict(text);
          } catch {
            failed += 1;
          }
        }
        if (!verdict) {
          failed += 1;
          continue;
        }
        const good = ['food_reviewer', 'travel_reviewer', 'lifestyle'].includes(verdict.kind) && verdict.recommends_venues;
        const followers = Number(a.follower_count ?? 0);
        const score =
          (good ? 0.4 : 0) +
          (verdict.istanbul_focused ? 0.25 : 0) +
          Math.min(Number(a.recommend_posts) / 5, 1) * 0.25 +
          Math.min(Math.log10(Math.max(followers, 1)) / 7, 1) * 0.1 +
          (a.monitored ? 0.05 : 0);
        const verdictState = good ? 'candidate' : 'rejected';
        if (!good) autoRejected += 1;
        await sql`insert into private.creator_vetting (account_id, verdict, kind, istanbul_focused, recommends_venues, score, recommend_posts, total_posts, reason, sample_captions, decided_by, updated_at)
          values (${a.id}, ${verdictState}, ${verdict.kind}, ${verdict.istanbul_focused}, ${verdict.recommends_venues}, ${Number(score.toFixed(4))},
                  ${Number(a.recommend_posts)}, ${Number(a.total_posts)}, ${verdict.reason}, ${sql.json(captions.slice(0, 3))}, ${good ? null : 'auto'}, now())
          on conflict (account_id) do update set verdict = excluded.verdict, kind = excluded.kind, istanbul_focused = excluded.istanbul_focused,
            recommends_venues = excluded.recommends_venues, score = excluded.score, recommend_posts = excluded.recommend_posts,
            total_posts = excluded.total_posts, reason = excluded.reason, sample_captions = excluded.sample_captions,
            decided_by = excluded.decided_by, updated_at = now()
          where private.creator_vetting.decided_by is null`; // karar verilmiş satır (owner/auto-rule/auto) yeniden yazılmaz
        classified += 1;
      }
    }),
  );

  // Aday listesini ilk CANDIDATES ile sınırla; geri kalan iyi hesaplar "candidate" kalır ama ekran puana göre sıralar.
  const [stats] = await sql`select count(*) filter (where verdict = 'candidate') candidates, count(*) filter (where verdict = 'rejected') rejected from private.creator_vetting`;
  console.log(JSON.stringify({ pool: pool.length, classified, autoRejected, failed, candidates: Number(stats!.candidates), rejected: Number(stats!.rejected), shownOnScreen: CANDIDATES }));
  await sql.end();
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
