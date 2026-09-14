import * as Crypto from 'expo-crypto';

/** UUID v4; domain paketine IdGenerator olarak verilir. */
export const newId = (): string => Crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();
