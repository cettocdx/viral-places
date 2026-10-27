import { describe, expect, it } from 'vitest';
import { claimVideo, venueFocus, videoQuality } from '../quality-gate';

describe('quality gate', () => {
  it('accepts vertical 1080p clips of normal length', () => {
    expect(videoQuality({ width: 1080, height: 1920, durationS: 45 })).toEqual({ ok: true });
  });
  it('rejects the 576p/720p files that made the app look cheap', () => {
    expect(videoQuality({ width: 576, height: 1024, durationS: 30 })).toEqual({ ok: false, reason: 'low_resolution' });
    expect(videoQuality({ width: 720, height: 1280, durationS: 30 })).toEqual({ ok: false, reason: 'low_resolution' });
  });
  it('rejects horizontal, unknown, too short and too long videos', () => {
    expect(videoQuality({ width: 1920, height: 1080 })).toEqual({ ok: false, reason: 'not_vertical' });
    expect(videoQuality({})).toEqual({ ok: false, reason: 'unknown_format' });
    expect(videoQuality({ width: 1080, height: 1920, durationS: 3 })).toEqual({ ok: false, reason: 'too_short' });
    expect(videoQuality({ width: 1080, height: 1920, durationS: 300 })).toEqual({ ok: false, reason: 'too_long' });
  });
  it('drops list videos and videos with no venue', () => {
    expect(venueFocus(1)).toEqual({ ok: true });
    expect(venueFocus(2)).toEqual({ ok: true });
    expect(venueFocus(10)).toEqual({ ok: false, reason: 'list_video' });
    expect(venueFocus(0)).toEqual({ ok: false, reason: 'no_venue' });
  });
  it('uses a source video for one venue only', () => {
    const used = new Set<string>();
    expect(claimVideo(used, 'https://tiktok.com/@a/video/1')).toBe(true);
    expect(claimVideo(used, 'https://tiktok.com/@a/video/1')).toBe(false);
  });
});
