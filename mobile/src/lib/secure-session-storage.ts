import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';

const KEY_PREFIX = 'ilmgaah.session.';
const memory = new Map<string, string>();

function key(value: string) {
  return `${KEY_PREFIX}${value}`;
}

function isNative() {
  return Capacitor.isNativePlatform();
}

export const secureSessionStorage = {
  async getItem(storageKey: string): Promise<string | null> {
    if (!isNative()) return memory.get(storageKey) ?? null;
    return SecureStorage.getItem(key(storageKey));
  },

  async setItem(storageKey: string, value: string): Promise<void> {
    if (!isNative()) {
      memory.set(storageKey, value);
      return;
    }
    await SecureStorage.setItem(key(storageKey), value);
  },

  async removeItem(storageKey: string): Promise<void> {
    if (!isNative()) {
      memory.delete(storageKey);
      return;
    }
    await SecureStorage.removeItem(key(storageKey));
  },
};

export async function clearSecureSessionStorage(): Promise<void> {
  memory.clear();
  if (!isNative()) return;

  const keys = await SecureStorage.keys();
  await Promise.all(
    keys
      .filter((storageKey) => storageKey.startsWith(KEY_PREFIX))
      .map((storageKey) => SecureStorage.removeItem(storageKey)),
  );
}
