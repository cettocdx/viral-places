import { describe, expect, it } from 'vitest';
import type { SourcePostDto } from '@viral-places/contracts';
import { sourcePlayback, sourcePlayerHtml } from './source-playback';

const post = (overrides: Partial<SourcePostDto['media']> = {}): SourcePostDto => ({
  id: 'post-1', platform: 'tiktok', creator: { id: 'creator-1', displayName: 'Creator', handle: 'creator', platform: 'tiktok', verificationKind: 'none', avatarUrl: null },
  publishedAt: '2026-10-01T12:00:00Z', observedAt: '2026-10-01T12:00:00Z', views: null, sponsored: 'unknown', stance: 'unclear', linkResolution: 'approved',
  media: { mode: 'official_embed', thumbnailUrl: null, embedUrl: 'https://www.tiktok.com/embed/v2/6718335390845095173', videoUrl: 'https://media.example.com/video.mp4', sourceUrl: 'https://www.tiktok.com/@creator/video/6718335390845095173', rightsPolicyId: 'approved-policy', expiresAt: null, ...overrides },
});

describe('source playback boundaries', () => {
  it('uses the official player for embed rights, even when a downloadable URL exists', () => {
    const result = sourcePlayback(post());
    expect(result.kind).toBe('embed');
    if (result.kind === 'embed') { expect(result.url).toContain('/player/v1/6718335390845095173'); expect(result.url).toContain('controls=1'); }
  });
  it('plays an approved native file without sending it to a different platform', () => {
    expect(sourcePlayback(post({ mode: 'licensed_native' }))).toEqual({ kind: 'video', url: 'https://media.example.com/video.mp4' });
  });
  it('does not turn link-only content into a player', () => {
    expect(sourcePlayback(post({ mode: 'link_only' })).kind).toBe('link');
  });
  it('does not play unavailable or expired sources', () => {
    expect(sourcePlayback(post({ mode: 'unavailable' })).kind).toBe('unavailable');
    expect(sourcePlayback(post({ expiresAt: '2026-10-01T12:00:00Z' }), { now: Date.parse('2026-10-26T00:00:00Z') })).toEqual({ kind: 'unavailable', reason: 'expired' });
  });
  it('does not play a venue match awaiting review', () => {
    expect(sourcePlayback({ ...post(), linkResolution: 'review_required' }).kind).toBe('unavailable');
  });
  it('rejects lookalike hosts and script URLs in embeds', () => {
    expect(sourcePlayback(post({ embedUrl: 'https://www.tiktok.com.evil.example/player/v1/123', sourceUrl: null })).kind).toBe('unavailable');
    expect(sourcePlayback(post({ embedUrl: 'javascript:alert(1)', sourceUrl: null })).kind).toBe('unavailable');
  });
  it('requires HTTPS for native files and only permits loopback HTTP in explicit local QA', () => {
    const local = post({ mode: 'licensed_native', videoUrl: 'http://127.0.0.1:3199/video.mp4', sourceUrl: null });
    expect(sourcePlayback(local).kind).toBe('unavailable');
    expect(sourcePlayback(local, { allowLocalHttp: true }).kind).toBe('video');
    expect(sourcePlayback(post({ mode: 'licensed_native', videoUrl: 'http://example.com/video.mp4', sourceUrl: null }), { allowLocalHttp: true }).kind).toBe('unavailable');
  });
  it('offers a source link if a permitted embed is missing', () => {
    expect(sourcePlayback(post({ embedUrl: null })).kind).toBe('link');
  });
  it('does not claim an invalid demo source can be played', () => {
    expect(sourcePlayback(post({ embedUrl: null, videoUrl: null, sourceUrl: 'https://demo.invalid/video/1' })).kind).toBe('unavailable');
  });
  it('escapes script-closing content in video URLs and posters', () => {
    const html = sourcePlayerHtml({ kind: 'video', url: 'https://example.com/</script><script>alert(1)</script>' }, 'https://example.com/</script>');
    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html).toContain('\\u003c/script>');
    expect(html).toContain('controls playsinline');
  });
});
