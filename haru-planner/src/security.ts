import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'haru_pin_hash';
const SALT_KEY = 'haru_pin_salt';

// 웹에는 SecureStore가 없으므로 AsyncStorage로 대체
const get = (k: string) => (Platform.OS === 'web' ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k));
const set = (k: string, v: string) => (Platform.OS === 'web' ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v));
const del = (k: string) => (Platform.OS === 'web' ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k));

const hash = (pin: string, salt: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

export async function setPin(pin: string) {
  const salt = Crypto.randomUUID();
  await set(SALT_KEY, salt);
  await set(KEY, await hash(pin, salt));
}

export async function clearPin() {
  await del(KEY);
  await del(SALT_KEY);
}

export async function verifyPin(pin: string) {
  const [stored, salt] = await Promise.all([get(KEY), get(SALT_KEY)]);
  if (!stored || !salt) return true;
  return (await hash(pin, salt)) === stored;
}

export async function hasPin() {
  return !!(await get(KEY));
}
