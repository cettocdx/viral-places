/**
 * OpenStreetMap opening_hours'un yaygın alt kümesi (29.10.2026): "Mo-Fr 09:00-18:00; Sa 10:00-14:00", "24/7",
 * gece yarısını aşan aralık ("18:00-02:00"), "off". Bayram/PH/ay kuralları desteklenmez → bilinmiyor (null):
 * yanlış "açık" demektense hiç demeyiz. Saat, mekanın şehrinin saat diliminde değerlendirilir.
 */
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
type Range = { from: number; to: number };
export type Week = Range[][]; // 0 = Pazartesi, dakika cinsinden

function parseDays(spec: string): number[] | null {
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const m = part.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!m) return null;
    const a = DAYS.indexOf(m[1] as never), b = m[2] ? DAYS.indexOf(m[2] as never) : a;
    for (let d = a; ; d = (d + 1) % 7) { out.add(d); if (d === b) break; }
  }
  return [...out];
}
function parseTimes(spec: string): Range[] | null {
  if (spec.trim() === 'off' || spec.trim() === 'closed') return [];
  const out: Range[] = [];
  for (const part of spec.split(',')) {
    const m = part.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\+?$/);
    if (!m) return null;
    out.push({ from: Number(m[1]) * 60 + Number(m[2]), to: Number(m[3]) * 60 + Number(m[4]) });
  }
  return out;
}

export function parseOpeningHours(raw: string | null | undefined): Week | null {
  if (!raw) return null;
  const text = raw.trim();
  if (text === '24/7') return Array.from({ length: 7 }, () => [{ from: 0, to: 24 * 60 }]);
  const week: Week = Array.from({ length: 7 }, () => []);
  for (const rule of text.split(';').map((r) => r.trim()).filter(Boolean)) {
    const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?)+)\s+(.+)$/);
    const days = m ? parseDays(m[1]!.replace(/,$/, '')) : /^\d/.test(rule) ? [0, 1, 2, 3, 4, 5, 6] : null;
    const times = parseTimes(m ? m[2]! : rule);
    if (!days || !times) return null;
    for (const d of days) week[d] = times; // sonraki kural öncekini ezer (OSM anlamı)
  }
  return week;
}

/** Şehrin saat diliminde gün (0 = Pazartesi) ve dakika. */
export function localNow(timeZone: string, now = new Date()): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(wd);
  const minute = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) * 60 + Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { day: Math.max(0, day), minute };
}

export type OpenState = { open: boolean; until: number | null } | null;

/** Şu an açık mı ve ne zamana kadar / ne zaman açılıyor (dakika, gün içi). Bilinmiyorsa null. */
export function openState(week: Week | null, at: { day: number; minute: number }): OpenState {
  if (!week) return null;
  const today = week[at.day] ?? [];
  const yesterday = week[(at.day + 6) % 7] ?? [];
  for (const r of yesterday) if (r.to < r.from && at.minute < r.to) return { open: true, until: r.to };
  for (const r of today) {
    const overnight = r.to <= r.from;
    if (at.minute >= r.from && (overnight || at.minute < r.to)) return { open: true, until: r.to % (24 * 60) };
  }
  const next = today.filter((r) => r.from > at.minute).sort((a, b) => a.from - b.from)[0];
  return { open: false, until: next ? next.from : null };
}

export const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
