/**
 * Deterministic, dependency-free hashing helpers used to turn a remote image
 * URL into a stable local filename. We intentionally avoid `expo-crypto` so the
 * package keeps a minimal peer-dependency footprint.
 */

/**
 * FNV-1a 32-bit hash. Fast, deterministic, and good enough for generating a
 * collision-resistant cache key from a URL. Returned as an unsigned hex string.
 */
export function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime multiplication using shifts to stay within JS number range
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  // Coerce to unsigned 32-bit and render as zero-padded hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Extracts a sensible file extension from a URL, stripping any query string or
 * fragment. Falls back to the provided default when none can be determined.
 */
export function extractExtension(uri: string, fallback = 'img'): string {
  // Remove query string / hash before inspecting the path
  const clean = uri.split('#')[0].split('?')[0];
  const lastSegment = clean.substring(clean.lastIndexOf('/') + 1);
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === lastSegment.length - 1) {
    return fallback;
  }
  const ext = lastSegment.substring(dotIndex + 1).toLowerCase();
  // Guard against absurdly long "extensions" that are really part of a slug
  if (!/^[a-z0-9]{1,5}$/.test(ext)) {
    return fallback;
  }
  return ext;
}

/**
 * Builds the deterministic cache filename for a given URL, e.g.
 * `https://x.com/cat.png` -> `1a2b3c4d.png`.
 */
export function cacheKeyForUri(uri: string): string {
  return `${fnv1aHash(uri)}.${extractExtension(uri)}`;
}
