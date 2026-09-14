import { describe, expect, it } from 'vitest';
import { validateSocialUrl } from './validate-social-url';

describe('validateSocialUrl', () => {
  it('accepts https tiktok/instagram post links only', () => {
    expect(validateSocialUrl('https://www.tiktok.com/@x/video/1')).toBe('valid');
    expect(validateSocialUrl('https://www.instagram.com/reel/abc/')).toBe('valid');
  });
  it('rejects http, other hosts, private addresses and garbage', () => {
    expect(validateSocialUrl('http://www.tiktok.com/@x/video/1')).toBe('invalid');
    expect(validateSocialUrl('https://evil.example/tiktok.com')).toBe('invalid');
    expect(validateSocialUrl('https://127.0.0.1/')).toBe('invalid');
    expect(validateSocialUrl('not a url')).toBe('invalid');
  });
});
