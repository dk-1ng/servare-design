import type {
  DownloadError,
  DownloadJob,
  HistoryEntry,
  MediaItem,
  RequestName,
  RulesDocument,
  Settings,
  Track,
} from './types.ts';
import {
  bareDirect,
  directWithTitle,
  dashItem,
  lateTracks,
  liveItem,
  sampleRules,
  sampleSettings,
  manyItems,
  protectedItem,
  sampleHistory,
  sampleHls,
} from './fixtures/media.ts';

export const SCENARIO_NAMES = [
  'empty',
  'many',
  'live',
  'protected',
  'http-403',
  'incomplete',
  'quota',
  'waiting',
  'disconnected',
  'not-available',
] as const;

export type ScenarioName = (typeof SCENARIO_NAMES)[number];

export interface Scenario {
  media: MediaItem[];
  jobs: DownloadJob[];
  history: HistoryEntry[];
  settings: Settings;
  rules: RulesDocument;
  /** Jobs fail once per media at this progress (0–1); a retry then succeeds. */
  failure?: { at: number; error: DownloadError };
  /** A queued job waits while a live job runs (contract §3.2). */
  headerConflict?: boolean;
  /** Announced through `tracks/updated` after `afterMs`. */
  lateTracks?: { mediaId: string; tracks: Track[]; afterMs: number };
  /** The port drops for `forMs` every `everyMs`, then reconnects. */
  outage?: { everyMs: number; forMs: number };
  /** Requests that answer `unknown-request`. */
  unavailable: ReadonlySet<RequestName>;
  /** What `media/scan` reports. */
  scan: { found: number; blobOnly: boolean };
}

/** Requests that are planned, not implemented, in the contract (§4). */
const PLANNED: RequestName[] = [
  'media/scan',
  'download/retry',
  'download/remove',
  'download/stop',
  'history/list',
  'history/remove',
  'history/clear',
  'rules/get',
  'rules/set',
  'rules/remove',
  'settings/get',
  'settings/set',
];

function base(media: MediaItem[]): Scenario {
  return {
    media,
    jobs: [],
    history: sampleHistory(),
    settings: sampleSettings(),
    rules: sampleRules(),
    unavailable: new Set(),
    scan: { found: 0, blobOnly: true },
  };
}

function runningJob(media: MediaItem, id: string, bytesWritten: number): DownloadJob {
  return {
    id,
    mediaId: media.id,
    audioTrackIds: [],
    subtitleIds: [],
    mode: 'video',
    status: 'running',
    progress: media.duration === 'live' ? 'indeterminate' : 0.3,
    bytesWritten,
    outputName: `${media.title || 'media'}.mp4`,
  };
}

export function buildScenario(name: ScenarioName): Scenario {
  // Fixtures are shared module objects; a scenario owns its copy so one client cannot change another's.
  return structuredClone(build(name));
}

function build(name: ScenarioName): Scenario {
  switch (name) {
    case 'empty':
      return base([]);
    case 'many':
      return {
        ...base(manyItems()),
        lateTracks: { mediaId: sampleHls.id, tracks: lateTracks, afterMs: 2000 },
        scan: { found: 0, blobOnly: false },
      };
    case 'live':
      return base([liveItem, directWithTitle]);
    case 'protected':
      return {
        ...base([protectedItem, sampleHls]),
        jobs: [
          {
            id: 'j_prot',
            mediaId: protectedItem.id,
            audioTrackIds: [],
            subtitleIds: [],
            mode: 'video',
            status: 'failed',
            progress: 0.05,
            bytesWritten: 1_200_000,
            error: { kind: 'protected' },
            outputName: 'Streaming service episode.mp4',
          },
        ],
      };
    case 'http-403':
      return {
        ...base([sampleHls, bareDirect]),
        failure: { at: 0.35, error: { kind: 'http', status: 403 } },
      };
    case 'incomplete':
      return {
        ...base([sampleHls, dashItem]),
        failure: { at: 1, error: { kind: 'incomplete', ratio: 0.91 } },
      };
    case 'quota':
      return {
        ...base([sampleHls, directWithTitle]),
        failure: { at: 0.1, error: { kind: 'quota' } },
      };
    case 'waiting':
      return {
        ...base([liveItem, sampleHls, directWithTitle]),
        jobs: [runningJob(liveItem, 'j_live', 48_000_000)],
        headerConflict: true,
      };
    case 'disconnected':
      return {
        ...base([sampleHls, directWithTitle]),
        jobs: [runningJob(sampleHls, 'j_run', 90_000_000)],
        outage: { everyMs: 15_000, forMs: 4000 },
      };
    case 'not-available':
      return {
        ...base([sampleHls, bareDirect]),
        unavailable: new Set(PLANNED),
        scan: { found: 0, blobOnly: true },
      };
  }
}

export function isScenarioName(value: string | null): value is ScenarioName {
  return SCENARIO_NAMES.some((n) => n === value);
}
