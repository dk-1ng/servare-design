// Hand-written mirrors of servare `src/messaging/schemas.ts` and `protocol.ts`, taken from
// references/ui-contract.md §1–§5. When the contract changes, change this file with it.

export type MediaKind = 'direct' | 'hls' | 'dash';

export interface Variant {
  id: string;
  width?: number;
  height?: number;
  bandwidth?: number;
  codecs?: string;
  container: string;
}

export interface Track {
  id: string;
  /** BCP 47 tag when the source gives one. */
  language?: string;
  label?: string;
  codecs?: string;
}

export interface MediaItem {
  id: string;
  tabId: number;
  kind: MediaKind;
  url: string;
  pageUrl: string;
  /** May be empty. */
  title: string;
  thumbnail?: string;
  /** Seconds. `0` = unknown, `'live'` = HLS live. */
  duration: number | 'live';
  variants: Variant[];
  audioTracks: Track[];
  subtitles: Track[];
  protected: boolean;
  /** ms since epoch. */
  detectedAt: number;
}

export type JobStatus = 'queued' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled';
export type JobMode = 'video' | 'audio';

export type DownloadError =
  | { kind: 'cancelled' }
  | { kind: 'http'; status: number }
  | { kind: 'incomplete'; ratio: number }
  | { kind: 'decrypt' }
  | { kind: 'quota' }
  | { kind: 'protected' }
  | { kind: 'unknown'; message: string };

export interface JobWaiting {
  reason: 'header-conflict';
  blockingJobId?: string;
}

export interface DownloadJob {
  id: string;
  mediaId: string;
  variantId?: string;
  audioTrackIds: string[];
  subtitleIds: string[];
  mode: JobMode;
  status: JobStatus;
  progress: number | 'indeterminate';
  bytesWritten: number;
  error?: DownloadError;
  outputName: string;
  /** Only on `queued`. */
  waiting?: JobWaiting;
}

export interface HistoryEntry {
  id: string;
  title: string;
  pageUrl: string;
  outputName: string;
  kind: MediaKind;
  /** ms since epoch. */
  completedAt: number;
  bytes: number;
  status: 'done' | 'failed';
}

export type MessagingErrorCode =
  | 'invalid-message'
  | 'unknown-request'
  | 'invalid-payload'
  | 'invalid-response'
  | 'handler-failed'
  | 'disconnected'
  | 'timeout';

export class MessagingError extends Error {
  readonly code: MessagingErrorCode;

  constructor(code: MessagingErrorCode, message: string = code) {
    super(message);
    this.name = 'MessagingError';
    this.code = code;
  }
}

export interface EnqueuePayload {
  mediaId: string;
  variantId?: string;
  audioTrackIds?: string[];
  subtitleIds?: string[];
  mode?: JobMode;
  outputName?: string;
}

/** Request name → `[payload, response]` (contract §4). */
export interface RequestMap {
  'media/list': [{ tabId: number }, MediaItem[]];
  'media/scan': [{ tabId: number }, { found: number; blobOnly: boolean }];
  'download/enqueue': [EnqueuePayload, DownloadJob];
  'download/pause': [{ jobId: string }, null];
  'download/resume': [{ jobId: string }, null];
  'download/cancel': [{ jobId: string }, null];
  'download/list': [Record<string, never>, DownloadJob[]];
  'download/retry': [{ jobId: string }, DownloadJob];
  'download/remove': [{ jobId: string }, null];
  'download/stop': [{ jobId: string }, null];
  'history/list': [{ limit?: number }, HistoryEntry[]];
  'history/remove': [{ entryId: string }, null];
  'history/clear': [Record<string, never>, null];
}

export type RequestName = keyof RequestMap;

/** Event name → payload (contract §5). Only the events the UI of M1–M4 uses. */
export interface EventMap {
  'media/updated': { tabId: number; items: MediaItem[] };
  'tracks/updated': { mediaId: string; audioTracks: Track[] };
  'job/updated': { job: DownloadJob };
  'job/removed': { jobId: string };
  'history/updated': { entries: HistoryEntry[] };
}

export type EventName = keyof EventMap;
export type Unsubscribe = () => void;

/** The surface components use. servare's `PortClient` has the same shape. */
export interface Client {
  request<K extends RequestName>(name: K, payload: RequestMap[K][0]): Promise<RequestMap[K][1]>;
  on<K extends EventName>(name: K, handler: (payload: EventMap[K]) => void): Unsubscribe;
  onReconnect(handler: () => void): Unsubscribe;
}
