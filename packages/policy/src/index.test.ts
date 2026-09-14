import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { aiInputPlan, decideRender, mayPerform, type RightsRecord } from './index';

const now = '2026-09-11T09:00:00Z';
const template = JSON.parse(readFileSync(resolve(__dirname, '../../../config/provider-rights.template.json'), 'utf8'));

function approved(perms: Partial<RightsRecord['permissions']>, extra: Partial<RightsRecord> = {}): RightsRecord {
  return {
    policyId: 'test',
    policyVersion: '1.0',
    approvedBy: 'legal-reviewer',
    approvedAt: '2026-09-01T00:00:00Z',
    expiresAt: null,
    revokedAt: null,
    permissions: perms,
    ...extra,
  };
}

describe('deny-by-default', () => {
  it('no record -> unavailable with NO_APPROVED_RIGHTS_RECORD (spec §35.2)', () => {
    const d = decideRender('fixture-post-001', null, now);
    expect(d.decision).toBe('deny');
    expect(d.renderMode).toBe('unavailable');
    expect(d.reasons).toEqual(['NO_APPROVED_RIGHTS_RECORD']);
    expect(d.allowedActions).toEqual([]);
  });
  it('template file (all false, unapproved) grants nothing', () => {
    const rec: RightsRecord = { ...template, permissions: template.permissions };
    expect(decideRender('p', rec, now).renderMode).toBe('unavailable');
    expect(mayPerform(rec, 'may_collect_metadata', now)).toBe(false);
  });
  it('download URL present but no media AI right -> media not sent to model', () => {
    const rec = approved({ may_download_media: true, may_send_metadata_to_ai: true });
    expect(aiInputPlan(rec, now)).toEqual({ metadata: true, media: false, analysisMode: 'metadata_only' });
  });
  it('expired or revoked record denies even if permissions are true', () => {
    const expired = approved({ may_show_source_link: true }, { expiresAt: '2026-09-10T00:00:00Z' });
    expect(decideRender('p', expired, now).reasons).toContain('RIGHTS_EXPIRED');
    const revoked = approved({ may_show_source_link: true }, { revokedAt: '2026-09-10T00:00:00Z' });
    expect(decideRender('p', revoked, now).renderMode).toBe('unavailable');
  });
});

describe('render mode derivation', () => {
  it('source link only -> link_only', () => {
    expect(decideRender('p', approved({ may_show_source_link: true }), now).renderMode).toBe('link_only');
  });
  it('embed + source link -> official_embed', () => {
    expect(decideRender('p', approved({ may_display_embed: true, may_show_source_link: true }), now).renderMode).toBe('official_embed');
  });
  it('rehost + source link -> licensed_native', () => {
    expect(decideRender('p', approved({ may_rehost_video: true, may_show_source_link: true }), now).renderMode).toBe('licensed_native');
  });
  it('embed without source-link right stays unavailable (attribution required)', () => {
    expect(decideRender('p', approved({ may_display_embed: true }), now).renderMode).toBe('unavailable');
  });
});
