-- İleri düzeltme (forward-fix): worker tüm handler'larda rezervasyon kimliğini "<iş türü>-<outbox uuid>" biçiminde
-- metin olarak üretir (poll-…, extract-…, transcript-…, places-…, summary-…, metrics-…); packages/pipeline budget.ts
-- de kimliği metin olarak karşılaştırır. 20260913120000'deki kolon uuid olduğundan ilk canlı çekimde
-- "invalid input syntax for type uuid" hatası alındı (19 Eylül 2026). Kolona başka tablo referans vermiyor.
alter table private.budget_reservations
  alter column id drop default,
  alter column id type text using id::text;
