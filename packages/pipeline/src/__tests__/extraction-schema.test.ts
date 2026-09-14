import { describe, expect, it } from 'vitest';
import { PlaceMentionExtraction, codePointLength, evidenceKindsOf, validateExtraction, type ExtractionEnvelope } from '../ai/extraction-schema';

const caption = '🍕 Pizza Roma Kadıköy çok iyi #pizza';
const envelope: ExtractionEnvelope = { sourcePostId: 'post-1', analysisMode: 'metadata_only', sourceFields: { caption, permittedTranscriptSegments: [], permittedCreatorContext: null }, providedMediaDurationMs: null, localeHint: 'tr' };

function mention(ev: Array<Partial<PlaceMentionExtraction['mentions'][number]['evidence'][number]>>, extra: Partial<PlaceMentionExtraction['mentions'][number]> = {}): PlaceMentionExtraction {
  return {
    schemaVersion: '1.0',
    sourcePostId: 'post-1',
    analysisMode: 'metadata_only',
    language: 'tr',
    mentions: [
      {
        mentionId: 'm1',
        rawPlaceName: 'Pizza Roma',
        cityHint: null,
        countryHint: null,
        addressHint: 'Kadıköy',
        branchHint: null,
        categoryCandidates: ['food'],
        recommendation: 'recommend',
        familyAttributes: [],
        suggestedItems: [],
        claims: [{ key: 'quality', value: 'çok iyi', evidenceIds: ['e1'] }],
        evidence: ev.map((e) => ({ id: 'e1', kind: 'caption', sourceField: 'caption', startMs: null, endMs: null, charStart: 2, charEnd: 12, excerpt: 'Pizza Roma', ...e })) as PlaceMentionExtraction['mentions'][number]['evidence'],
        uncertaintyReasons: [],
        ...extra,
      },
    ],
    abstain: false,
    abstainReason: null,
  };
}

describe('validateExtraction', () => {
  it('code point offsetleri doğruysa geçer (emoji ile başlayan caption)', () => {
    expect(codePointLength(caption)).toBe(caption.length - 1); // 🍕 iki UTF-16 birimi
    const r = validateExtraction(mention([{}]), envelope);
    expect(r.ok).toBe(true);
  });
  it('UTF-16 index ile verilen aralık reddedilir (excerpt uyuşmaz)', () => {
    const r = validateExtraction(mention([{ charStart: 3, charEnd: 13 }]), envelope);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('evidence_excerpt_mismatch');
  });
  it('sourcePostId/analysisMode farkı, dangling referans ve abstain+mentions yakalanır', () => {
    const out = mention([{}], { claims: [{ key: 'x', value: 'y', evidenceIds: ['nope'] }] });
    out.sourcePostId = 'other';
    out.abstain = true;
    const r = validateExtraction(out, envelope);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['source_post_id_mismatch', 'dangling_evidence_reference', 'abstain_with_mentions']));
  });
  it('metadata_only modunda transcript/video_frame kanıtı izinli değil; aralık dışı reddedilir', () => {
    const r = validateExtraction(mention([{ kind: 'video_frame', startMs: 0, endMs: 1000, charStart: null, charEnd: null, excerpt: null }]), envelope);
    expect(r.issues[0]?.code).toBe('evidence_kind_not_permitted');
    const r2 = validateExtraction(mention([{ charStart: 2, charEnd: 999 }]), envelope);
    expect(r2.issues[0]?.code).toBe('evidence_span_out_of_range');
  });
  it('transcript kanıtı süre dışında olamaz', () => {
    const env2: ExtractionEnvelope = { ...envelope, analysisMode: 'transcript', sourceFields: { ...envelope.sourceFields, permittedTranscriptSegments: [{ startMs: 0, endMs: 5000, text: 'Pizza Roma harika' }] }, providedMediaDurationMs: 6000 };
    const good = validateExtraction({ ...mention([{ kind: 'transcript', sourceField: 'transcript', charStart: 0, charEnd: 10, excerpt: 'Pizza Roma', startMs: 0, endMs: 5000 }]), analysisMode: 'transcript' }, env2);
    expect(good.ok).toBe(true);
    const bad = validateExtraction({ ...mention([{ kind: 'transcript', sourceField: 'transcript', charStart: 0, charEnd: 10, excerpt: 'Pizza Roma', startMs: 0, endMs: 9000 }]), analysisMode: 'transcript' }, env2);
    expect(bad.issues.map((i) => i.code)).toContain('evidence_time_out_of_range');
    expect(evidenceKindsOf(mention([{}]).mentions[0]!)).toEqual(['caption']);
  });
});
