import type { HistoryEntry, MediaItem, RulesDocument, Settings, Track, Variant } from '../types.ts';

export const TAB_ID = 42;
const PAGE = 'https://example.com/watch/123';
const NOW = 1761400000000;
export const MOCK_NOW = NOW;

/** Local stand-in for a page thumbnail: the prototype must not request anything remote. */
function thumbnail(hue: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90">` +
    `<rect width="160" height="90" fill="hsl(${String(hue)} 35% 45%)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function variant(id: string, height: number, bandwidth: number): Variant {
  return {
    id,
    width: Math.round((height * 16) / 9),
    height,
    bandwidth,
    codecs: 'avc1.4d401f,mp4a.40.2',
    container: 'mp4',
  };
}

/** The contract §2.1 JSON example. */
export const sampleHls: MediaItem = {
  id: 'm_7f3a',
  tabId: TAB_ID,
  kind: 'hls',
  url: 'https://cdn.example.com/v/master.m3u8',
  pageUrl: PAGE,
  title: 'Sample video',
  thumbnail: thumbnail(210),
  duration: 1834.2,
  variants: [
    { ...variant('v0', 1080, 5000000), codecs: 'avc1.640028,mp4a.40.2' },
    variant('v1', 720, 2800000),
  ],
  audioTracks: [{ id: 'a0', language: 'pt-BR', label: 'Português' }],
  subtitles: [{ id: 's0', language: 'en', label: 'English' }],
  protected: false,
  detectedAt: NOW,
};

/** No title, no thumbnail, unknown duration, a single unnamed file. */
export const bareDirect: MediaItem = {
  id: 'm_bare',
  tabId: TAB_ID,
  kind: 'direct',
  url: 'https://cdn.example.com/files/8c1d9e.mp4',
  pageUrl: PAGE,
  title: '',
  duration: 0,
  variants: [],
  audioTracks: [],
  subtitles: [],
  protected: false,
  detectedAt: NOW + 1000,
};

export const dashItem: MediaItem = {
  id: 'm_dash',
  tabId: TAB_ID,
  kind: 'dash',
  url: 'https://cdn.example.com/d/manifest.mpd',
  pageUrl: PAGE,
  title: 'A conference talk with a rather long title that will not fit on a single line',
  thumbnail: thumbnail(30),
  duration: 3605,
  variants: [
    variant('v0', 1080, 4200000),
    { id: 'v1', bandwidth: 1500000, container: 'mp4' },
    { id: 'v2', container: 'mp4' },
  ],
  audioTracks: [
    { id: 'a0', language: 'en', label: 'English' },
    { id: 'a1', language: 'pt-BR' },
    { id: 'a2' },
  ],
  subtitles: [
    { id: 's0', language: 'en', label: 'English' },
    { id: 's1', language: 'pt-BR', label: 'Português' },
  ],
  protected: false,
  detectedAt: NOW + 2000,
};

export const liveItem: MediaItem = {
  id: 'm_live',
  tabId: TAB_ID,
  kind: 'hls',
  url: 'https://live.example.com/stream/index.m3u8',
  pageUrl: 'https://example.com/live/news',
  title: 'Evening news (live)',
  thumbnail: thumbnail(350),
  duration: 'live',
  variants: [variant('v0', 720, 2800000), variant('v1', 480, 1200000)],
  audioTracks: [],
  subtitles: [],
  protected: false,
  detectedAt: NOW + 3000,
};

export const protectedItem: MediaItem = {
  id: 'm_drm',
  tabId: TAB_ID,
  kind: 'dash',
  url: 'https://cdn.example.com/p/manifest.mpd',
  pageUrl: PAGE,
  title: 'Streaming service episode',
  thumbnail: thumbnail(280),
  duration: 2700,
  variants: [variant('v0', 1080, 6000000)],
  audioTracks: [],
  subtitles: [],
  protected: true,
  detectedAt: NOW + 4000,
};

export const directWithTitle: MediaItem = {
  id: 'm_direct',
  tabId: TAB_ID,
  kind: 'direct',
  url: 'https://cdn.example.com/files/clip.mp4',
  pageUrl: PAGE,
  title: 'Short clip',
  thumbnail: thumbnail(120),
  duration: 95,
  variants: [],
  audioTracks: [],
  subtitles: [],
  protected: false,
  detectedAt: NOW + 5000,
};

/** Audio tracks the `many` scenario announces late through `tracks/updated` (contract §5). */
export const lateTracks: Track[] = [
  { id: 'a0', language: 'pt-BR', label: 'Português' },
  { id: 'a1', language: 'en', label: 'English' },
];

/** A larger mixed list: every kind, missing titles and thumbnails, `duration: 0`. */
export function manyItems(): MediaItem[] {
  const base = [sampleHls, bareDirect, dashItem, directWithTitle, liveItem];
  const extra = Array.from({ length: 7 }, (_, i): MediaItem => {
    const item: MediaItem = { ...directWithTitle };
    delete item.thumbnail;
    return {
      ...item,
      id: `m_extra${String(i)}`,
      url: `https://cdn.example.com/files/extra-${String(i)}.mp4`,
      title: i % 3 === 0 ? '' : `Extra video ${String(i + 1)}`,
      ...(i % 2 === 0 ? {} : { thumbnail: thumbnail(i * 40) }),
      duration: i % 3 === 0 ? 0 : 60 + i * 37,
      detectedAt: NOW + 6000 + i,
    };
  });
  return [...base, ...extra];
}

export function sampleHistory(): HistoryEntry[] {
  return [
    {
      id: 'h_1',
      title: 'Sample video',
      pageUrl: PAGE,
      outputName: 'Sample video.mp4',
      kind: 'hls',
      completedAt: NOW - 3_600_000,
      bytes: 183_500_800,
      status: 'done',
    },
    {
      id: 'h_2',
      title: '',
      pageUrl: 'https://example.org/clips',
      outputName: 'media-8c1d9e.mp4',
      kind: 'direct',
      completedAt: NOW - 86_400_000,
      bytes: 12_400_000,
      status: 'done',
    },
    {
      id: 'h_3',
      title: 'A conference talk',
      pageUrl: PAGE,
      outputName: 'A conference talk.mp4',
      kind: 'dash',
      completedAt: NOW - 172_800_000,
      bytes: 40_200_000,
      status: 'failed',
    },
  ];
}

/** Contract §4.4 defaults. */
export function defaultSettings(): Settings {
  return {
    nameTemplate: '{title}',
    subfolder: '',
    saveAs: false,
    speedProfile: 'standard',
    mp3Quality: 2,
    failureThreshold: 0.2,
    preferredLanguages: [],
  };
}

export function sampleSettings(): Settings {
  return {
    ...defaultSettings(),
    nameTemplate: '{title} - {host}',
    subfolder: 'Videos',
    preferredLanguages: ['pt-BR', 'en'],
  };
}

export function sampleRules(): RulesDocument {
  return {
    version: 1,
    domains: {
      'example.com': { speedProfile: 'economy', detection: false },
      'video.example.com': { audioOnly: true },
      'cdn.example.org': {},
      'news.example.net': {
        minDirectSize: 524_288,
        feedMode: true,
        hideFragments: true,
        propagateQuery: false,
      },
    },
  };
}
