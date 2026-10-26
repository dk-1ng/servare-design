// Low-fidelity wireframes of the popup's critical states in layout B (issue #12, ADR 0006).
// Every state is a static snapshot built from contract-shaped data (types from the mock layer,
// media from the mock scenarios). All popup text comes from _locales; the annotations around each
// frame (title, inventory IDs, actions) are design documentation in English (lang="en").
// Every rendered control carries data-control; each frame declares the controls it shows and the
// ones it leaves out, and the page throws when the declaration and the markup disagree.
import { initI18n, languageTag, t } from '../i18n/index.ts';
import type { DownloadError, DownloadJob, MediaItem } from '../mock/index.ts';
import { buildScenario } from '../mock/scenarios.ts';

type Child = Node | string | false | null | undefined;
type Props = Record<string, string | boolean | undefined>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    node.setAttribute(name, value === true ? '' : value);
  }
  node.append(...children.filter((c): c is Node | string => c !== false && c != null));
  return node;
}

// ---------- data (mock layer only) ----------

const many = buildScenario('many').media;
const pick = (id: string): MediaItem => {
  const found = [...many, ...buildScenario('protected').media].find((m) => m.id === id);
  if (!found) throw new Error(`No media ${id}`);
  return found;
};
const hls = pick('m_7f3a');
const bare = pick('m_bare');
const dash = pick('m_dash');
const live = pick('m_live');
const drm = pick('m_drm');
const direct = pick('m_direct');

function job(id: string, media: MediaItem, patch: Partial<DownloadJob> = {}): DownloadJob {
  return {
    id,
    mediaId: media.id,
    audioTrackIds: [],
    subtitleIds: [],
    mode: 'video',
    status: 'running',
    progress: 0.42,
    bytesWritten: 30_000_000,
    outputName: `${media.title || 'media'}.mp4`,
    ...patch,
  };
}
const failed = (media: MediaItem, error: DownloadError): DownloadJob =>
  job(`j_${media.id}`, media, { status: 'failed', progress: 0.35, error });
const recording = (patch: Partial<DownloadJob> = {}): DownloadJob =>
  job('j_live', live, { progress: 'indeterminate', bytesWritten: 48_000_000, ...patch });
const waitingJob = (blocker: DownloadJob | undefined): DownloadJob =>
  job('j_wait', hls, {
    status: 'queued',
    progress: 0,
    bytesWritten: 0,
    waiting: blocker
      ? { reason: 'header-conflict', blockingJobId: blocker.id }
      : { reason: 'header-conflict' },
  });

/** Jobs of the frame being built: they feed the pinned Downloads summary (ADR 0005 §5). */
const tracked = new Map<string, DownloadJob>();
function track(j: DownloadJob): DownloadJob {
  tracked.set(j.id, j);
  return j;
}

// ---------- controls ----------

type Control =
  | 'download'
  | 'record'
  | 'choices'
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'stop'
  | 'retry'
  | 'dismiss'
  | 'details'
  | 'why'
  | 'scan'
  | 'try-again'
  | 'keep'
  | 'discard'
  | 'stop-blocker'
  | 'pause-blocker';

/** Wording of the generated "Shows" and "Absent" lines. */
const CONTROL_TEXT: Record<Control, string> = {
  download: 'Download [download/enqueue]',
  record: 'Record [download/enqueue]',
  choices: 'Choices (item view)',
  pause: 'Pause [download/pause]',
  resume: 'Resume [download/resume]',
  cancel: 'Cancel [download/cancel]',
  stop: 'Stop and keep [download/stop]',
  retry: 'Retry [download/retry]',
  dismiss: 'Dismiss [download/remove]',
  details: 'Details (disclosure)',
  why: 'Why (disclosure)',
  scan: 'Scan this page [media/scan]',
  'try-again': 'Try again',
  keep: 'Keep recording',
  discard: 'Discard [download/cancel]',
  'stop-blocker': 'Stop that recording and keep it [download/stop on blockingJobId]',
  'pause-blocker': 'Pause the blocking download [download/pause on blockingJobId]',
};

interface Options {
  /** Controls withheld because their request answers `unknown-request`. */
  hide?: Control[];
  /** Port is down: controls stay but ignore presses (aria-disabled). */
  disabled?: boolean;
  /** Cancel pressed on a recording: ask before discarding. */
  confirm?: boolean;
  /** Job this one waits for (resolved from `waiting.blockingJobId`). */
  blocker?: { job: DownloadJob; media: MediaItem | undefined };
  /** Open the details disclosure. */
  open?: boolean;
}

let uid = 0;

function ctl(
  control: Control,
  label: string,
  o: Options,
  cls = '',
  extra: Props = {},
): HTMLButtonElement {
  return el(
    'button',
    {
      type: 'button',
      class: cls || undefined,
      'data-control': control,
      'aria-disabled': o.disabled ? 'true' : undefined,
      ...extra,
    },
    label,
  );
}

const withoutFalse = <T extends Node>(items: (T | false)[]): T[] =>
  items.filter((n): n is T => n !== false);

/** Choices exist only for an available, unprotected item that is still on the page. */
const canChoose = (media: MediaItem | undefined): boolean =>
  media !== undefined && !media.protected;

function choicesButton(media: MediaItem | undefined, o: Options, icon: boolean) {
  if (!canChoose(media) || o.hide?.includes('choices')) return false;
  return icon
    ? ctl('choices', '', o, 'icon', { 'data-glyph': 'next', 'aria-label': t('popup_btn_choices') })
    : ctl('choices', t('popup_btn_choices'), o, 'choices-toggle next');
}

/** Controls of a job by status (the §3.1 transitions), minus what `unknown-request` removed. */
function jobControls(j: DownloadJob, media: MediaItem | undefined, o: Options): HTMLElement[] {
  const hide = new Set(o.hide ?? []);
  const b = (c: Control, label: string, cls = ''): HTMLButtonElement | false =>
    !hide.has(c) && ctl(c, label, o, cls);
  const isLive = media?.duration === 'live';
  const cancel = b('cancel', t('popup_btn_cancel'), 'apart');
  switch (j.status) {
    case 'running':
      return withoutFalse([
        isLive && b('stop', t('popup_btn_stop'), 'primary'),
        b('pause', t('popup_btn_pause')),
        cancel,
      ]);
    case 'paused':
      return withoutFalse([
        isLive && b('stop', t('popup_btn_stop'), 'primary'),
        b('resume', t('popup_btn_resume')),
        cancel,
      ]);
    case 'queued':
      return withoutFalse([cancel]);
    case 'failed':
      return j.error?.kind === 'protected'
        ? withoutFalse([b('dismiss', t('popup_btn_dismiss'))])
        : withoutFalse([
            b('retry', t('popup_btn_retry'), 'primary'),
            b('dismiss', t('popup_btn_dismiss')),
          ]);
    case 'done':
      return withoutFalse([b('dismiss', t('popup_btn_dismiss'))]);
    case 'cancelled':
      return [];
  }
}

// ---------- text ----------

function sizeText(bytes: number): string {
  return new Intl.NumberFormat(languageTag(), {
    style: 'unit',
    unit: 'megabyte',
    maximumFractionDigits: 0,
  }).format(bytes / 1_000_000);
}

function duration(media: MediaItem): string {
  if (media.duration === 'live') return t('popup_duration_live');
  if (media.duration === 0) return t('popup_duration_unknown');
  const total = Math.floor(media.duration);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${String(h)}:${String(m).padStart(2, '0')}:${s}` : `${String(m)}:${s}`;
}

function statusMeta(j: DownloadJob, media: MediaItem | undefined): string {
  const isLive = media?.duration === 'live';
  const percent = typeof j.progress === 'number' ? String(Math.floor(j.progress * 100)) : '';
  switch (j.status) {
    case 'queued':
      return '';
    case 'running':
      if (j.bytesWritten === 0) return t('popup_status_starting');
      if (isLive) return t('popup_status_recording', sizeText(j.bytesWritten));
      return percent
        ? t('popup_status_running', percent)
        : t('popup_status_running_size', sizeText(j.bytesWritten));
    case 'paused':
      if (isLive) return t('popup_status_paused_live', sizeText(j.bytesWritten));
      return percent
        ? t('popup_status_paused', percent)
        : t('popup_status_running_size', sizeText(j.bytesWritten));
    case 'failed':
      return t('popup_status_failed');
    case 'done':
      return t('popup_status_done');
    case 'cancelled':
      return '';
  }
}

/** Next step in plain words, plus the technical details for the item view. */
function errorText(
  error: DownloadError,
  noRetry: boolean,
): { step: string; detail: string | undefined } {
  switch (error.kind) {
    case 'http': {
      const auth = error.status === 401 || error.status === 403;
      const step = auth
        ? t(noRetry ? 'popup_err_auth_noretry' : 'popup_err_auth')
        : t('popup_err_http');
      return { step, detail: t('popup_detail_http', String(error.status)) };
    }
    case 'incomplete': {
      const percent = String(Math.floor(error.ratio * 100));
      return {
        step: t('popup_err_incomplete_pct', percent),
        detail: t('popup_detail_incomplete', percent),
      };
    }
    case 'decrypt':
      return { step: t('popup_err_decrypt'), detail: t('popup_detail_decrypt') };
    case 'quota':
      return { step: t('popup_err_quota'), detail: t('popup_detail_kind', error.kind) };
    case 'protected':
      return { step: t('popup_protected_label'), detail: undefined };
    case 'cancelled':
      return { step: '', detail: undefined };
    default: {
      // `unknown` and any kind this version does not recognize: `message` as given when it has
      // one (contract §2.3, gap G5), otherwise a localized generic step.
      const raw = (error as { kind: string; message?: unknown }).message;
      const message = typeof raw === 'string' ? raw.trim() : '';
      return {
        step: message === '' ? t('popup_err_unknown') : message,
        detail: t('popup_detail_kind', (error as { kind: string }).kind),
      };
    }
  }
}

function waitingStep(j: DownloadJob, o: Options): string {
  if (!j.waiting) return t('popup_status_queued');
  if (!o.blocker) return t('popup_status_waiting');
  const title = o.blocker.media?.title || o.blocker.job.outputName || t('popup_untitled');
  return o.blocker.media?.duration === 'live'
    ? t('popup_status_waiting_for_live', title)
    : t('popup_status_waiting_for', title);
}

// ---------- rows (main view) and cards (item and Downloads views) ----------

function thumb(media: MediaItem | undefined): HTMLElement {
  return media?.thumbnail
    ? el('img', { class: 'thumb', src: media.thumbnail, alt: '' })
    : el('div', { class: 'thumb empty', 'aria-hidden': 'true' });
}

function progressBar(j: DownloadJob, media: MediaItem | undefined): HTMLElement | null {
  if (j.status !== 'running' && j.status !== 'paused') return null;
  const label = statusMeta(j, media);
  return el(
    'div',
    { class: 'bar' },
    typeof j.progress === 'number'
      ? el('progress', { max: '1', value: String(j.progress), 'aria-label': label })
      : el('progress', { 'aria-label': label }),
  );
}

function whyDisclosure(): HTMLElement {
  return el(
    'details',
    { class: 'protected' },
    el('summary', { 'data-control': 'why' }, t('popup_protected_label')),
    el('p', {}, t('popup_protected_why')),
  );
}

function confirmGroup(o: Options): HTMLElement {
  uid += 1;
  const id = `confirm-${String(uid)}`;
  return el(
    'div',
    { class: 'confirm', role: 'group', 'aria-labelledby': id },
    el('p', { id }, t('popup_confirm_discard')),
    ctl('keep', t('popup_btn_keep_recording'), o, 'primary'),
    ctl('discard', t('popup_btn_discard'), o, 'apart'),
  );
}

/**
 * One row of the main view (layout B anatomy). A job shows only its short next step and the
 * 1-click controls; the full explanation, Details and blocker shortcuts live in the item view
 * (ADR 0005 §2).
 */
function row(media: MediaItem | undefined, j: DownloadJob | undefined, o: Options = {}) {
  if (j) track(j);
  const title = media ? media.title || t('popup_untitled') : (j?.outputName ?? '');
  const meta = j && j.status !== 'queued' ? statusMeta(j, media) : media ? duration(media) : '';
  const identity = el(
    'div',
    { class: 'id' },
    el(
      'span',
      { class: 'title' },
      title,
      j?.mode === 'audio' && el('span', { class: 'tag' }, t('popup_tag_mp3')),
    ),
    el('span', { class: 'meta' }, meta),
  );
  const actions = el('div', { class: 'actions' });
  let bar: HTMLElement | null = null;

  if (!j) {
    if (media?.protected) {
      actions.append(whyDisclosure());
    } else {
      const go =
        media?.duration === 'live'
          ? ctl('record', t('popup_btn_record'), o, 'primary')
          : ctl('download', t('popup_btn_download'), o, 'primary');
      actions.append(go, ...withoutFalse([choicesButton(media, o, false)]));
    }
  } else {
    bar = progressBar(j, media);
    if (j.status === 'queued') {
      actions.append(el('span', { class: 'step' }, waitingStep(j, o)));
    } else if (j.status === 'failed' && j.error) {
      actions.append(
        el('span', { class: 'step' }, errorText(j.error, !!o.hide?.includes('retry')).step),
      );
      if (j.error.kind === 'protected') actions.append(whyDisclosure());
    } else if (j.status === 'done') {
      actions.append(el('span', { class: 'step' }, t('popup_done_where', j.outputName)));
    }
    if (o.confirm) {
      actions.append(confirmGroup(o));
    } else {
      actions.append(...jobControls(j, media, o), ...withoutFalse([choicesButton(media, o, true)]));
    }
  }
  return el(
    'li',
    { class: media?.protected ? 'row is-protected' : 'row' },
    thumb(media),
    identity,
    bar,
    actions,
  );
}

/** Full job card of the item and Downloads views: explanation, Details, blocker controls. */
function card(j: DownloadJob, media: MediaItem | undefined, o: Options = {}): HTMLElement {
  track(j);
  const onPage = media !== undefined;
  const actions = el('div', { class: 'actions' });
  if (j.status === 'queued') {
    actions.append(el('p', { class: 'step' }, waitingStep(j, o)));
    if (j.waiting && o.blocker) {
      // Ending the other job: stop (keeps the recording) when it is live, otherwise pause.
      const title = o.blocker.media?.title || o.blocker.job.outputName || t('popup_untitled');
      actions.append(
        o.blocker.media?.duration === 'live'
          ? ctl('stop-blocker', t('popup_btn_stop_blocker'), o, 'primary')
          : ctl('pause-blocker', t('popup_btn_pause_blocker', title), o, 'primary'),
      );
    }
  } else if (j.status === 'failed' && j.error) {
    const text = errorText(j.error, !!o.hide?.includes('retry'));
    actions.append(el('p', { class: 'step' }, text.step));
    if (j.error.kind === 'protected')
      actions.append(el('p', { class: 'details' }, t('popup_protected_why')));
    else if (text.detail) {
      actions.append(
        el(
          'details',
          { class: 'details', open: o.open },
          el('summary', { 'data-control': 'details' }, t('popup_details')),
          el('p', {}, text.detail),
        ),
      );
    }
  } else if (j.status === 'done') {
    actions.append(el('p', { class: 'step' }, t('popup_done_where', j.outputName)));
  }
  actions.append(...jobControls(j, media, o));
  return el(
    'li',
    { class: 'card' },
    el(
      'div',
      { class: 'id' },
      el(
        'span',
        { class: 'title' },
        j.outputName,
        j.mode === 'audio' && el('span', { class: 'tag' }, t('popup_tag_mp3')),
      ),
      el('span', { class: 'meta' }, statusMeta(j, media)),
    ),
    !onPage && el('p', { class: 'note' }, t('popup_job_media_gone')),
    progressBar(j, media),
    actions,
  );
}

// ---------- popup frame ----------

function skeletonRows(): HTMLElement[] {
  return [0, 1, 2].map(() =>
    el('li', { class: 'skeleton', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')),
  );
}

function noticeEl(text: string, ...extra: Child[]): HTMLElement {
  return el('div', { class: 'notice', role: 'status' }, el('p', {}, text), ...extra);
}

/** Pinned Downloads summary (ADR 0005 §5), rendered when download/list is not empty. */
function summary(): HTMLElement | null {
  const jobs = [...tracked.values()];
  if (jobs.length === 0) return null;
  const attention = jobs.filter(
    (j) => j.status === 'failed' || (j.status === 'queued' && j.waiting),
  ).length;
  const active = jobs.filter(
    (j) => j.status === 'running' || j.status === 'paused' || (j.status === 'queued' && !j.waiting),
  ).length;
  const parts = [
    active > 0 && t('popup_summary_active', String(active)),
    attention > 0 && t('popup_summary_attention', String(attention)),
  ].filter((p): p is string => p !== false);
  const text =
    parts.length === 2
      ? t('popup_summary_join', parts)
      : (parts[0] ?? t('popup_summary_all', String(jobs.length)));
  return el(
    'footer',
    {},
    el(
      'button',
      {
        type: 'button',
        class: 'summary',
        'data-control': 'summary',
        'aria-label': t('popup_summary_label', text),
      },
      el('span', { 'aria-hidden': 'true' }, text),
    ),
  );
}

interface FrameParts {
  view?: 'main' | 'item' | 'downloads';
  /** Heading of an item or Downloads view. */
  heading?: string;
  notice?: HTMLElement;
  rows?: HTMLElement[];
  cards?: { label?: string; items: HTMLElement[] }[];
  body?: HTMLElement;
  busy?: boolean;
}

function popup(parts: FrameParts): HTMLElement {
  const view = parts.view ?? 'main';
  const history = el('a', { href: '#history', class: 'link' }, t('popup_history'));
  const lead =
    view === 'main'
      ? el('p', { class: 'brand' }, t('popup_title'))
      : el(
          'button',
          { type: 'button', class: 'back', 'data-control': 'back' },
          t('popup_btn_back'),
        );
  let main: HTMLElement;
  if (view === 'main') {
    main = el(
      'div',
      { class: 'scroll', 'aria-busy': parts.busy ? 'true' : undefined },
      parts.body ??
        el(
          'div',
          {},
          el('h4', { class: 'list-heading' }, t('popup_page_heading')),
          el('ul', { class: 'rows' }, ...(parts.rows ?? [])),
        ),
    );
  } else {
    main = el(
      'div',
      { class: 'scroll view' },
      el('h4', { class: 'view-title' }, parts.heading ?? ''),
      ...(parts.cards ?? []).flatMap((g) => [
        g.label ? el('h5', { class: 'group' }, g.label) : null,
        el('ul', { class: 'cards' }, ...g.items),
      ]),
    );
  }
  return el(
    'div',
    { class: 'popup tall', lang: languageTag() },
    el('header', {}, lead, history),
    parts.notice,
    main,
    view === 'main' ? summary() : null,
  );
}

const list = (...rows: HTMLElement[]): FrameParts => ({ rows });

function emptyBody(variant: 'empty' | 'scanning' | 'none' | 'blob' | 'no-scan' | 'all-protected') {
  if (variant === 'all-protected') {
    return el(
      'div',
      {},
      el('h4', { class: 'list-heading' }, t('popup_page_heading')),
      el('ul', { class: 'rows' }, row(drm, undefined), row({ ...drm, id: 'm_drm2' }, undefined)),
      el('p', { class: 'empty-state' }, t('popup_all_protected')),
    );
  }
  const scan =
    variant === 'scanning'
      ? ctl('scan', t('popup_scanning'), {}, 'primary', { 'aria-disabled': 'true' })
      : variant === 'empty' || variant === 'none'
        ? ctl('scan', t('popup_btn_scan'), {}, 'primary')
        : null;
  return el(
    'div',
    { class: 'empty-state' },
    el('h4', {}, t('popup_empty_title')),
    el(
      'p',
      {},
      variant === 'none'
        ? t('popup_scan_none')
        : variant === 'blob'
          ? t('popup_scan_blob')
          : t('popup_empty_body'),
    ),
    variant === 'blob' &&
      el(
        'details',
        { class: 'details' },
        el('summary', { 'data-control': 'details' }, t('popup_details')),
        el('p', {}, t('popup_scan_blob_tech')),
      ),
    scan,
  );
}

// ---------- state definitions ----------

interface Note {
  /** Anchor id on this page. */
  id: string;
  /** State inventory IDs this wireframe renders. */
  ids: string[];
  title: string;
  /** Controls the frame renders (checked against the markup). */
  controls: Control[];
  /** Controls deliberately absent (checked against the markup). */
  absent?: Control[];
  /** Why they are absent. */
  why?: string;
  /** Behaviour or focus notes. */
  note?: string;
  frame: () => HTMLElement;
}

interface Section {
  id: string;
  title: string;
  intro: string;
  states: Note[];
}

const waitLive = (): { w: DownloadJob; b: DownloadJob } => {
  const b = recording();
  return { w: waitingJob(b), b };
};

const SECTIONS: Section[] = [
  {
    id: 'errors',
    title: 'Job errors',
    intro:
      'On the main view a failed job keeps its row: the short next step, Retry (primary) and Dismiss, within the one-extra-line exception of ADR 0006. The code and other technical details live in the item view (ADR 0005 §2).',
    states: [
      {
        id: 'err-http-auth',
        ids: ['JOB-FAILED', 'ERR-HTTP', 'ERR-HTTP-AUTH'],
        title: 'HTTP 401 or 403, main view',
        controls: ['retry', 'dismiss', 'choices'],
        absent: ['details'],
        why: 'Details are not on the row: they open from the item view (next frame).',
        note: 'Focus after Retry: the replaced job row is queued; focus moves to its Cancel button (WCAG 2.4.3).',
        frame: () => popup(list(row(bare, failed(bare, { kind: 'http', status: 403 })))),
      },
      {
        id: 'err-http-auth-item',
        ids: ['ERR-HTTP-AUTH', 'ERR-HTTP'],
        title: 'HTTP 401 or 403, item view with Details',
        controls: ['retry', 'dismiss', 'details'],
        note: 'The code appears only inside Details. The choices form is omitted here (see popup-b ?scene=item). Opened from Choices or "+N" on the row; Back and Esc return focus to the opener.',
        frame: () =>
          popup({
            view: 'item',
            heading: t('popup_untitled'),
            cards: [
              {
                label: t('popup_item_jobs'),
                items: [card(failed(bare, { kind: 'http', status: 403 }), bare, { open: true })],
              },
            ],
          }),
      },
      {
        id: 'err-http-other',
        ids: ['ERR-HTTP-OTHER'],
        title: 'HTTP 404 or 5xx',
        controls: ['retry', 'dismiss', 'choices'],
        frame: () => popup(list(row(hls, failed(hls, { kind: 'http', status: 404 })))),
      },
      {
        id: 'err-incomplete',
        ids: ['ERR-INCOMPLETE'],
        title: 'Incomplete',
        controls: ['retry', 'dismiss', 'choices'],
        note: '"About N%" is ratio x 100, rounded down.',
        frame: () => popup(list(row(dash, failed(dash, { kind: 'incomplete', ratio: 0.91 })))),
      },
      {
        id: 'err-decrypt',
        ids: ['ERR-DECRYPT'],
        title: 'Could not be read (decrypt)',
        controls: ['retry', 'dismiss', 'choices'],
        note: 'AES-128 is named only in the item view Details.',
        frame: () => popup(list(row(hls, failed(hls, { kind: 'decrypt' })))),
      },
      {
        id: 'err-quota',
        ids: ['ERR-QUOTA'],
        title: 'Out of disk space',
        controls: ['retry', 'dismiss', 'choices'],
        note: 'Retry is useful only after the user frees space; the step says so.',
        frame: () => popup(list(row(direct, failed(direct, { kind: 'quota' })))),
      },
      {
        id: 'err-unknown',
        ids: ['ERR-UNKNOWN'],
        title: 'Unexpected error',
        controls: ['retry', 'dismiss', 'choices'],
        note: '`message` is shown as given (contract §2.3), untranslated (gap G5). An empty message or an unrecognized kind falls back to the localized generic step.',
        frame: () =>
          popup(
            list(
              row(hls, failed(hls, { kind: 'unknown', message: 'Muxing failed: bad segment.' })),
            ),
          ),
      },
      {
        id: 'err-unknown-private-restart',
        ids: ['ERR-UNKNOWN-PRIVATE-RESTART'],
        title: 'Private download interrupted by a restart',
        controls: ['retry', 'dismiss', 'choices'],
        note: 'Renders as ERR-UNKNOWN until G5 makes it detectable. Retry may answer handler-failed (mediaId gone): see Request notices.',
        frame: () =>
          popup(
            list(
              row(
                hls,
                failed(hls, {
                  kind: 'unknown',
                  message:
                    'Private downloads cannot survive a restart. Reopen the page to start again.',
                }),
              ),
            ),
          ),
      },
      {
        id: 'err-unknown-host-tab',
        ids: ['ERR-UNKNOWN-HOST-TAB'],
        title: 'Host tab closed (Firefox)',
        controls: ['retry', 'dismiss', 'choices'],
        note: 'Until #25 turns this into a paused job; only `message` says so (gap G5).',
        frame: () =>
          popup(
            list(
              row(
                hls,
                failed(hls, {
                  kind: 'unknown',
                  message:
                    'The tab that was playing the video was closed. Reopen it and try again.',
                }),
              ),
            ),
          ),
      },
      {
        id: 'err-protected',
        ids: ['JOB-FAILED', 'ERR-PROTECTED'],
        title: 'Protection found after the download started',
        controls: ['dismiss', 'why'],
        absent: ['retry', 'download', 'record', 'choices'],
        why: 'Product policy: protected media never gets an action.',
        frame: () => popup(list(row(drm, failed(drm, { kind: 'protected' })))),
      },
      {
        id: 'err-cancelled',
        ids: ['JOB-CANCELLED', 'ERR-CANCELLED'],
        title: 'Cancelled by the user',
        controls: ['download', 'choices'],
        absent: ['retry', 'dismiss', 'details'],
        why: 'No error tone, step or details.',
        note: 'A cancelled job is not an error: the partial file is deleted and the row is idle again. The Downloads view lists it under Finished (provisional, #20).',
        frame: () => popup(list(row(hls, undefined))),
      },
    ],
  },
  {
    id: 'waiting',
    title: 'Waiting for another download',
    intro:
      'A queued job with waiting.reason header-conflict names the job it waits for (blockingJobId, resolved in download/list). The main row shows only the sentence and Cancel; the shortcut to end the other job is a full-card control in the item view (flow F6, ADR 0005 §2).',
    states: [
      {
        id: 'waiting-live-blocker',
        ids: ['JOB-QUEUED', 'JOB-QUEUED-WAITING'],
        title: 'Waiting for a live recording, main view',
        controls: ['cancel', 'choices', 'stop', 'pause'],
        absent: ['stop-blocker', 'pause-blocker'],
        why: 'The shortcut lives in the item view; the blocker row below keeps its own Stop and keep.',
        note: 'Waiting needs no action: the job starts by itself when the blocker leaves running. The first Cancel belongs to the waiting job, the rest to the blocker.',
        frame: () => {
          const { w, b } = waitLive();
          return popup(list(row(hls, w, { blocker: { job: b, media: live } }), row(live, b)));
        },
      },
      {
        id: 'waiting-item-live-blocker',
        ids: ['JOB-QUEUED-WAITING'],
        title: 'Waiting for a live recording, item view',
        controls: ['stop-blocker', 'cancel'],
        absent: ['pause-blocker', 'pause', 'resume'],
        why: 'The blocker is a recording, so ending it keeps what was recorded.',
        note: 'Opened from Choices or "+N" on the waiting row. If the blocker leaves running, the card updates in place and focus moves to the job status.',
        frame: () => {
          const { w, b } = waitLive();
          return popup({
            view: 'item',
            heading: hls.title,
            cards: [
              {
                label: t('popup_item_jobs'),
                items: [card(w, hls, { blocker: { job: b, media: live } })],
              },
            ],
          });
        },
      },
      {
        id: 'waiting-item-plain-blocker',
        ids: ['JOB-QUEUED-WAITING'],
        title: 'Waiting for a regular download, item view',
        controls: ['pause-blocker', 'cancel'],
        absent: ['stop-blocker'],
        why: 'The blocker is not a recording. Cancelling it asks first and is reached from its own card.',
        frame: () => {
          const b = job('j_run', direct, { progress: 0.6 });
          return popup({
            view: 'item',
            heading: hls.title,
            cards: [
              {
                label: t('popup_item_jobs'),
                items: [card(waitingJob(b), hls, { blocker: { job: b, media: direct } })],
              },
            ],
          });
        },
      },
      {
        id: 'waiting-plain-blocker',
        ids: ['JOB-QUEUED-WAITING'],
        title: 'Waiting for a regular download, main view',
        controls: ['cancel', 'choices', 'pause'],
        absent: ['stop-blocker', 'pause-blocker'],
        frame: () => {
          const b = job('j_run', direct, { progress: 0.6 });
          return popup(
            list(row(hls, waitingJob(b), { blocker: { job: b, media: direct } }), row(direct, b)),
          );
        },
      },
      {
        id: 'waiting-unnamed',
        ids: ['JOB-QUEUED-WAITING'],
        title: 'Waiting, blocker not in the list',
        controls: ['cancel', 'choices'],
        absent: ['stop-blocker', 'pause-blocker'],
        why: 'blockingJobId is missing or does not resolve: fallback copy without a name, nothing to act on.',
        note: 'Same fallback when the blocker is a live recording whose media is gone (gap G4): the UI cannot tell whether Stop applies.',
        frame: () => popup(list(row(hls, waitingJob(undefined)))),
      },
    ],
  },
  {
    id: 'protected',
    title: 'Protected media',
    intro:
      'No Download, Record, Choices or Retry on a protected item. The label is the disclosure: calm, no blame, no workaround.',
    states: [
      {
        id: 'protected-mixed',
        ids: ['MEDIA-PROTECTED', 'MEDIA-PROTECTED-RICH', 'PAGE-LIST'],
        title: 'Protected item among others',
        controls: ['download', 'choices', 'why'],
        absent: ['retry', 'record'],
        why: 'The protected row has only its Why disclosure; the other rows are normal.',
        note: 'Same title and thumbnail as other rows: protection, not missing data, is the reason there is no action.',
        frame: () => popup(list(row(hls, undefined), row(drm, undefined), row(direct, undefined))),
      },
      {
        id: 'protected-all',
        ids: ['PAGE-ALL-PROTECTED', 'PAGE-QUEUE'],
        title: 'Everything on the page is protected',
        controls: ['why'],
        absent: ['download', 'record', 'choices', 'scan'],
        why: 'Nothing to save here, and a scan would find the same.',
        note: 'A recording from another tab keeps the Downloads summary pinned (ADR 0005 §5).',
        frame: () => {
          track(recording());
          return popup({ body: emptyBody('all-protected') });
        },
      },
    ],
  },
  {
    id: 'live',
    title: 'Live recording',
    intro:
      'Stop and keep is primary and separate from Cancel, which is pushed to the far end, dashed, and asks before discarding. Stop needs no confirmation.',
    states: [
      {
        id: 'live-idle',
        ids: ['MEDIA-LIVE', 'MEDIA-LIVE-BARE', 'MEDIA-VARIANTS-PENDING'],
        title: 'Live item, not recording',
        controls: ['record', 'choices'],
        note: 'Live items have no duration; "Live" takes its place. Variants may still be pending (gap G15).',
        frame: () => popup(list(row(live, undefined))),
      },
      {
        id: 'live-recording',
        ids: ['JOB-RUNNING', 'JOB-RUNNING-LIVE', 'JOB-RUNNING-INDETERMINATE'],
        title: 'Recording',
        controls: ['stop', 'pause', 'cancel', 'choices'],
        note: 'Shows the amount recorded, no percentage. On Stop the row becomes Saved and focus moves to its Dismiss button.',
        frame: () => popup(list(row(live, recording()))),
      },
      {
        id: 'live-cancel-confirm',
        ids: ['JOB-RUNNING-LIVE'],
        title: 'Cancel pressed on a recording',
        controls: ['keep', 'discard'],
        absent: ['stop', 'pause', 'choices'],
        why: 'The row asks one question while it is open; Esc also keeps recording.',
        note: 'The safe choice is the default and receives focus. The same inline question guards Cancel on any running or paused job, with its own wording.',
        frame: () => popup(list(row(live, recording(), { confirm: true }))),
      },
      {
        id: 'live-paused',
        ids: ['JOB-PAUSED', 'JOB-PAUSED-LIVE'],
        title: 'Recording paused',
        controls: ['stop', 'resume', 'cancel', 'choices'],
        frame: () => popup(list(row(live, recording({ status: 'paused' })))),
      },
      {
        id: 'live-stopped',
        ids: ['JOB-DONE'],
        title: 'Recording stopped and kept',
        controls: ['dismiss', 'choices'],
        absent: ['retry'],
        why: 'Open or show the file is not available until gap G1; the text is the G1 fallback and never assumes the folder name.',
        frame: () =>
          popup(
            list(
              row(
                live,
                recording({ status: 'done', progress: 1, outputName: 'Evening news (live).mp4' }),
              ),
            ),
          ),
      },
      {
        id: 'live-media-gone',
        ids: ['JOB-MEDIA-GONE', 'JOB-RUNNING-LIVE'],
        title: 'Recording after the tab navigated (Downloads view)',
        controls: ['pause', 'cancel'],
        absent: ['stop', 'choices'],
        why: 'The UI cannot tell the job is live once its media is gone (gap G4), and there is no item to choose for.',
        note: 'Jobs whose media left the tab live in the Downloads view, not in the page list. The title comes from outputName; nothing is wrong, so there is no error tone.',
        frame: () =>
          popup({
            view: 'downloads',
            heading: t('popup_downloads_heading'),
            cards: [{ label: t('popup_group_active'), items: [card(recording(), undefined)] }],
          }),
      },
    ],
  },
  {
    id: 'page',
    title: 'Empty tab and scan',
    intro:
      'The scan button asks the page to be looked at again (media/scan, planned #31). The result is announced once; the button is never pressable twice.',
    states: [
      {
        id: 'page-loading',
        ids: ['PAGE-LOADING'],
        title: 'Loading the list',
        controls: [],
        note: 'Placeholder rows appear only if the answer takes longer than a moment (no flash for fast answers); the region is aria-busy and announces "Loading…" once.',
        frame: () =>
          popup({
            body: el(
              'div',
              {},
              el('p', { class: 'sr-only', role: 'status' }, t('popup_loading')),
              el('ul', { class: 'rows' }, ...skeletonRows()),
            ),
            busy: true,
          }),
      },
      {
        id: 'page-empty',
        ids: ['PAGE-EMPTY'],
        title: 'Nothing found yet',
        controls: ['scan'],
        note: 'Why nothing was found is unknown (gap G8).',
        frame: () => popup({ body: emptyBody('empty') }),
      },
      {
        id: 'page-empty-jobs',
        ids: ['PAGE-EMPTY', 'PAGE-QUEUE'],
        title: 'Nothing found, jobs from another tab',
        controls: ['scan'],
        note: 'The Downloads summary stays pinned on PAGE-EMPTY so active jobs remain one click away (ADR 0005 §5).',
        frame: () => {
          track(recording());
          track(failed(bare, { kind: 'quota' }));
          return popup({ body: emptyBody('empty') });
        },
      },
      {
        id: 'page-scanning',
        ids: ['PAGE-SCANNING'],
        title: 'Scanning',
        controls: ['scan'],
        note: 'The button is busy (aria-disabled, stays focusable, label "Looking…") and is the only announcement. Presses are ignored.',
        frame: () => popup({ body: emptyBody('scanning') }),
      },
      {
        id: 'page-scan-found',
        ids: ['PAGE-SCAN-FOUND'],
        title: 'Scan found media',
        controls: ['download', 'choices'],
        note: 'Items arrive through media/updated. The Scan button is replaced by the list, so focus moves to the "On this page" heading (tabindex -1); the count is announced by the status region.',
        frame: () =>
          popup({
            ...list(row(hls, undefined), row(direct, undefined)),
            notice: noticeEl(t('popup_scan_found', '2')),
          }),
      },
      {
        id: 'page-scan-none',
        ids: ['PAGE-SCAN-NONE'],
        title: 'Scan found nothing',
        controls: ['scan'],
        frame: () => popup({ body: emptyBody('none') }),
      },
      {
        id: 'page-scan-blob-only',
        ids: ['PAGE-SCAN-BLOB-ONLY'],
        title: 'Scan reports blobOnly',
        controls: ['details'],
        absent: ['scan'],
        why: 'Scanning again would find the same, and no workaround is offered.',
        note: 'Calm and honest. MSE and blob: appear only in Details.',
        frame: () => popup({ body: emptyBody('blob') }),
      },
    ],
  },
  {
    id: 'net',
    title: 'Reconnecting, unavailable features and request notices',
    intro:
      'A request that answers unknown-request means the feature is not available yet: its control is absent and the copy promises nothing. Other failures show a notice at the top, without hiding the list; the Downloads summary stays pinned under all of them.',
    states: [
      {
        id: 'net-reconnecting',
        ids: ['NET-CONNECTED', 'NET-RECONNECTING', 'NET-REFETCHING'],
        title: 'Reconnecting',
        controls: ['pause', 'cancel', 'choices', 'download'],
        note: 'Every request control is aria-disabled: it stays focusable, ignores presses and re-enables in place when the lists arrive; focus is not moved (WCAG 2.4.3). The summary only navigates, so it stays operable. The same frame covers NET-REFETCHING (the note stays until media/list and download/list answer). NET-CONNECTED is every other frame: no indicator.',
        frame: () =>
          popup({
            notice: noticeEl(t('popup_reconnecting')),
            rows: [
              row(hls, job('j_run', hls), { disabled: true }),
              row(direct, undefined, { disabled: true }),
            ],
          }),
      },
      {
        id: 'unavailable-scan',
        ids: ['NET-UNKNOWN-REQUEST', 'PAGE-EMPTY'],
        title: 'unknown-request: scan not available',
        controls: [],
        absent: ['scan'],
        frame: () => popup({ body: emptyBody('no-scan') }),
      },
      {
        id: 'unavailable-stop',
        ids: ['NET-UNKNOWN-REQUEST', 'JOB-RUNNING-LIVE'],
        title: 'unknown-request: stop not available',
        controls: ['pause', 'cancel', 'choices'],
        absent: ['stop'],
        why: 'The copy does not promise that anything is kept.',
        frame: () => popup(list(row(live, recording(), { hide: ['stop'] }))),
      },
      {
        id: 'unavailable-retry',
        ids: ['NET-UNKNOWN-REQUEST', 'ERR-HTTP-AUTH'],
        title: 'unknown-request: retry not available',
        controls: ['dismiss', 'choices'],
        absent: ['retry'],
        why: 'The next step becomes "save it again" after reopening the page.',
        frame: () =>
          popup(list(row(bare, failed(bare, { kind: 'http', status: 403 }), { hide: ['retry'] }))),
      },
      {
        id: 'unavailable-waiting',
        ids: ['NET-UNKNOWN-REQUEST', 'JOB-QUEUED'],
        title: 'unknown-request: no waiting field',
        controls: ['cancel', 'choices'],
        note: 'Before #25 there is no waiting field: the job reads "Waiting to start" and starts by itself.',
        frame: () =>
          popup(
            list(row(hls, job('j_q', hls, { status: 'queued', progress: 0, bytesWritten: 0 }))),
          ),
      },
      {
        id: 'notice-handler-failed',
        ids: ['NET-HANDLER-FAILED'],
        title: 'handler-failed (for example Retry on a gone page)',
        controls: ['retry', 'dismiss', 'choices'],
        note: 'The notice clears on the next successful request; the failed row keeps Retry and Dismiss. The message is shown as given after a translated lead-in (gap G5). Focus does not move; the notice is a status region.',
        frame: () =>
          popup({
            notice: noticeEl(t('popup_notice_failed', 'The page this video came from is gone.')),
            rows: [row(hls, failed(hls, { kind: 'http', status: 403 }))],
          }),
      },
      {
        id: 'notice-generic',
        ids: ['NET-INVALID-MESSAGE', 'NET-INVALID-PAYLOAD', 'NET-INVALID-RESPONSE'],
        title: 'invalid-message, invalid-payload, invalid-response',
        controls: ['download', 'choices'],
        note: 'These are bugs, not user mistakes: one generic notice, no technical code on screen.',
        frame: () =>
          popup({ notice: noticeEl(t('popup_notice_generic')), rows: [row(hls, undefined)] }),
      },
      {
        id: 'notice-timeout',
        ids: ['NET-TIMEOUT', 'NET-DISCONNECTED'],
        title: 'timeout (and disconnected that could not be retried)',
        controls: ['try-again', 'download', 'choices'],
        note: 'Try again reconnects, re-fetches and repeats the request. A disconnected idempotent request is retried silently once; only the unsafe case ends here, after the lists are re-fetched.',
        frame: () =>
          popup({
            notice: noticeEl(
              t('popup_notice_timeout'),
              ctl('try-again', t('popup_btn_try_again'), {}),
            ),
            rows: [row(hls, undefined)],
          }),
      },
    ],
  },
  {
    id: 'basics',
    title: 'Job basics',
    intro:
      'Job states without an own critical concern, drawn once so the inventory is complete. The row anatomy is layout B (ADR 0006).',
    states: [
      {
        id: 'job-queued',
        ids: ['JOB-QUEUED'],
        title: 'Queued',
        controls: ['cancel', 'choices'],
        frame: () =>
          popup(
            list(row(hls, job('j_q', hls, { status: 'queued', progress: 0, bytesWritten: 0 }))),
          ),
      },
      {
        id: 'job-running-starting',
        ids: ['JOB-RUNNING-STARTING'],
        title: 'Starting',
        controls: ['pause', 'cancel', 'choices'],
        note: 'No speed or time estimate while bytesWritten is 0.',
        frame: () => popup(list(row(hls, job('j_s', hls, { progress: 0, bytesWritten: 0 })))),
      },
      {
        id: 'job-running-determinate',
        ids: ['JOB-RUNNING', 'JOB-RUNNING-DETERMINATE', 'JOB-PAUSED-RESUMED'],
        title: 'Running with a percentage',
        controls: ['pause', 'cancel', 'choices'],
        note: 'A resumed job shows the same row, continuing from the persisted progress.',
        frame: () => popup(list(row(hls, job('j_r', hls)))),
      },
      {
        id: 'job-running-indeterminate',
        ids: ['JOB-RUNNING-INDETERMINATE', 'JOB-AUDIO-MODE'],
        title: 'Unknown total, audio only',
        controls: ['pause', 'cancel', 'choices'],
        note: 'Amount saved, no percentage and no time left. The MP3 tag marks audio mode.',
        frame: () =>
          popup(list(row(hls, job('j_i', hls, { progress: 'indeterminate', mode: 'audio' })))),
      },
      {
        id: 'job-paused',
        ids: ['JOB-PAUSED'],
        title: 'Paused',
        controls: ['resume', 'cancel', 'choices'],
        frame: () => popup(list(row(hls, job('j_p', hls, { status: 'paused' })))),
      },
      {
        id: 'job-done',
        ids: ['JOB-DONE'],
        title: 'Done',
        controls: ['dismiss', 'choices'],
        why: 'Open or show the file is not available until gap G1.',
        frame: () =>
          popup(
            list(
              row(
                hls,
                job('j_d', hls, { status: 'done', progress: 1, outputName: 'Sample video.mp4' }),
              ),
            ),
          ),
      },
      {
        id: 'job-media-gone',
        ids: ['JOB-MEDIA-GONE'],
        title: 'Page left (media gone), Downloads view',
        controls: ['pause', 'cancel'],
        absent: ['choices', 'stop'],
        why: 'There is no item to choose for, and the job is not known to be live.',
        note: 'Jobs from other tabs or left pages live in the Downloads view with the "no longer on the page" note.',
        frame: () =>
          popup({
            view: 'downloads',
            heading: t('popup_downloads_heading'),
            cards: [
              {
                label: t('popup_group_active'),
                items: [
                  card(job('j_g', hls, { outputName: 'Old clip from another tab.mp4' }), undefined),
                ],
              },
            ],
          }),
      },
    ],
  },
];

// ---------- page ----------

function chips(ids: string[]): HTMLElement {
  return el(
    'ul',
    { class: 'ids', 'aria-label': 'State inventory IDs' },
    ...ids.map((id) => el('li', {}, el('code', {}, id))),
  );
}

function listText(controls: Control[]): string {
  return controls.map((c) => CONTROL_TEXT[c]).join(', ');
}

/** Throws when a frame's declared controls differ from what its markup renders. */
function verify(s: Note, frame: HTMLElement): string[] {
  const rendered = new Set(
    [...frame.querySelectorAll<HTMLElement>('[data-control]')].map(
      (n) => n.dataset['control'] ?? '',
    ),
  );
  const implicit = ['summary', 'back'].filter((c) => rendered.delete(c));
  const declared = new Set<string>(s.controls);
  const missing = [...declared].filter((c) => !rendered.has(c));
  const extra = [...rendered].filter((c) => !declared.has(c));
  const present = (s.absent ?? []).filter((c) => rendered.has(c));
  if (missing.length > 0 || extra.length > 0 || present.length > 0) {
    throw new Error(
      `Frame ${s.id}: declared but not rendered [${missing.join(', ')}]; rendered but not declared [${extra.join(', ')}]; listed absent but rendered [${present.join(', ')}]`,
    );
  }
  return implicit;
}

function figure(s: Note): HTMLElement {
  tracked.clear();
  const frame = s.frame();
  const implicit = verify(s, frame);
  const shows = [
    s.controls.length > 0 ? listText(s.controls) : 'None',
    implicit.includes('summary') ? 'Downloads summary (pinned)' : '',
    implicit.includes('back') ? 'Back' : '',
  ]
    .filter(Boolean)
    .join(', ');
  const dl = el('dl', { class: 'anno' }, el('dt', {}, 'Shows'), el('dd', {}, shows));
  if (s.absent?.length || s.why) {
    dl.append(
      el('dt', {}, 'Absent'),
      el(
        'dd',
        {},
        [s.absent?.length ? listText(s.absent) : '', s.why ?? ''].filter(Boolean).join('. '),
      ),
    );
  }
  if (s.note) dl.append(el('dt', {}, 'Notes'), el('dd', {}, s.note));
  return el(
    'figure',
    { class: 'state', id: s.id },
    el('figcaption', {}, el('h3', {}, s.title), chips(s.ids), dl),
    frame,
  );
}

function render(): HTMLElement {
  const lang = new URLSearchParams(location.search).get('lang') ?? 'en';
  const langLinks = ['en', 'pt_BR', 'pseudo'].map((l) =>
    el(
      'li',
      {},
      el(
        'a',
        {
          href: `wireframes/popup-states.html?lang=${l}`,
          'aria-current': l === lang ? 'page' : undefined,
        },
        l,
      ),
    ),
  );
  return el(
    'div',
    { class: 'states-doc', lang: 'en' },
    el('h1', {}, 'Popup critical states (low fidelity, layout B)'),
    el(
      'p',
      {},
      'Each frame is a 380px popup snapshot. Inventory IDs come from docs/discovery/state-inventory.md; the coverage table is docs/flows/popup-critical-states.md. Frames are static: focus notes describe the intended behaviour. The text inside each frame follows the language chosen below; everything around it is documentation in English.',
    ),
    el('ul', { class: 'langs', 'aria-label': 'Language of the frames' }, ...langLinks),
    el(
      'nav',
      { 'aria-label': 'Sections' },
      el(
        'ul',
        { class: 'toc' },
        ...SECTIONS.map((sec) =>
          el('li', {}, el('a', { href: `wireframes/popup-states.html#${sec.id}` }, sec.title)),
        ),
      ),
    ),
    ...SECTIONS.map((sec) =>
      el(
        'section',
        { id: sec.id, 'aria-labelledby': `${sec.id}-h` },
        el('h2', { id: `${sec.id}-h` }, sec.title),
        el('p', {}, sec.intro),
        el('div', { class: 'state-grid' }, ...sec.states.map(figure)),
      ),
    ),
  );
}

await initI18n();
document.querySelector('#states')?.replaceWith(render());
document.documentElement.dataset['ready'] = 'true';
