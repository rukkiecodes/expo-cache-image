/**
 * `CachedImage` — a drop-in replacement for React Native's `<Image>` that
 * transparently caches remote images to the device filesystem on first load
 * and serves them from disk on every subsequent render.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageProps,
  ImageSourcePropType,
  ImageURISource,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { cacheImage, getCachedUri } from './cache';

export interface CachedImageProps extends Omit<ImageProps, 'source'> {
  /**
   * The image source. Pass a remote URL as a string or `{ uri }` object to
   * enable caching. Local sources (numbers from `require(...)`) are rendered
   * as-is.
   */
  source: string | ImageSourcePropType;
  /**
   * Optional element shown while the image is being downloaded for the first
   * time. Defaults to a centered `ActivityIndicator`. Pass `null` to disable.
   */
  placeholder?: React.ReactElement | null;
  /**
   * Optional element shown if the image fails to load/download. Receives no
   * props. Defaults to nothing.
   */
  fallback?: React.ReactElement | null;
  /** Called with the resolved local file URI once the image is cached. */
  onCached?: (localUri: string) => void;
  /** Called if downloading/caching the image fails. */
  onCacheError?: (error: unknown) => void;
}

function extractRemoteUri(
  source: CachedImageProps['source']
): { remote: string | null; passthrough: ImageSourcePropType } {
  if (typeof source === 'string') {
    return { remote: source, passthrough: { uri: source } };
  }
  if (
    source &&
    typeof source === 'object' &&
    !Array.isArray(source) &&
    typeof (source as ImageURISource).uri === 'string'
  ) {
    const uri = (source as ImageURISource).uri as string;
    return { remote: uri, passthrough: source };
  }
  // Local require() asset or anything we don't manage — render directly.
  return { remote: null, passthrough: source as ImageSourcePropType };
}

export function CachedImage(props: CachedImageProps) {
  const {
    source,
    placeholder,
    fallback,
    onCached,
    onCacheError,
    style,
    ...imageProps
  } = props;

  const { remote, passthrough } = extractRemoteUri(source);
  const isRemote = !!remote && /^https?:\/\//i.test(remote);

  // For non-remote sources we render immediately with no loading state.
  const [localUri, setLocalUri] = useState<string | null>(
    isRemote ? null : null
  );
  const [loading, setLoading] = useState<boolean>(isRemote);
  const [failed, setFailed] = useState<boolean>(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!isRemote || !remote) {
      setLocalUri(null);
      setLoading(false);
      setFailed(false);
      return;
    }

    setFailed(false);

    (async () => {
      // Fast path: serve straight from disk if we already have it.
      const cached = await getCachedUri(remote).catch(() => null);
      if (!active || !mounted.current) return;
      if (cached) {
        setLocalUri(cached);
        setLoading(false);
        onCached?.(cached);
        return;
      }

      setLoading(true);
      try {
        const uri = await cacheImage(remote);
        if (!active || !mounted.current) return;
        setLocalUri(uri);
        onCached?.(uri);
      } catch (err) {
        if (!active || !mounted.current) return;
        setFailed(true);
        onCacheError?.(err);
      } finally {
        if (active && mounted.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
    // We intentionally key the effect on the remote URL only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, isRemote]);

  // Non-remote source: behave exactly like <Image>.
  if (!isRemote) {
    return <Image {...imageProps} style={style} source={passthrough} />;
  }

  if (failed) {
    if (fallback !== undefined) {
      return fallback;
    }
    return <View style={[styles.center, style as ViewStyle]} />;
  }

  if (loading && !localUri) {
    if (placeholder === null) {
      return <View style={[styles.center, style as ViewStyle]} />;
    }
    if (placeholder !== undefined) {
      return (
        <View style={[styles.center, style as ViewStyle]}>{placeholder}</View>
      );
    }
    return (
      <View style={[styles.center, style as ViewStyle]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Image
      {...imageProps}
      style={style}
      source={localUri ? { uri: localUri } : passthrough}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CachedImage;
