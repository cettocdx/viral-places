import { Platform } from 'react-native';
import { appConfig } from '@/lib/config';
import { newId } from '@/lib/ids';
import { zustandSqliteStorage } from '@/lib/kv-storage';

/**
 * Anonim ölçüm ve hata kaydı (29.10.2026): olaylar kuyrukta toplanır, birkaç saniyede bir toplu gönderilir.
 * Kurulum kimliği rastgele ve cihazda; ad, konum, e-posta gönderilmez. Ağ yoksa olay sessizce düşer —
 * ölçüm hiçbir zaman uygulamayı yavaşlatmaz ya da hata göstermez.
 */
type Props = Record<string, string | number | boolean | null>;
const KEY = 'vp.install-id';
let installId: string | null = null;
const queue: { name: string; props: Props; at: string }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function id(): string {
  if (installId) return installId;
  installId = (zustandSqliteStorage.getItem(KEY) as string | null) ?? null;
  if (!installId) { installId = newId(); zustandSqliteStorage.setItem(KEY, installId); }
  return installId;
}

async function flush() {
  timer = null;
  if (!appConfig.apiBaseUrl || queue.length === 0) { queue.length = 0; return; }
  const events = queue.splice(0, 25);
  try {
    await fetch(`${appConfig.apiBaseUrl}/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ installId: id(), appVersion: appConfig.version, platform: Platform.OS, events }) });
  } catch { /* çevrimdışı: düşer */ }
  if (queue.length) schedule();
}
function schedule() { if (!timer) timer = setTimeout(() => void flush(), 4000); }

export function track(name: string, props: Props = {}) {
  if (!/^[a-z_.]{2,48}$/.test(name)) return;
  queue.push({ name, props, at: new Date().toISOString() });
  if (queue.length > 200) queue.splice(0, queue.length - 200);
  schedule();
}

export function trackError(error: unknown, where: string) {
  const e = error instanceof Error ? error : new Error(String(error));
  track('app.error', { where, message: e.message.slice(0, 300), stack: (e.stack ?? '').split('\n').slice(0, 4).join(' | ').slice(0, 300) });
}

/** Yakalanmamış JS hataları da kayda geçer (önceki işleyici korunur). */
export function installGlobalErrorHandler() {
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
  const eu = g.ErrorUtils;
  if (!eu) return;
  const prev = eu.getGlobalHandler();
  eu.setGlobalHandler((e, fatal) => { trackError(e, fatal ? 'fatal' : 'global'); void flush(); prev(e, fatal); });
}
