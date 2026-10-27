import { describe, expect, it } from 'vitest';
import { thumbUrl } from './media-url';

describe('thumbUrl', () => {
  it('asks Supabase Storage for a small rendition', () => {
    expect(thumbUrl('https://abc.supabase.co/storage/v1/object/public/media/thumbs/x.jpg', 80)).toBe('https://abc.supabase.co/storage/v1/render/image/public/media/thumbs/x.jpg?width=160&height=160&resize=cover&quality=70');
  });
  it('leaves other hosts and empty values alone', () => {
    expect(thumbUrl('https://p16.tiktokcdn.com/a.jpg', 80)).toBe('https://p16.tiktokcdn.com/a.jpg');
    expect(thumbUrl(null, 80)).toBeNull();
  });
});
