/**
 * A/B: aynı gönderilerde "düşünme açık" ile "düşünme kapalı" çıkarımını karşılaştırır (maliyet/kalite).
 * Hiçbir şey yazmaz; yalnız ölçer. Çalıştırma: npx tsx src/thinking-ab.ts [adet]
 */
import { PlaceExtractor, type ExtractionEnvelope } from '@viral-places/pipeline';
import { buildCtx } from './main.ts';
import { env } from './env.ts';

const N = Number(process.argv[2] ?? 8);

async function main(): Promise<void> {
  const ctx = buildCtx();
  const model = process.env.VP_AB_MODEL ?? env.extractionModel();
  const rows = (await ctx.db.sql`
    select r.post_id, r.output, p.caption, p.language, p.media_duration_ms, p.location_tag, p.hashtags, p.upload_country_hint, p.platform, p.published_at, p.canonical_url
    from private.extraction_runs r join private.source_posts p on p.id = r.post_id
    where r.status = 'ok' and r.analysis_mode = 'metadata_only' and jsonb_array_length(coalesce(r.output->'mentions','[]'::jsonb)) > 0
    order by r.created_at desc limit ${N}`) as Array<Record<string, unknown>>;

  let onCost = 0;
  let offCost = 0;
  let same = 0;
  let diff = 0;
  for (const row of rows) {
    const envelope: ExtractionEnvelope = {
      sourcePostId: String(row.post_id),
      analysisMode: 'metadata_only',
      sourceFields: {
        caption: (row.caption as string | null) ?? null,
        permittedTranscriptSegments: [],
        permittedCreatorContext: null,
      },
      providedMediaDurationMs: (row.media_duration_ms as number | null) ?? null,
      localeHint: ((row.language as string | null) ?? 'tr') as string,
    };
    const expected = ((row.output as { mentions?: Array<{ rawPlaceName?: string }> }).mentions ?? []).map((m) => (m.rawPlaceName ?? '').toLocaleLowerCase('tr')).sort().join('|');

    const off = await new PlaceExtractor({ model, effort: 'low', thinking: false, maxTokens: 4000, timeoutMs: 120_000, maxRetries: 2 }).extract(envelope);
    const got = off.status === 'ok' ? off.extraction.mentions.map((m) => (m.rawPlaceName ?? '').toLocaleLowerCase('tr')).sort().join('|') : `ERR:${off.status}`;
    offCost += off.run.estimatedCostUsd ?? 0;
    if (got === expected) same += 1;
    else diff += 1;
    console.log(JSON.stringify({ post: String(row.post_id).slice(0, 8), beklenen: expected.slice(0, 80), dusunmesiz: got.slice(0, 80), usd: Number((off.run.estimatedCostUsd ?? 0).toFixed(4)), out: off.run.usage.outputTokens }));
  }
  console.log(JSON.stringify({ orneklem: rows.length, ayniSonuc: same, farkli: diff, dusunmesizToplamUsd: Number(offCost.toFixed(3)), referansDusunmeliUsd: Number(onCost.toFixed(3)) }));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
