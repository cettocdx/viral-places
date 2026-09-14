/**
 * AI çıktı sözleşmesi (§15.3 PlaceMentionExtraction) + model sonrası backend doğrulaması (prompts/EXTRACT_PLACES.md).
 * Model çıktısı güvenilmeyen veridir: şema, kimlik eşleşmesi, kanıt aralıklarının gerçekten kaynakta bulunması,
 * zaman damgalarının medya süresi içinde olması burada kontrol edilir. Offset birimi Unicode code point'tir.
 */
import { z } from 'zod';

export const EXTRACTION_SCHEMA_VERSION = '1.0' as const;

export const EvidenceKind = z.enum(['caption', 'transcript', 'video_frame', 'creator_supplied']);
export type EvidenceKind = z.infer<typeof EvidenceKind>;
export const Recommendation = z.enum(['recommend', 'neutral', 'avoid', 'unclear']);
export type Recommendation = z.infer<typeof Recommendation>;
export const AnalysisMode = z.enum(['metadata_only', 'transcript', 'native_video', 'sampled_frames']);
export type AnalysisMode = z.infer<typeof AnalysisMode>;

export const Evidence = z.object({
  id: z.string().min(1).max(64),
  kind: EvidenceKind,
  sourceField: z.string().min(1).max(64),
  startMs: z.number().int().nonnegative().nullable(),
  endMs: z.number().int().nonnegative().nullable(),
  charStart: z.number().int().nonnegative().nullable(),
  charEnd: z.number().int().nonnegative().nullable(),
  excerpt: z.string().max(2000).nullable(),
});
export type Evidence = z.infer<typeof Evidence>;

export const FamilyAttribute = z.object({
  key: z.string().min(1).max(64),
  value: z.enum(['supported', 'contradicted', 'unknown']),
  evidenceIds: z.array(z.string()),
});

export const PlaceMention = z.object({
  mentionId: z.string().min(1).max(64),
  rawPlaceName: z.string().max(200).nullable(),
  cityHint: z.string().max(120).nullable(),
  countryHint: z.string().max(120).nullable(),
  addressHint: z.string().max(300).nullable(),
  branchHint: z.string().max(200).nullable(),
  categoryCandidates: z.array(z.string().max(64)).max(6),
  recommendation: Recommendation,
  familyAttributes: z.array(FamilyAttribute).max(10),
  suggestedItems: z.array(z.object({ name: z.string().min(1).max(120), evidenceIds: z.array(z.string()) })).max(20),
  claims: z.array(z.object({ key: z.string().min(1).max(64), value: z.string().max(300), evidenceIds: z.array(z.string()) })).max(30),
  evidence: z.array(Evidence).max(40),
  uncertaintyReasons: z.array(z.string().max(300)).max(20),
});
export type PlaceMention = z.infer<typeof PlaceMention>;

export const PlaceMentionExtraction = z.object({
  schemaVersion: z.literal(EXTRACTION_SCHEMA_VERSION),
  sourcePostId: z.string().min(1),
  analysisMode: AnalysisMode,
  language: z.string().max(16).nullable(),
  mentions: z.array(PlaceMention).max(25),
  abstain: z.boolean(),
  abstainReason: z.string().max(500).nullable(),
});
export type PlaceMentionExtraction = z.infer<typeof PlaceMentionExtraction>;

/** Modele giden doğrulanmış zarf (prompts/EXTRACT_PLACES.md "User/veri mesajı"). Yalnız izinli alanlar doldurulur. */
export const ExtractionEnvelope = z.object({
  sourcePostId: z.string().min(1),
  analysisMode: AnalysisMode,
  sourceFields: z.object({
    caption: z.string().nullable(),
    permittedTranscriptSegments: z.array(z.object({ startMs: z.number().int().nonnegative(), endMs: z.number().int().positive(), text: z.string() })),
    permittedCreatorContext: z.string().nullable(),
  }),
  providedMediaDurationMs: z.number().int().positive().nullable(),
  localeHint: z.string().max(16),
});
export type ExtractionEnvelope = z.infer<typeof ExtractionEnvelope>;

/** Code point tabanlı dilim; JS UTF-16 index farkını dışarıda bırakır. */
export function sliceCodePoints(text: string, start: number, end: number): string {
  return Array.from(text).slice(start, end).join('');
}
export function codePointLength(text: string): number {
  return Array.from(text).length;
}

export interface ValidationIssue {
  mentionId: string | null;
  evidenceId: string | null;
  code:
    | 'source_post_id_mismatch'
    | 'analysis_mode_mismatch'
    | 'evidence_kind_not_permitted'
    | 'evidence_span_missing'
    | 'evidence_span_out_of_range'
    | 'evidence_excerpt_mismatch'
    | 'evidence_time_out_of_range'
    | 'evidence_time_missing'
    | 'evidence_source_field_unknown'
    | 'dangling_evidence_reference'
    | 'duplicate_evidence_id'
    | 'duplicate_mention_id'
    | 'claim_without_evidence'
    | 'abstain_with_mentions';
  detail: string;
}

const KINDS_BY_MODE: Record<AnalysisMode, EvidenceKind[]> = {
  metadata_only: ['caption', 'creator_supplied'],
  transcript: ['caption', 'transcript', 'creator_supplied'],
  native_video: ['caption', 'transcript', 'video_frame', 'creator_supplied'],
  sampled_frames: ['caption', 'transcript', 'video_frame', 'creator_supplied'],
};

/**
 * Model sonrası kontroller. Sonuç { ok:false } ise çıktı DB'ye yazılmaz; en fazla bir onarım denemesi çağıran katmanda yapılır.
 * Kanıt semantiğinin doğruluğunu kanıtlamaz (eval/review ayrı); yalnız referans bütünlüğü ve aralık gerçekliğidir.
 */
export function validateExtraction(output: PlaceMentionExtraction, envelope: ExtractionEnvelope): { ok: boolean; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (output.sourcePostId !== envelope.sourcePostId) issues.push({ mentionId: null, evidenceId: null, code: 'source_post_id_mismatch', detail: output.sourcePostId });
  if (output.analysisMode !== envelope.analysisMode) issues.push({ mentionId: null, evidenceId: null, code: 'analysis_mode_mismatch', detail: output.analysisMode });
  if (output.abstain && output.mentions.length > 0) issues.push({ mentionId: null, evidenceId: null, code: 'abstain_with_mentions', detail: String(output.mentions.length) });

  const permittedKinds = KINDS_BY_MODE[envelope.analysisMode];
  const caption = envelope.sourceFields.caption;
  const transcriptText = envelope.sourceFields.permittedTranscriptSegments.map((s) => s.text).join('\n');
  const creatorCtx = envelope.sourceFields.permittedCreatorContext;
  const textFields: Record<string, string | null> = { caption, transcript: transcriptText || null, creator_context: creatorCtx };

  const mentionIds = new Set<string>();
  for (const m of output.mentions) {
    if (mentionIds.has(m.mentionId)) issues.push({ mentionId: m.mentionId, evidenceId: null, code: 'duplicate_mention_id', detail: m.mentionId });
    mentionIds.add(m.mentionId);
    const evidenceIds = new Set<string>();
    for (const e of m.evidence) {
      if (evidenceIds.has(e.id)) issues.push({ mentionId: m.mentionId, evidenceId: e.id, code: 'duplicate_evidence_id', detail: e.id });
      evidenceIds.add(e.id);
      if (!permittedKinds.includes(e.kind)) {
        issues.push({ mentionId: m.mentionId, evidenceId: e.id, code: 'evidence_kind_not_permitted', detail: `${e.kind} in ${envelope.analysisMode}` });
        continue;
      }
      if (e.kind === 'caption' || e.kind === 'transcript' || e.kind === 'creator_supplied') {
        const field = e.kind === 'caption' ? 'caption' : e.kind === 'transcript' ? 'transcript' : 'creator_context';
        const text = textFields[field] ?? null;
        if (e.sourceField !== field) issues.push({ mentionId: m.mentionId, evidenceId: e.id, code: 'evidence_source_field_unknown', detail: e.sourceField });
        if (text === null) {
          issues.push({ mentionId: m.mentionId, evidenceId: e.id, code: 'evidence_span_missing', detail: `${field} not provided` });
          continue;
        }
        if (e.charStart === null || e.charEnd === null) {
          issues.push({ mentionId: m.mentionId, evidenceId: e.id, code: 'evidence_span_missing', detail: 'charStart/charEnd null' });
          continue;
        }
        const len = codePointLength(text);
        if (e.charStart >= e.charEnd || e.charEnd > len) {
          issues.push({ mentionId: m.mentionId, evidenceId: e.id, code: 'evidence_span_out_of_range', detail: `[${e.charStart},${e.charEnd}) len=${len}` });
          continue;
        }
        const actual = sliceCodePoints(text, e.charStart, e.charEnd);
        if (e.excerpt !== null && e.excerpt.trim() !== actual.trim()) {
          issues.push({ mentionId: m.mentionId, evidenceId: e.id, code: 'evidence_excerpt_mismatch', detail: `expected "${actual.slice(0, 60)}"` });
        }
        if (e.kind === 'transcript') {
          if (e.startMs === null || e.endMs === null) issues.push({ mentionId: m.mentionId, evidenceId: e.id, code: 'evidence_time_missing', detail: 'transcript evidence needs startMs/endMs' });
          else if (envelope.providedMediaDurationMs !== null && (e.startMs > e.endMs || e.endMs > envelope.providedMediaDurationMs))
            issues.push({ mentionId: m.mentionId, evidenceId: e.id, code: 'evidence_time_out_of_range', detail: `${e.startMs}-${e.endMs} > ${envelope.providedMediaDurationMs}` });
        }
      } else {
        // video_frame: yalnız medya gerçekten sağlandıysa; zaman aralığı süre içinde olmalı
        if (e.startMs === null || e.endMs === null) issues.push({ mentionId: m.mentionId, evidenceId: e.id, code: 'evidence_time_missing', detail: 'video_frame needs startMs/endMs' });
        else if (envelope.providedMediaDurationMs === null || e.startMs > e.endMs || e.endMs > envelope.providedMediaDurationMs)
          issues.push({ mentionId: m.mentionId, evidenceId: e.id, code: 'evidence_time_out_of_range', detail: `${e.startMs}-${e.endMs} vs ${envelope.providedMediaDurationMs}` });
      }
    }
    const refs = [...m.familyAttributes.flatMap((f) => f.evidenceIds), ...m.suggestedItems.flatMap((s) => s.evidenceIds), ...m.claims.flatMap((c) => c.evidenceIds)];
    for (const r of refs) if (!evidenceIds.has(r)) issues.push({ mentionId: m.mentionId, evidenceId: r, code: 'dangling_evidence_reference', detail: r });
    for (const c of m.claims) if (c.evidenceIds.length === 0) issues.push({ mentionId: m.mentionId, evidenceId: null, code: 'claim_without_evidence', detail: c.key });
    for (const f of m.familyAttributes) if (f.value !== 'unknown' && f.evidenceIds.length === 0) issues.push({ mentionId: m.mentionId, evidenceId: null, code: 'claim_without_evidence', detail: `family:${f.key}` });
  }
  return { ok: issues.length === 0, issues };
}

/** Kanıt türleri (matcher.minEvidenceKinds için): mention'daki geçerli kanıtların benzersiz türleri. */
export function evidenceKindsOf(m: PlaceMention): string[] {
  return Array.from(new Set(m.evidence.map((e) => e.kind)));
}
