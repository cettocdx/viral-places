-- Mekan kartında karar bilgisi (ürün sahibi, 29.10.2026): saatler, telefon, adres, mutfak, fiyat seviyesi.
-- Kaynak: OpenStreetMap etiketleri (ODbL, atıf zorunlu); uydurma yok — etiket yoksa null.
alter table public.venues
  add column if not exists opening_hours text,
  add column if not exists phone text,
  add column if not exists address_line text,
  add column if not exists cuisine text,
  add column if not exists price_level smallint check (price_level between 1 and 4),
  add column if not exists practical_source text,
  add column if not exists practical_observed_at timestamptz;
