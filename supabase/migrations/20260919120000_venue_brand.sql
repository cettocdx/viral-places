-- Mekan markası: Google Places websiteUri ve ondan türetilen logo (favicon) URL'si.
alter table public.venues add column if not exists website_url text;
alter table public.venues add column if not exists logo_url text;
