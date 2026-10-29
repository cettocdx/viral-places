import { useMemo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import type { SourcePostDto } from '@viral-places/contracts';
import { appConfig } from '@/lib/config';
import { sourcePlayback } from '@/lib/source-playback';
import { FileVideo } from './file-video';

export interface CalloutVideoProps {
  post: SourcePostDto;
  width: number;
  height: number;
  radius: number;
  /** Omitted in the reels feed, where swiping is the way out. */
  onClose?: () => void;
  /** Clear of a screen's own top bar when the video fills a hero. */
  controlsTop?: number;
  /** Stored-file player only: lifts the creator credit above content that overlaps the frame. */
  creditBottom?: number;
  /** Reels keep the viewer's sound choice from video to video. */
  startMuted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  /** 'none': the host draws its own sound/pause controls. */
  controlsSide?: 'top' | 'none';
  /** false: mount and buffer (reels preload) without playing; only stored files preload. */
  playing?: boolean;
}

/** No stored file: the cover only. The platform's own player is never shown (owner, 29.10.2026). */
function PosterOnly({ post, width, height, radius }: CalloutVideoProps) {
  const poster = post.media.mode !== 'unavailable' ? post.media.thumbnailUrl : null;
  return (
    <View style={{ width, height, borderRadius: radius, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#000' }} testID="callout-video">
      {poster ? <Image source={{ uri: poster }} contentFit="cover" style={{ position: 'absolute', inset: 0 }} accessibilityIgnoresInvertColors /> : null}
    </View>
  );
}

/**
 * Stored file only (ADR-023, owner 29.10.2026): cached, preloadable, no platform UI, creator credited on screen.
 */
export function CalloutVideo(props: CalloutVideoProps) {
  const allowLocalHttp = __DEV__ && appConfig.dataMode === 'demo';
  const playback = useMemo(() => sourcePlayback(props.post, { allowLocalHttp, preferFile: true }), [props.post, allowLocalHttp]);
  if (playback.kind === 'video') return <FileVideo {...props} url={playback.url} />;
  return <PosterOnly {...props} />;
}
