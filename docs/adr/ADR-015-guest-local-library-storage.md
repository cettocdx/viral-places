# ADR-015 — Misafir yerel kütüphane depolaması

**Tarih:** 11 Eylül 2026 · **Durum:** Kabul edildi (M1) · **Kapsam:** §7.5, §20

## Karar

Misafir kaydetme/takip/plan verileri `expo-sqlite/kv-store` (SQLiteStorage) üzerinde, zustand `persist` ile `vp.library.guest.v1` anahtarında tutulur. Kural mantığı `packages/domain/src/library.ts` içinde saf fonksiyondur (idempotent kayıt, revision kontrollü plan sırası); store yalnız bunları sarar. Secret/token bu depoya yazılmaz (M2'de SecureStore).

## Neden

Expo Go'da çalışır, ek native modül gerektirmez, senkron API ile hidrasyon basit. AsyncStorage (kaldırılmış core modül) kullanılmaz. M2'de hesap gelince local UUID → uzak kimlik eşlemesi ve logout temizliği bu ad alanı üzerinden yapılır; anahtar adı kullanıcı kimliğiyle ayrılacak şekilde sürümlenmiştir.
