import { expect, test } from '@playwright/test';
import { Backend } from '../prototype/src/mock/backend.ts';
import { MockClient } from '../prototype/src/mock/client.ts';
import { scenarioFromUrl } from '../prototype/src/mock/index.ts';
import { SCENARIO_NAMES, buildScenario } from '../prototype/src/mock/scenarios.ts';
import { TRANSITIONS, canTransition } from '../prototype/src/mock/transitions.ts';
import {
  MessagingError,
  type DownloadJob,
  type JobStatus,
  type MessagingErrorCode,
} from '../prototype/src/mock/types.ts';

// Pure logic: no browser needed, so these specs do not use the `page` fixture.
const STATUSES: JobStatus[] = ['queued', 'running', 'paused', 'done', 'failed', 'cancelled'];

function client(scenario: (typeof SCENARIO_NAMES)[number]): MockClient {
  return new MockClient({ scenario, latencyMs: 0, autoRun: false });
}

async function code(promise: Promise<unknown>): Promise<MessagingErrorCode | 'ok'> {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    if (error instanceof MessagingError) return error.code;
    throw error;
  }
}

function recordJobs(c: MockClient): DownloadJob[] {
  const seen: DownloadJob[] = [];
  c.on('job/updated', ({ job }) => seen.push(job));
  return seen;
}

test.describe('transition table (contract §3.1)', () => {
  const allowed = [
    'queued>running',
    'queued>cancelled',
    'running>paused',
    'running>done',
    'running>failed',
    'running>queued',
    'running>cancelled',
    'paused>queued',
    'paused>done',
    'paused>cancelled',
  ];

  test('allows exactly the rows of the contract and nothing else', () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        expect(canTransition(from, to), `${from} → ${to}`).toBe(allowed.includes(`${from}>${to}`));
      }
    }
  });

  test('terminal states never change again', () => {
    for (const status of ['done', 'failed', 'cancelled'] as const) {
      expect(TRANSITIONS[status]).toEqual([]);
    }
  });
});

test.describe('job lifecycle', () => {
  test('enqueue → queued → running → done, with throttled bytesWritten', async () => {
    const c = client('many');
    const seen = recordJobs(c);
    const job = await c.request('download/enqueue', { mediaId: 'm_direct' });
    expect(job.status).toBe('queued');
    for (let i = 0; i < 400; i++) c.advance(100);
    const statuses = seen.map((j) => j.status);
    expect(statuses[0]).toBe('queued');
    expect(statuses[1]).toBe('running');
    expect(statuses.at(-1)).toBe('done');
    expect(statuses.filter((s) => s === 'done')).toHaveLength(1);
    const bytes = seen.map((j) => j.bytesWritten);
    expect(bytes).toEqual([...bytes].sort((a, b) => a - b));
    // 100 ms ticks, 500 ms throttle: far fewer events than ticks.
    expect(seen.length).toBeLessThan(40);
  });

  test('every emitted status change is allowed by §3.1', async () => {
    const c = client('many');
    const last = new Map<string, JobStatus>();
    c.on('job/updated', ({ job }) => {
      const before = last.get(job.id);
      if (before !== undefined && before !== job.status) {
        expect(canTransition(before, job.status), `${before} → ${job.status}`).toBe(true);
      }
      last.set(job.id, job.status);
    });
    const a = await c.request('download/enqueue', { mediaId: 'm_direct' });
    const b = await c.request('download/enqueue', { mediaId: 'm_bare' });
    c.advance(1000);
    await c.request('download/pause', { jobId: a.id });
    await c.request('download/resume', { jobId: a.id });
    await c.request('download/cancel', { jobId: b.id });
    for (let i = 0; i < 400; i++) c.advance(100);
    expect(last.get(a.id)).toBe('done');
    expect(last.get(b.id)).toBe('cancelled');
  });

  test('pause, resume and cancel follow the rules; no-ops succeed', async () => {
    const c = client('many');
    const job = await c.request('download/enqueue', { mediaId: 'm_direct' });
    c.advance(1000);
    await c.request('download/pause', { jobId: job.id });
    await c.request('download/pause', { jobId: job.id });
    const paused = (await c.request('download/list', {})).find((j) => j.id === job.id);
    expect(paused?.status).toBe('paused');
    await c.request('download/resume', { jobId: job.id });
    await c.request('download/cancel', { jobId: job.id });
    await c.request('download/cancel', { jobId: job.id });
    await c.request('download/cancel', { jobId: 'j_unknown' });
    const cancelled = (await c.request('download/list', {})).find((j) => j.id === job.id);
    expect(cancelled).toMatchObject({ status: 'cancelled', error: { kind: 'cancelled' } });
  });

  test('pause and resume on an impossible status fail with handler-failed', async () => {
    const c = client('many');
    const job = await c.request('download/enqueue', { mediaId: 'm_direct' });
    await c.request('download/cancel', { jobId: job.id });
    expect(await code(c.request('download/pause', { jobId: job.id }))).toBe('handler-failed');
    expect(await code(c.request('download/resume', { jobId: job.id }))).toBe('handler-failed');
    expect(await code(c.request('download/pause', { jobId: 'j_unknown' }))).toBe('handler-failed');
  });

  test('retry makes a new job from a failed one; remove only takes finished jobs', async () => {
    const c = client('http-403');
    const job = await c.request('download/enqueue', { mediaId: 'm_7f3a' });
    expect(await code(c.request('download/retry', { jobId: job.id }))).toBe('handler-failed');
    expect(await code(c.request('download/remove', { jobId: job.id }))).toBe('handler-failed');
    for (let i = 0; i < 2000; i++) c.advance(100);
    const failed = (await c.request('download/list', {})).find((j) => j.id === job.id);
    expect(failed).toMatchObject({ status: 'failed', error: { kind: 'http', status: 403 } });
    const again = await c.request('download/retry', { jobId: job.id });
    expect(again.id).not.toBe(job.id);
    expect(again.mediaId).toBe(job.mediaId);
    const removed: string[] = [];
    c.on('job/removed', ({ jobId }) => removed.push(jobId));
    await c.request('download/remove', { jobId: job.id });
    expect(removed).toEqual([job.id]);
  });

  test('a live job stays indeterminate until stop delivers it as done', async () => {
    const c = client('live');
    const job = await c.request('download/enqueue', { mediaId: 'm_live' });
    for (let i = 0; i < 100; i++) c.advance(100);
    let current = (await c.request('download/list', {}))[0];
    expect(current).toMatchObject({ status: 'running', progress: 'indeterminate' });
    expect(current?.bytesWritten).toBeGreaterThan(0);
    await c.request('download/stop', { jobId: job.id });
    current = (await c.request('download/list', {}))[0];
    expect(current?.status).toBe('done');
    expect(await code(c.request('download/stop', { jobId: job.id }))).toBe('handler-failed');
  });

  test('stop is refused for media that is not live', async () => {
    const c = client('many');
    const job = await c.request('download/enqueue', { mediaId: 'm_direct' });
    c.advance(500);
    expect(await code(c.request('download/stop', { jobId: job.id }))).toBe('handler-failed');
  });
});

test.describe('enqueue validation', () => {
  test('protected media, unknown media, variants and tracks are refused', async () => {
    const c = client('protected');
    expect(await code(c.request('download/enqueue', { mediaId: 'm_drm' }))).toBe('handler-failed');
    expect(await code(c.request('download/enqueue', { mediaId: 'nope' }))).toBe('handler-failed');
    expect(await code(c.request('download/enqueue', { mediaId: 'm_7f3a', variantId: 'zz' }))).toBe(
      'handler-failed',
    );
    expect(
      await code(c.request('download/enqueue', { mediaId: 'm_7f3a', subtitleIds: ['zz'] })),
    ).toBe('handler-failed');
    expect(await c.request('download/list', {})).toHaveLength(1); // only the scenario's seeded failed job
  });

  test('audio mode names an mp3 and ignores variants and subtitles', async () => {
    const c = client('many');
    const job = await c.request('download/enqueue', {
      mediaId: 'm_7f3a',
      mode: 'audio',
      variantId: 'v0',
      subtitleIds: ['s0'],
    });
    expect(job.outputName).toBe('Sample video.mp3');
    expect(job.subtitleIds).toEqual([]);
    expect(job.variantId).toBeUndefined();
  });
});

test.describe('scenarios', () => {
  test('every scenario is constructible and lists media for tab 42', async () => {
    for (const name of SCENARIO_NAMES) {
      const c = client(name);
      const items = await c.request('media/list', { tabId: 42 });
      expect(items.length > 0, name).toBe(name !== 'empty');
      expect(await c.request('media/list', { tabId: 7 })).toEqual([]);
    }
  });

  test('many has mixed kinds, missing titles and thumbnails, and duration 0', async () => {
    const items = await client('many').request('media/list', { tabId: 42 });
    expect(new Set(items.map((m) => m.kind))).toEqual(new Set(['direct', 'hls', 'dash']));
    expect(items.some((m) => m.title === '')).toBe(true);
    expect(items.some((m) => m.thumbnail === undefined)).toBe(true);
    expect(items.some((m) => m.duration === 0)).toBe(true);
    expect(items.some((m) => m.duration === 'live')).toBe(true);
  });

  for (const [scenario, error] of [
    ['http-403', { kind: 'http', status: 403 }],
    ['incomplete', { kind: 'incomplete', ratio: 0.91 }],
    ['quota', { kind: 'quota' }],
  ] as const) {
    test(`${scenario} fails the first run with the matching error, then a retry succeeds`, async () => {
      const c = client(scenario);
      const job = await c.request('download/enqueue', { mediaId: 'm_7f3a' });
      for (let i = 0; i < 4000; i++) c.advance(100);
      const jobs = await c.request('download/list', {});
      expect(jobs.find((j) => j.id === job.id)).toMatchObject({ status: 'failed', error });
      const retried = await c.request('download/retry', { jobId: job.id });
      for (let i = 0; i < 4000; i++) c.advance(100);
      const after = (await c.request('download/list', {})).find((j) => j.id === retried.id);
      expect(after?.status).toBe('done');
    });
  }

  test('waiting: a new job is queued behind the live job until it is stopped', async () => {
    const c = client('waiting');
    const job = await c.request('download/enqueue', { mediaId: 'm_7f3a' });
    c.advance(1000);
    let current = (await c.request('download/list', {})).find((j) => j.id === job.id);
    expect(current).toMatchObject({
      status: 'queued',
      waiting: { reason: 'header-conflict', blockingJobId: 'j_live' },
    });
    await c.request('download/stop', { jobId: 'j_live' });
    c.advance(1000);
    current = (await c.request('download/list', {})).find((j) => j.id === job.id);
    expect(current?.status).toBe('running');
    expect(current?.waiting).toBeUndefined();
  });

  test('not-available answers unknown-request for planned features only', async () => {
    const c = client('not-available');
    expect(await code(c.request('media/scan', { tabId: 42 }))).toBe('unknown-request');
    expect(await code(c.request('history/list', {}))).toBe('unknown-request');
    expect(await code(c.request('settings/get', {}))).toBe('unknown-request');
    expect(await code(c.request('download/retry', { jobId: 'x' }))).toBe('unknown-request');
    expect(await code(c.request('media/list', { tabId: 42 }))).toBe('ok');
    expect(await code(c.request('download/list', {}))).toBe('ok');
  });

  test('an unknown request name rejects with unknown-request', async () => {
    const c = client('many');
    const loose = c as unknown as { request(name: string, payload: object): Promise<unknown> };
    expect(await code(loose.request('rules/list', {}))).toBe('unknown-request');
  });

  test('disconnected: requests fail, events are lost, reconnect fires the hook', async () => {
    const c = client('disconnected');
    let reconnects = 0;
    c.onReconnect(() => reconnects++);
    const seen = recordJobs(c);
    c.advance(15_000); // outage starts
    expect(await code(c.request('download/list', {}))).toBe('disconnected');
    const during = seen.length;
    c.advance(1000);
    expect(seen.length).toBe(during);
    c.advance(4000); // outage ends
    expect(reconnects).toBe(1);
    expect(await code(c.request('download/list', {}))).toBe('ok');
  });

  test('many announces late audio tracks through tracks/updated', () => {
    const c = client('many');
    const seen: string[] = [];
    c.on('tracks/updated', ({ mediaId }) => seen.push(mediaId));
    c.advance(1000);
    expect(seen).toEqual([]);
    c.advance(1500);
    expect(seen).toEqual(['m_7f3a']);
  });
});

test.describe('isolation and consistency', () => {
  test('late tracks of one client do not leak into the next one', async () => {
    const first = client('many');
    first.advance(3000);
    const second = client('many');
    const item = (await second.request('media/list', { tabId: 42 })).find((m) => m.id === 'm_7f3a');
    expect(item?.audioTracks).toHaveLength(1);
  });

  test('results are copies: editing them does not change the backend', async () => {
    const c = client('many');
    const items = await c.request('media/list', { tabId: 42 });
    items.length = 0;
    expect(await c.request('media/list', { tabId: 42 })).not.toHaveLength(0);
  });

  test('progress never decreases in the disconnected scenario (§3.3)', () => {
    const c = client('disconnected');
    let last = 0;
    c.on('job/updated', ({ job }) => {
      if (typeof job.progress === 'number') {
        expect(job.progress).toBeGreaterThanOrEqual(last);
        last = job.progress;
      }
    });
    for (let i = 0; i < 200; i++) c.advance(100);
    expect(last).toBeGreaterThan(0.1);
  });

  test('a file of unknown size reports indeterminate progress and still finishes', async () => {
    const c = client('many');
    const job = await c.request('download/enqueue', { mediaId: 'm_bare' });
    const seen: DownloadJob[] = [];
    c.on('job/updated', ({ job: j }) => seen.push(j));
    for (let i = 0; i < 200; i++) c.advance(100);
    expect(job.progress).toBe('indeterminate');
    expect(
      seen.filter((j) => j.status === 'running').every((j) => j.progress === 'indeterminate'),
    ).toBe(true);
    expect(seen.at(-1)?.status).toBe('done');
  });

  test('the transition guard throws on a move outside §3.1', async () => {
    const backend = new Backend(buildScenario('many'), () => undefined);
    const job = await Promise.resolve(
      backend.handlers['download/enqueue']({ mediaId: 'm_direct' }),
    );
    const live = backend.jobs.get(job.id);
    if (!live) throw new Error('job missing');
    backend.move(live, 'cancelled');
    expect(() => {
      backend.move(live, 'running');
    }).toThrow(MessagingError);
  });
});

test.describe('scenarioFromUrl', () => {
  test('selects every scenario by name and falls back to many', () => {
    for (const name of SCENARIO_NAMES) expect(scenarioFromUrl(`?scenario=${name}`)).toBe(name);
    expect(scenarioFromUrl('?scenario=nope')).toBe('many');
    expect(scenarioFromUrl('')).toBe('many');
  });
});
