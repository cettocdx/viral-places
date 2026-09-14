/**
 * Hak/gösterim politikası (§14, §35.2). Deny-by-default: belirsiz hak false sayılır.
 * Bu modül hukuki inceleme değildir; onaylı kayıt olmadan izin üretmez.
 */
export const POLICY_VERSION = '1.0';

export const RIGHT_KEYS = [
  'may_collect_metadata',
  'may_send_metadata_to_ai',
  'may_store_metrics',
  'may_download_media',
  'may_send_media_to_ai',
  'may_create_derived_summary',
  'may_store_thumbnail',
  'may_display_embed',
  'may_rehost_video',
  'may_show_creator_profile',
  'may_show_source_link',
  'may_retain_derived_data',
] as const;
export type RightKey = (typeof RIGHT_KEYS)[number];

export interface RightsRecord {
  policyId: string;
  policyVersion: string;
  approvedBy: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  permissions: Partial<Record<RightKey, boolean>>;
}

export type RenderMode = 'official_embed' | 'licensed_native' | 'link_only' | 'unavailable';

export interface RenderDecision {
  postId: string;
  policyVersion: string;
  decision: 'allow' | 'deny';
  allowedActions: RightKey[];
  reasons: string[];
  renderMode: RenderMode;
  checkedAt: string;
  expiresAt: string | null;
}

function recordActive(r: RightsRecord, nowIso: string, reasons: string[]): boolean {
  if (!r.approvedBy || !r.approvedAt) {
    reasons.push('NO_APPROVAL_RECORD');
    return false;
  }
  if (r.revokedAt && Date.parse(r.revokedAt) <= Date.parse(nowIso)) {
    reasons.push('RIGHTS_REVOKED');
    return false;
  }
  if (r.expiresAt && Date.parse(r.expiresAt) <= Date.parse(nowIso)) {
    reasons.push('RIGHTS_EXPIRED');
    return false;
  }
  return true;
}

/** Tek bir işlem için karar; teknik erişim (download URL) hak sayılmaz. */
export function mayPerform(record: RightsRecord | null, action: RightKey, nowIso: string): boolean {
  if (!record) return false;
  const reasons: string[] = [];
  if (!recordActive(record, nowIso, reasons)) return false;
  return record.permissions[action] === true;
}

export function decideRender(postId: string, record: RightsRecord | null, nowIso: string): RenderDecision {
  const reasons: string[] = [];
  const base = { postId, policyVersion: POLICY_VERSION, checkedAt: nowIso };
  if (!record) {
    return { ...base, decision: 'deny', allowedActions: [], reasons: ['NO_APPROVED_RIGHTS_RECORD'], renderMode: 'unavailable', expiresAt: null };
  }
  if (!recordActive(record, nowIso, reasons)) {
    return { ...base, decision: 'deny', allowedActions: [], reasons, renderMode: 'unavailable', expiresAt: record.expiresAt };
  }
  const allowedActions = RIGHT_KEYS.filter((k) => record.permissions[k] === true);
  const has = (k: RightKey) => allowedActions.includes(k);

  let renderMode: RenderMode = 'unavailable';
  if (has('may_rehost_video') && has('may_show_source_link')) renderMode = 'licensed_native';
  else if (has('may_display_embed') && has('may_show_source_link')) renderMode = 'official_embed';
  else if (has('may_show_source_link')) renderMode = 'link_only';

  if (renderMode === 'unavailable') reasons.push('NO_DISPLAY_RIGHT');
  return {
    ...base,
    decision: renderMode === 'unavailable' ? 'deny' : 'allow',
    allowedActions,
    reasons,
    renderMode,
    expiresAt: record.expiresAt,
  };
}

/** AI aktarımı: metadata ve medya hakları ayrı kontrol edilir (§14.1, §15.2). */
export function aiInputPlan(record: RightsRecord | null, nowIso: string): { metadata: boolean; media: boolean; analysisMode: 'metadata_only' | 'native_video' | 'none' } {
  const metadata = mayPerform(record, 'may_send_metadata_to_ai', nowIso);
  const media = mayPerform(record, 'may_send_media_to_ai', nowIso) && mayPerform(record, 'may_download_media', nowIso);
  return { metadata, media, analysisMode: media ? 'native_video' : metadata ? 'metadata_only' : 'none' };
}
