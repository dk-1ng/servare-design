import type { JobStatus } from './types.ts';

/** Allowed `DownloadJob.status` changes, exactly the table of contract §3.1. */
export const TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  queued: ['running', 'cancelled'],
  running: ['paused', 'done', 'failed', 'queued', 'cancelled'],
  paused: ['queued', 'done', 'cancelled'],
  done: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: JobStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
