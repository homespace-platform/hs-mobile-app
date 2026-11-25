// Where the app's sensitive temp files live and when they die: docs/yeu-cau-thue/phase3-cache.md.
// Nothing here deletes outside the app's own cache folder.
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

/** Every rental file the app writes: one folder per operation, so a file keeps its name. */
const RENTAL = 'rental-files/';
/** Where expo-image-picker and expo-document-picker put the copies they hand over (Android and iOS). */
const PICKERS = ['ImagePicker/', 'DocumentPicker/'];
/** What earlier builds wrote straight into the cache root. */
const LEGACY = /^(rental|contract)-[0-9a-f-]{36}$|^homespace-receipt-.*\.pdf$|^VietQR_.*\.png$/;
/** A share target may still be reading after the share sheet has answered (Android). */
export const SHARED_COPY_TTL_MS = 10 * 60_000;

let ended = false;
let epoch = 0;
/** Files in use: an upload is reading them, or a share target may still be. Keyed by `leaseKey`. */
const leases = new Map<string, number>();
/** In use when somebody wanted them gone: deleted when the last lease ends. */
const doomed = new Set<string>();

export function fileSessionGuard() {
  const started = epoch;
  return () => {
    if (ended || started !== epoch) throw new Error('Phiên đăng nhập đã kết thúc.');
  };
}

async function remove(uri: string) {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Cleanup is best effort; the next purge tries again.
  }
}

/**
 * The path of `uri` below the app cache `folder`, decoded as the native side reads it. Null for
 * anything else: another location, "..", or a "?"/"#" that would cut the native path short.
 */
function partsInside(uri: string, folder: string): string[] | null {
  const root = FileSystem.cacheDirectory;
  if (!root || !uri.startsWith(root + folder) || /[?#]/.test(uri)) return null;
  let rest: string;
  try {
    rest = decodeURIComponent(uri.slice(root.length + folder.length));
  } catch {
    return null;
  }
  const parts = rest.split(/[/\\]/);
  return parts.some((part) => !part || part === '.' || part === '..' || part.includes('\0'))
    ? null
    : parts;
}

/** The per-operation folder of a rental file, or null when `uri` is not one. */
const folderOf = (uri: string) =>
  partsInside(uri, RENTAL)?.length === 2 ? uri.slice(0, uri.lastIndexOf('/') + 1) : null;

/** A rental file is leased as its folder, a picker copy as itself. */
const leaseKey = (uri: string) => folderOf(uri) ?? uri;

/** Keeps the files from being deleted until the returned function is called (once). */
function lease(uris: readonly string[]) {
  const keys = uris.map(leaseKey);
  for (const key of keys) leases.set(key, (leases.get(key) ?? 0) + 1);
  return () => {
    for (const key of keys) {
      const left = (leases.get(key) ?? 1) - 1;
      if (left > 0) leases.set(key, left);
      else {
        leases.delete(key);
        if (doomed.delete(key)) void remove(key);
      }
    }
  };
}

/**
 * For whatever reads local files: they stay until `run` settles, however it ends. Take it before the
 * first await, and for a batch around the whole batch, so a file still waiting its turn stays too.
 */
export async function withFileLease<T>(uris: readonly string[], run: () => Promise<T>) {
  const release = lease(uris);
  try {
    return await run();
  } finally {
    release();
  }
}

async function retire(path: string) {
  if (leases.has(path)) doomed.add(path);
  else await remove(path);
}

/**
 * Writes one rental file into its own folder. A failed write leaves nothing, and so does a write
 * that finishes after the session ended (a late download of the account that signed out).
 */
export async function writeRentalFile(
  fileName: string,
  fallback: string,
  write: (target: string) => Promise<string>
): Promise<string> {
  const started = epoch;
  const over = () => ended || started !== epoch;
  if (!FileSystem.cacheDirectory || over()) throw new Error('Không thể lưu tệp tạm.');
  const folder = `${FileSystem.cacheDirectory}${RENTAL}${randomUUID()}/`;
  const name = fileName.split(/[/\\]/).pop()?.trim();
  const target = `${folder}${encodeURIComponent(name && !/^\.+$/.test(name) ? name : fallback)}`;
  const release = lease([target]);
  try {
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    const uri = await write(target);
    if (over()) throw new Error('Phiên đăng nhập đã kết thúc.');
    return uri;
  } catch (error) {
    await retire(folder);
    throw error;
  } finally {
    release();
  }
}

/** Runs a share of a rental file, and keeps the file leased for a while after the hand-off. */
export async function shareRentalFile(uri: string, share: () => Promise<unknown>) {
  const release = lease([uri]);
  try {
    await share();
  } catch (error) {
    // The sheet never took the file.
    release();
    throw error;
  }
  // shortcut: the timer dies with the process; a copy still waiting then goes with a later purge.
  setTimeout(release, SHARED_COPY_TTL_MS);
}

/** The app is done with its copy. A copy that is still in use goes when it is free. */
export async function discardRentalFile(uri: string) {
  const folder = folderOf(uri);
  if (folder) await retire(folder);
}

/** Deletes a copy an image/document picker made in the app cache. Never the user's own file. */
export async function discardPickedCopy(uri: string) {
  if (PICKERS.some((folder) => partsInside(uri, folder)?.length === 1)) await retire(uri);
}

/** Removes a cache folder, except what is in use: that goes when its last lease ends. */
async function purgeFolder(root: string, folder: string, current: () => boolean) {
  const inUse = () => {
    const names = new Map<string, string>();
    for (const key of leases.keys()) {
      const parts = partsInside(key.replace(/\/$/, ''), folder);
      if (parts?.length === 1) names.set(parts[0], key);
    }
    return names;
  };
  const held = inUse();
  held.forEach((key) => doomed.add(key));
  let names: string[] = [];
  try {
    names = await FileSystem.readDirectoryAsync(root + folder);
  } catch {
    // Unlisted files go with the next purge.
  }
  // A slow listing might already contain a new session's files. Never delete a whole picker folder.
  if (!current()) return;
  const kept = inUse();
  kept.forEach((key) => doomed.add(key));
  await Promise.all(
    names
      .filter((name) => !kept.has(name))
      .map((name) => remove(root + folder + encodeURIComponent(name)))
  );
}

/** A new session may write again. */
export function openSensitiveCache() {
  ended = false;
}

/**
 * No session: every rental file and every picker copy goes, one in use as soon as it is free. A fresh
 * process holds no lease, so the start without a session clears everything. Never rejects.
 */
export async function purgeSensitiveCache(): Promise<void> {
  ended = true;
  const generation = ++epoch;
  const current = () => ended && epoch === generation;
  const root = FileSystem.cacheDirectory;
  if (!root) return;
  const known = [RENTAL, ...PICKERS].map((folder) => purgeFolder(root, folder, current));
  let names: string[] = [];
  try {
    names = await FileSystem.readDirectoryAsync(root);
  } catch {
    // The known folders are still purged.
  }
  await Promise.all([
    ...known,
    ...(current()
      ? names
          .filter((name) => LEGACY.test(name))
          .map((name) => remove(root + encodeURIComponent(name)))
      : []),
  ]);
}
