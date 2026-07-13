import AsyncStorage from "@react-native-async-storage/async-storage";

export type SavedItem = {
  type: string;
  id: string;
  title: string;
  savedAt: string;
};

export type AppSettings = {
  darkMode: boolean;
  prayerReminder: boolean;
  offlineDownloads: boolean;
  shareLocation: boolean;
  showActivity: boolean;
  profile?: Record<string, any>;
};

const defaults: AppSettings = {
  darkMode: false,
  prayerReminder: false,
  offlineDownloads: false,
  shareLocation: false,
  showActivity: true,
};

const memory = new Map<string, string>();

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    const raw = memory.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  }
}

async function writeJson<T>(key: string, value: T) {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    await AsyncStorage.setItem(key, raw);
  } catch {
    // The in-memory copy keeps web/preflight environments usable.
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  return { ...defaults, ...(await readJson<Partial<AppSettings>>("settings", {})) };
}

export async function setAppSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  const settings = await getAppSettings();
  await writeJson("settings", { ...settings, [key]: value });
}

export async function getPersistedOfflineCache<T>(key: string): Promise<T | null> {
  return readJson<T | null>(`cache:${key}`, null);
}

export async function setOfflineCache<T>(key: string, value: T) {
  await writeJson(`cache:${key}`, value);
}

export function getSavedItems(): SavedItem[] {
  return [];
}

export function getRecentItems(): SavedItem[] {
  return [];
}

export async function hydrateLocalCollections(): Promise<{ saved: SavedItem[]; recent: SavedItem[] }> {
  const [saved, recent] = await Promise.all([
    readJson<SavedItem[]>("collection:saved", []),
    readJson<SavedItem[]>("collection:recent", []),
  ]);
  return { saved, recent };
}

export function recordRecentItem(type: string, id: string, title: string): SavedItem[] {
  const item = { type, id, title, savedAt: new Date().toISOString() };
  const current = [item];
  writeJson("collection:recent", current).catch(() => undefined);
  return current;
}

export function saveLocalItem(type: string, id: string, title: string): SavedItem[] {
  const item = { type, id, title, savedAt: new Date().toISOString() };
  const current = [item];
  writeJson("collection:saved", current).catch(() => undefined);
  return current;
}

export async function getLocalCommunityPosts(): Promise<any[]> {
  return readJson<any[]>("community:posts", []);
}

export async function saveLocalCommunityPost(post: any) {
  const posts = await getLocalCommunityPosts();
  await writeJson("community:posts", [post, ...posts.filter((item) => item.id !== post.id)]);
}

export async function getLocalCommunityComments(postId: string): Promise<any[]> {
  const comments = await readJson<any[]>("community:comments", []);
  return comments.filter((comment) => comment.post_id === postId);
}

export async function saveLocalCommunityComment(comment: any) {
  const comments = await readJson<any[]>("community:comments", []);
  await writeJson("community:comments", [...comments, comment]);
}

export async function getLocalCommunityReactions(): Promise<Record<string, Record<string, number>>> {
  return readJson<Record<string, Record<string, number>>>("community:reactions", {});
}

export async function saveLocalCommunityReactions(reactions: Record<string, Record<string, number>>) {
  await writeJson("community:reactions", reactions);
}
