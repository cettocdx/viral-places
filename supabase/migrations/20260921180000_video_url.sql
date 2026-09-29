-- Kalıcı depodaki video dosyası (TikTok arayüzü olmadan yerel oynatıcı; ürün sahibi kararı, 21.09.2026).
alter table private.source_posts add column if not exists video_url text;
alter table public.venue_sources add column if not exists video_url text;
