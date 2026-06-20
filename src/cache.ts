/**
 * Core caching engine. Maps remote image URLs to files inside a dedicated
 * folder in the app's cache directory and downloads each URL at most once.
 */
import { fs } from './fs';
import { cacheKeyForUri } from './hash';

const CACHE_FOLDER = 'expo-cache-image/';

/** In-flight downloads, keyed by remote URI, so concurrent requests dedupe. */
const inFlight = new Map<string, Promise<string>>();

function cacheDir(): string {
  return `${fs().cacheDirectory}${CACHE_FOLDER}`;
}

/** Absolute local file URI where a given remote URL will be cached. */
export function localUriForRemote(uri: string): string {
  return `${cacheDir()}${cacheKeyForUri(uri)}`;
}

let dirReady: Promise<void> | null = null;
function ensureCacheDir(): Promise<void> {
  if (!dirReady) {
    dirReady = fs()
      .ensureDir(cacheDir())
      .catch((err) => {
        // Reset so a later call can retry instead of caching the failure.
        dirReady = null;
        throw err;
      });
  }
  return dirReady;
}

/**
 * Returns the local file URI for a remote image if it is already cached on
 * disk, otherwise `null`. Does not trigger a download.
 */
export async function getCachedUri(uri: string): Promise<string | null> {
  if (!uri) return null;
  const target = localUriForRemote(uri);
  const info = await fs().getInfo(target);
  return info.exists && info.size > 0 ? info.uri : null;
}

/** Whether a remote image is already present in the local cache. */
export async function isCached(uri: string): Promise<boolean> {
  return (await getCachedUri(uri)) !== null;
}

/**
 * Ensures a remote image is cached locally and resolves with the local file
 * URI. If the image is already cached the existing file is returned without a
 * network request. Concurrent calls for the same URL share a single download.
 */
export async function cacheImage(uri: string): Promise<string> {
  if (!uri) {
    throw new Error('[expo-cache-image] cacheImage called with an empty uri');
  }

  // Local/file URIs are already on-device; nothing to cache.
  if (!/^https?:\/\//i.test(uri)) {
    return uri;
  }

  const existing = await getCachedUri(uri);
  if (existing) return existing;

  const pending = inFlight.get(uri);
  if (pending) return pending;

  const target = localUriForRemote(uri);
  const task = (async () => {
    await ensureCacheDir();
    try {
      const resultUri = await fs().download(uri, target);
      return resultUri || target;
    } catch (err) {
      // Clean up any partial file so a retry starts fresh.
      try {
        await fs().delete(target);
      } catch {
        /* ignore cleanup failure */
      }
      throw err;
    } finally {
      inFlight.delete(uri);
    }
  })();

  inFlight.set(uri, task);
  return task;
}

/**
 * Pre-downloads one or more remote images into the cache ahead of time.
 * Rejections for individual URLs are swallowed so a single bad URL does not
 * fail the whole batch; resolves with the list of successfully cached URIs.
 */
export async function prefetch(
  uris: string | string[]
): Promise<string[]> {
  const list = Array.isArray(uris) ? uris : [uris];
  const results = await Promise.allSettled(list.map((u) => cacheImage(u)));
  return results
    .filter(
      (r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled'
    )
    .map((r) => r.value);
}

/** Removes a single remote image from the local cache, if present. */
export async function removeCachedImage(uri: string): Promise<void> {
  if (!uri) return;
  await fs().delete(localUriForRemote(uri));
}

/**
 * Deletes every file managed by this package and resets internal state.
 */
export async function clearCache(): Promise<void> {
  const adapter = fs();
  const dir = cacheDir();
  const names = await adapter.readDir(dir);
  await Promise.all(
    names.map((name) =>
      adapter.delete(`${dir}${name}`).catch(() => undefined)
    )
  );
  inFlight.clear();
}

/** Returns the total size, in bytes, of all cached images. */
export async function getCacheSize(): Promise<number> {
  const adapter = fs();
  const dir = cacheDir();
  const names = await adapter.readDir(dir);
  const sizes = await Promise.all(
    names.map(async (name) => {
      const info = await adapter.getInfo(`${dir}${name}`);
      return info.exists ? info.size : 0;
    })
  );
  return sizes.reduce((total, size) => total + size, 0);
}
