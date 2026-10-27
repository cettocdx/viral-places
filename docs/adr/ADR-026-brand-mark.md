# ADR-026 — Marka: pin içinde "e" ve sticker wordmark

Tarih: 27 Ekim 2026 · Durum: Ürün sahibi seçti, uygulandı.

- Logo: açık yeşil (#D5F49A) zemin, beyaz kenarlı lacivert damla pin, içinde açık yeşil yuvarlak kalın "e" (SF Pro Rounded ana hatları), pinin sağ üst omzunda oynat rozeti. Kaynak: `design/brand/final/` (`gen.py` ile üretilir).
- Wordmark: küçük harf "elsewhere", lacivert harf + kalın beyaz sticker kenarı (`components/wordmark.tsx`). Eski ters harfli "ELSEƎЯƎHW" kaldırıldı.
- iOS: `assets/Elsewhere.icon` (Icon Composer) üç katman: pin, e, oynat; dolgu açık yeşil. `assets/icon.png`, Android adaptif ikon (zemin #D5F49A), favicon ve `splash-icon.png` aynı kaynaktan.
- Süreç: dört yön (pin, sticker harf, pin kümesi, oynat-pin) → B seçildi → ürün sahibi revizyonları → "pin içinde e" (design/brand/2026-10-27-directions/).
