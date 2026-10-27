import type { SourcePostDto } from '@viral-places/contracts';
import { validateSocialUrl } from './validate-social-url';

export type SourcePlayback =
  | { kind: 'video'; url: string }
  | { kind: 'embed'; url: string; platform: SourcePostDto['platform'] }
  | { kind: 'link'; url: string }
  | { kind: 'unavailable'; reason: 'rights' | 'expired' | 'missing' };

function safeMediaUrl(value: string | null | undefined, allowLocalHttp: boolean): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hostname.endsWith('.invalid')) return null;
    if (allowLocalHttp && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)) return url.href;
    if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

/** Only the published render decision can authorize playback; an available file URL cannot. */
export function sourcePlayback(post: SourcePostDto, { now = Date.now(), allowLocalHttp = false }: { now?: number; allowLocalHttp?: boolean } = {}): SourcePlayback {
  const media = post.media;
  if (post.linkResolution !== 'approved' || media.mode === 'unavailable') return { kind: 'unavailable', reason: 'rights' };
  if (media.expiresAt && Date.parse(media.expiresAt) <= now) return { kind: 'unavailable', reason: 'expired' };

  if (media.mode === 'licensed_native') {
    const url = safeMediaUrl(media.videoUrl, allowLocalHttp);
    if (url) return { kind: 'video', url };
  }
  if (media.mode === 'official_embed' && media.embedUrl) {
    try {
      const url = new URL(media.embedUrl);
      if (url.protocol === 'https:' && !url.username && !url.password) {
        if (post.platform === 'tiktok' && ['www.tiktok.com', 'tiktok.com'].includes(url.hostname)) {
          const match = url.pathname.match(/^\/(?:embed\/v2|embed|player\/v1)\/(\d+)\/?$/);
          if (match) {
            // Official Embed Player: keep playback controls, attribution and descriptions visible.
            return { kind: 'embed', platform: 'tiktok', url: `https://www.tiktok.com/player/v1/${match[1]}?autoplay=0&controls=1&description=1&music_info=1` };
          }
        }
        if (post.platform === 'instagram' && ['www.instagram.com', 'instagram.com'].includes(url.hostname) && /^\/(?:p|reel)\/[A-Za-z0-9_-]+\/embed\/?$/.test(url.pathname)) {
          return { kind: 'embed', platform: 'instagram', url: url.href };
        }
      }
    } catch { /* An invalid embed can still offer its separately permitted source link. */ }
  }
  if (media.sourceUrl && validateSocialUrl(media.sourceUrl) === 'valid') return { kind: 'link', url: media.sourceUrl };
  return { kind: 'unavailable', reason: 'missing' };
}

const scriptValue = (value: string | null) => JSON.stringify(value).replace(/</g, '\\u003c');

/** A host page, never code injected into or used to crop the platform's player. */
export function sourcePlayerHtml(playback: Extract<SourcePlayback, { kind: 'video' | 'embed' }>, poster: string | null): string {
  const head = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}video,iframe{display:block;width:100%;height:100%;border:0;object-fit:contain}</style></head><body>';
  const send = "function send(type){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:type}));}";
  if (playback.kind === 'video') {
    return `${head}<video id="v" controls playsinline autoplay muted preload="metadata"></video><script>${send}var v=document.getElementById('v');v.muted=true;v.src=${scriptValue(playback.url)};var poster=${scriptValue(poster)};if(poster)v.poster=poster;v.addEventListener('loadeddata',function(){send('ready')});v.addEventListener('playing',function(){send('playing')});v.addEventListener('error',function(){send('error')});v.play().catch(function(){send('ready')});</script></body></html>`;
  }
  return `${head}<iframe id="p" title="Source video" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe><script>${send}var p=document.getElementById('p');p.src=${scriptValue(playback.url)};window.addEventListener('message',function(event){if(event.origin!==${scriptValue(new URL(playback.url).origin)})return;var data=event.data;try{if(typeof data==='string')data=JSON.parse(data)}catch(e){return}if(!data||!data['x-tiktok-player'])return;if(data.type==='onPlayerReady'){p.contentWindow.postMessage({type:'mute','x-tiktok-player':true},event.origin);p.contentWindow.postMessage({type:'play','x-tiktok-player':true},event.origin);send('ready')}if(data.type==='onStateChange'&&data.value===1)send('playing');if(data.type==='onPlayerError')send('error')});</script></body></html>`;
}
