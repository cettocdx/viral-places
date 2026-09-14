import { SQLiteStorage } from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Misafir yerel depolama (§20): expo-sqlite kv-store. Secret veya token burada tutulmaz.
 * Kullanıcı kimliğine göre ayrılmış ad alanı, M2'de hesap gelince logout temizliği için hazır.
 */
const storage = new SQLiteStorage('viral-places-local.db');

export const zustandSqliteStorage: StateStorage = {
  getItem: (name) => storage.getItemSync(name),
  setItem: (name, value) => storage.setItemSync(name, value),
  removeItem: (name) => {
    storage.removeItemSync(name);
  },
};
