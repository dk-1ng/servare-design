import type { Scenario } from './scenarios.ts';
import { canTransition, isTerminal } from './transitions.ts';
import {
  MessagingError,
  type DownloadJob,
  type EnqueuePayload,
  type EventMap,
  type EventName,
  type HistoryEntry,
  type JobStatus,
  type MediaItem,
  type RequestMap,
  type RequestName,
} from './types.ts';

type Emit = <K extends EventName>(name: K, payload: EventMap[K]) => void;
type Handlers = { [K in RequestName]: (payload: RequestMap[K][0]) => RequestMap[K][1] };

export interface BackendOptions {
  /** Simulated download speed. */
  bytesPerSecond?: number;
  /** Minimum time between two `job/updated` events of a running job (contract §3.3). */
  progressThrottleMs?: number;
}

const DEFAULT_SIZE = 80_000_000;

/** The mock of servare's background: state, §3.1 rules and request handlers. Time only moves in `step`. */
export class Backend {
  readonly jobs = new Map<string, DownloadJob>();
  private readonly scenario: Scenario;
  private readonly emit: Emit;
  private readonly bytesPerSecond: number;
  private readonly throttleMs: number;
  private readonly lastEmit = new Map<string, number>();
  private readonly failedMedia = new Set<string>();
  private history: HistoryEntry[];
  private nextJob = 1;
  private clock = 0;

  constructor(scenario: Scenario, emit: Emit, options: BackendOptions = {}) {
    this.scenario = scenario;
    this.emit = emit;
    this.history = [...scenario.history];
    this.bytesPerSecond = options.bytesPerSecond ?? 12_000_000;
    this.throttleMs = options.progressThrottleMs ?? 500;
    for (const job of scenario.jobs) this.jobs.set(job.id, structuredClone(job));
  }

  get media(): readonly MediaItem[] {
    return this.scenario.media;
  }

  readonly handlers: Handlers = {
    'media/list': ({ tabId }) => this.scenario.media.filter((m) => m.tabId === tabId),
    'media/scan': () => this.scenario.scan,
    'download/enqueue': (p) => this.enqueue(p),
    'download/pause': ({ jobId }) => this.control(jobId, 'pause'),
    'download/resume': ({ jobId }) => this.control(jobId, 'resume'),
    'download/cancel': ({ jobId }) => this.control(jobId, 'cancel'),
    'download/stop': ({ jobId }) => this.control(jobId, 'stop'),
    'download/list': () => [...this.jobs.values()].map((j) => structuredClone(j)),
    'download/retry': ({ jobId }) => this.retry(jobId),
    'download/remove': ({ jobId }) => this.remove(jobId),
    'history/list': ({ limit }) =>
      limit === undefined ? this.history : this.history.slice(0, limit),
    'history/remove': ({ entryId }) =>
      this.setHistory(this.history.filter((e) => e.id !== entryId)),
    'history/clear': () => this.setHistory([]),
  };

  /** Advances simulated time and runs the job lifecycle. */
  step(dtMs: number): void {
    this.clock += dtMs;
    for (const job of this.jobs.values()) {
      if (job.status === 'queued') this.advanceQueued(job);
      else if (job.status === 'running') this.advanceRunning(job, dtMs);
    }
  }

  private enqueue(p: EnqueuePayload): DownloadJob {
    const media = this.scenario.media.find((m) => m.id === p.mediaId);
    if (!media) throw new MessagingError('handler-failed', `Unknown media ${p.mediaId}`);
    if (media.protected)
      throw new MessagingError('handler-failed', 'Protected media cannot be downloaded');
    if (p.variantId !== undefined && !media.variants.some((v) => v.id === p.variantId)) {
      throw new MessagingError('handler-failed', `Unknown variant ${p.variantId}`);
    }
    const audioTrackIds = p.audioTrackIds ?? [];
    const subtitleIds = p.subtitleIds ?? [];
    if (
      audioTrackIds.some((id) => !media.audioTracks.some((t) => t.id === id)) ||
      subtitleIds.some((id) => !media.subtitles.some((t) => t.id === id))
    ) {
      throw new MessagingError('handler-failed', 'Unknown track');
    }
    const mode = p.mode ?? 'video';
    const job: DownloadJob = {
      id: `j_${String(this.nextJob++)}`,
      mediaId: media.id,
      ...(mode === 'video' && p.variantId !== undefined ? { variantId: p.variantId } : {}),
      audioTrackIds,
      subtitleIds: mode === 'audio' ? [] : subtitleIds,
      mode,
      status: 'queued',
      progress: media.duration === 'live' ? 'indeterminate' : 0,
      bytesWritten: 0,
      outputName: outputName(media, mode, p.outputName),
    };
    this.jobs.set(job.id, job);
    this.publish(job);
    return structuredClone(job);
  }

  private control(jobId: string, action: 'pause' | 'resume' | 'cancel' | 'stop'): null {
    const job = this.jobs.get(jobId);
    if (!job) {
      if (action === 'cancel') return null;
      throw new MessagingError('handler-failed', `Unknown job ${jobId}`);
    }
    const fail = (): never => {
      throw new MessagingError('handler-failed', `Cannot ${action} a ${job.status} job`);
    };
    switch (action) {
      case 'pause':
        if (job.status === 'paused') return null;
        if (job.status !== 'running') return fail();
        this.move(job, 'paused');
        break;
      case 'resume':
        if (job.status === 'queued' || job.status === 'running') return null;
        if (job.status !== 'paused') return fail();
        this.move(job, 'queued');
        break;
      case 'cancel':
        if (isTerminal(job.status)) return null;
        this.move(job, 'cancelled', { error: { kind: 'cancelled' } });
        break;
      case 'stop': {
        const live = this.scenario.media.find((m) => m.id === job.mediaId)?.duration === 'live';
        if (!live || (job.status !== 'running' && job.status !== 'paused')) return fail();
        this.move(job, 'done');
        this.record(job);
        break;
      }
    }
    return null;
  }

  private retry(jobId: string): DownloadJob {
    const old = this.jobs.get(jobId);
    if (old?.status !== 'failed')
      throw new MessagingError('handler-failed', 'Only failed jobs can be retried');
    return this.enqueue({
      mediaId: old.mediaId,
      ...(old.variantId === undefined ? {} : { variantId: old.variantId }),
      audioTrackIds: old.audioTrackIds,
      subtitleIds: old.subtitleIds,
      mode: old.mode,
      outputName: old.outputName,
    });
  }

  private remove(jobId: string): null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    if (!isTerminal(job.status))
      throw new MessagingError('handler-failed', 'Only finished jobs can be removed');
    this.jobs.delete(jobId);
    this.lastEmit.delete(jobId);
    this.emit('job/removed', { jobId });
    return null;
  }

  private setHistory(entries: HistoryEntry[]): null {
    this.history = entries;
    this.emit('history/updated', { entries });
    return null;
  }

  private advanceQueued(job: DownloadJob): void {
    const blocker = this.scenario.headerConflict
      ? [...this.jobs.values()].find(
          (j) => j.id !== job.id && j.status === 'running' && this.isLive(j),
        )
      : undefined;
    if (blocker) {
      if (job.waiting?.blockingJobId !== blocker.id) {
        job.waiting = { reason: 'header-conflict', blockingJobId: blocker.id };
        this.publish(job);
      }
      return;
    }
    this.move(job, 'running');
  }

  private advanceRunning(job: DownloadJob, dtMs: number): void {
    job.bytesWritten += Math.round((this.bytesPerSecond * dtMs) / 1000);
    if (this.isLive(job)) {
      this.publishThrottled(job);
      return;
    }
    job.progress = Math.min(1, job.bytesWritten / this.totalBytes(job));
    const failure = this.scenario.failure;
    if (failure && job.progress >= failure.at && !this.failedMedia.has(job.mediaId)) {
      this.failedMedia.add(job.mediaId);
      this.move(job, 'failed', { error: failure.error });
      this.record(job);
      return;
    }
    if (job.progress >= 1) {
      this.move(job, 'done');
      this.record(job);
    } else {
      this.publishThrottled(job);
    }
  }

  /** The only place a status changes; it refuses anything outside contract §3.1. */
  private move(job: DownloadJob, to: JobStatus, patch: Partial<DownloadJob> = {}): void {
    if (!canTransition(job.status, to)) {
      throw new Error(`Transition ${job.status} → ${to} is not in contract §3.1`);
    }
    job.status = to;
    delete job.waiting;
    Object.assign(job, patch);
    this.publish(job);
  }

  private publish(job: DownloadJob): void {
    this.lastEmit.set(job.id, this.clock);
    this.emit('job/updated', { job: structuredClone(job) });
  }

  private publishThrottled(job: DownloadJob): void {
    if (this.clock - (this.lastEmit.get(job.id) ?? -Infinity) >= this.throttleMs) this.publish(job);
  }

  private record(job: DownloadJob): void {
    if (job.status !== 'done' && job.status !== 'failed') return;
    const media = this.scenario.media.find((m) => m.id === job.mediaId);
    if (!media) return;
    this.setHistory([
      {
        id: `h_${job.id}`,
        title: media.title,
        pageUrl: media.pageUrl,
        outputName: job.outputName,
        kind: media.kind,
        completedAt: Date.now(),
        bytes: job.bytesWritten,
        status: job.status,
      },
      ...this.history,
    ]);
  }

  private isLive(job: DownloadJob): boolean {
    return this.scenario.media.find((m) => m.id === job.mediaId)?.duration === 'live';
  }

  private totalBytes(job: DownloadJob): number {
    const media = this.scenario.media.find((m) => m.id === job.mediaId);
    if (!media || typeof media.duration !== 'number' || media.duration === 0) return DEFAULT_SIZE;
    const variant = media.variants.find((v) => v.id === job.variantId) ?? media.variants[0];
    const bandwidth = variant?.bandwidth ?? 2_000_000;
    return job.mode === 'audio' ? (media.duration * 128_000) / 8 : (media.duration * bandwidth) / 8;
  }
}

function outputName(
  media: MediaItem,
  mode: 'video' | 'audio',
  requested: string | undefined,
): string {
  const ext = mode === 'audio' ? 'mp3' : 'mp4';
  const stem = (requested ?? (media.title || `media-${media.id.replace(/^m_/, '')}`))
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\.(mp4|mp3)$/i, '');
  return `${stem.slice(0, 250)}.${ext}`;
}
