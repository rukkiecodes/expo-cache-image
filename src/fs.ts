/**
 * Thin compatibility layer over `expo-file-system`.
 *
 * Expo SDK 53 and below expose a function-based API directly from
 * `expo-file-system` (`downloadAsync`, `getInfoAsync`, `cacheDirectory`, ...).
 * SDK 54+ promote a new class-based API (`File`, `Directory`, `Paths`) and move
 * the function-based one to `expo-file-system/legacy`.
 *
 * This module detects whichever API is present at runtime and normalises both
 * down to the small set of primitives this package needs, so consumers work on
 * any reasonably recent Expo SDK without changing their imports.
 */
import * as FileSystem from 'expo-file-system';

export interface FileInfo {
  exists: boolean;
  uri: string;
  size: number;
}

interface FsAdapter {
  /** Absolute path (with trailing slash) of the app's cache directory. */
  cacheDirectory: string;
  ensureDir(dirUri: string): Promise<void>;
  getInfo(fileUri: string): Promise<FileInfo>;
  download(remoteUri: string, fileUri: string): Promise<string>;
  delete(fileUri: string): Promise<void>;
  readDir(dirUri: string): Promise<string[]>;
}

// `any` casts are deliberate: we are bridging two structurally different
// versions of the same module that cannot both be described by one type.
const FS = FileSystem as any;

function createLegacyAdapter(): FsAdapter {
  return {
    cacheDirectory: FS.cacheDirectory as string,
    async ensureDir(dirUri: string) {
      const info = await FS.getInfoAsync(dirUri);
      if (!info.exists) {
        await FS.makeDirectoryAsync(dirUri, { intermediates: true });
      }
    },
    async getInfo(fileUri: string): Promise<FileInfo> {
      const info = await FS.getInfoAsync(fileUri, { size: true });
      return {
        exists: !!info.exists,
        uri: info.uri ?? fileUri,
        size: info.size ?? 0,
      };
    },
    async download(remoteUri: string, fileUri: string) {
      const { uri } = await FS.downloadAsync(remoteUri, fileUri);
      return uri as string;
    },
    async delete(fileUri: string) {
      await FS.deleteAsync(fileUri, { idempotent: true });
    },
    async readDir(dirUri: string) {
      try {
        return (await FS.readDirectoryAsync(dirUri)) as string[];
      } catch {
        return [];
      }
    },
  };
}

function createNextAdapter(): FsAdapter {
  const { File, Directory, Paths } = FS;
  const cacheRoot: string = Paths.cache.uri.endsWith('/')
    ? Paths.cache.uri
    : `${Paths.cache.uri}/`;

  return {
    cacheDirectory: cacheRoot,
    async ensureDir(dirUri: string) {
      const dir = new Directory(dirUri);
      if (!dir.exists) {
        dir.create({ intermediates: true });
      }
    },
    async getInfo(fileUri: string): Promise<FileInfo> {
      const file = new File(fileUri);
      const exists = !!file.exists;
      return {
        exists,
        uri: fileUri,
        size: exists ? file.size ?? 0 : 0,
      };
    },
    async download(remoteUri: string, fileUri: string) {
      const dest = new File(fileUri);
      // The new API downloads to a destination File/Directory.
      const out = await File.downloadFileAsync(remoteUri, dest);
      return (out?.uri as string) ?? fileUri;
    },
    async delete(fileUri: string) {
      const file = new File(fileUri);
      if (file.exists) {
        file.delete();
      }
    },
    async readDir(dirUri: string) {
      try {
        const dir = new Directory(dirUri);
        if (!dir.exists) return [];
        return dir
          .list()
          .map((entry: any) => entry.name as string)
          .filter(Boolean);
      } catch {
        return [];
      }
    },
  };
}

function resolveAdapter(): FsAdapter {
  if (typeof FS.downloadAsync === 'function' && FS.cacheDirectory) {
    return createLegacyAdapter();
  }
  if (FS.File && FS.Directory && FS.Paths) {
    return createNextAdapter();
  }
  throw new Error(
    "[expo-cache-image] Could not find a usable 'expo-file-system' API. " +
      'Make sure expo-file-system is installed. On SDK 54+ you may need to ' +
      "import the legacy API; see this package's README for details."
  );
}

let cached: FsAdapter | null = null;

/** Lazily resolves (and memoises) the filesystem adapter for the current SDK. */
export function fs(): FsAdapter {
  if (!cached) {
    cached = resolveAdapter();
  }
  return cached;
}
