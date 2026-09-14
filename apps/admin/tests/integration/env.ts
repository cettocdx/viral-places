/** .env.local'ı process.env'e yükler (değerler log'lanmaz). */
import fs from 'node:fs';
import path from 'node:path';

export function loadLocalEnv(): void {
  const p = path.resolve(__dirname, '../../.env.local');
  if (!fs.existsSync(p)) throw new Error('apps/admin/.env.local yok: `npx supabase status -o env` ile doldur (README).');
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
  }
}
loadLocalEnv();
