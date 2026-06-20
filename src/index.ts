/**
 * expo-cache-image
 *
 * Cache remote images to the device filesystem in Expo / React Native apps.
 * Each URL is downloaded once and served from local storage thereafter.
 */
export { CachedImage, default } from './CachedImage';
export type { CachedImageProps } from './CachedImage';

export {
  cacheImage,
  prefetch,
  getCachedUri,
  isCached,
  removeCachedImage,
  clearCache,
  getCacheSize,
  localUriForRemote,
} from './cache';

export { cacheKeyForUri } from './hash';
