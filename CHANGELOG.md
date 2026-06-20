# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.2] - 2026-06-20

### Changed
- Include `CHANGELOG.md` in the published package.

## [2.0.1] - 2026-06-20

### Added
- Usage example illustration in the README (`assets/usage-example.png`, with an
  editable `assets/usage-example.svg` source).

### Changed
- Include the `assets/` directory in the published package so the README usage
  example resolves on the npm package page.

## [2.0.0] - 2026-06-20

Initial release of the rewritten package.

### Added
- `CachedImage` — a drop-in replacement for React Native's `<Image>` that
  downloads remote images once, stores them on the device filesystem, and
  serves them from the local cache on every subsequent load.
  - Supports string URLs, `{ uri }` objects, and local `require(...)` assets
    (local assets render directly without caching).
  - `placeholder`, `fallback`, `onCached`, and `onCacheError` props.
- Imperative caching API:
  - `cacheImage(url)` — ensure an image is cached, resolving with its local URI.
  - `prefetch(url | url[])` — pre-download one or many images.
  - `getCachedUri(url)` — resolve the local URI if cached, else `null`.
  - `isCached(url)` — check whether an image is cached.
  - `removeCachedImage(url)` — delete a single cached image.
  - `clearCache()` — remove every image cached by this package.
  - `getCacheSize()` — total size of the cache in bytes.
  - `localUriForRemote(url)` / `cacheKeyForUri(url)` — deterministic path helpers.
- Cross-SDK `expo-file-system` adapter that auto-detects the legacy function
  API (Expo SDK ≤ 53) and the new class-based `File`/`Directory`/`Paths` API
  (SDK 54+) at runtime.
- Concurrent-download deduplication and cleanup of partial files on failure.
- Dependency-free FNV-1a URL hashing (no `expo-crypto` peer dependency).
- TypeScript sources compiled to JS with bundled type declarations.

[Unreleased]: https://github.com/rukkiecodes/expo-cache-image/compare/v2.0.2...HEAD
[2.0.2]: https://github.com/rukkiecodes/expo-cache-image/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/rukkiecodes/expo-cache-image/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/rukkiecodes/expo-cache-image/releases/tag/v2.0.0
