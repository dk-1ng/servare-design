// Throwaway low-fi wireframes for the popup main view (issue #11, ADR 0006).
// One script drives three page variants (prototype/wireframes/popup-{a,b,c}.html):
//   a  two-line row, Choices expand inline as radio groups
//   b  two-line row, Choices open the item view (ADR 0005 as written)
//   c  thumbnail-led row, full-width action line, Choices expand inline as compact selects
// Data comes only from the mock client. Scenes are mock scenarios plus a view preset; they are
// selected with ?scene= (default many). ?static=1 stops the simulated clock, ?tall=1 lifts the
// 600px popup height cap, ?lang=en|pt_BR|pseudo picks the language.
import { initI18n, languageTag, t } from '../i18n/index.ts';
import {
  createMockClient,
  TAB_ID,
  type DownloadError,
  type DownloadJob,
  type MediaItem,
  type Track,
  type Variant,
} from '../mock/index.ts';
import { buildScenario, type Scenario } from '../mock/scenarios.ts';

type Variation = 'a' | 'b' | 'c';
type View = 'main' | 'item' | 'downloads';
type Child = Node | string | false | null | undefined;
type Props = Record<string, string | boolean | undefined>;

interface Choice {
  variantId?: string;
  audioId?: string;
  subtitleId?: string;
  audioOnly: boolean;
}

interface State {
  view: View;
  itemId: string | undefined;
  expanded: string | undefined;
  /** `data-key` of the control that opened the current view, focused again on Back. */
  opener: string | undefined;
  media: MediaItem[];
  jobs: DownloadJob[];
  /** Media seen at least once, so a job can still name a video that left the page. */
  known: Map<string, MediaItem>;
  choices: Map<string, Choice>;
}

const SCENES = ['one', 'bare', 'many', 'choices', 'active', 'item', 'downloads'] as const;
type SceneName = (typeof SCENES)[number];

const params = new URLSearchParams(location.search);
const variantAttr = document.body.dataset['variant'];
const variation: Variation = variantAttr === 'b' || variantAttr === 'c' ? variantAttr : 'a';
const sceneParam = params.get('scene');
const scene: SceneName = SCENES.find((s) => s === sceneParam) ?? 'many';
const isStatic = params.has('static');

// ---------- scene data (mock layer only) ----------

function bytesFor(media: MediaItem, fraction: number): number {
  const bandwidth = media.variants[0]?.bandwidth ?? 2_000_000;
  const seconds = typeof media.duration === 'number' && media.duration > 0 ? media.duration : 600;
  return Math.round((fraction * seconds * bandwidth) / 8);
}

function makeJob(id: string, media: MediaItem, patch: Partial<DownloadJob>): DownloadJob {
  return {
    id,
    mediaId: media.id,
    audioTrackIds: [],
    subtitleIds: [],
    mode: 'video',
    status: 'running',
    progress: 0,
    bytesWritten: 0,
    outputName: `${media.title || 'media'}.mp4`,
    ...patch,
  };
}

interface Preset {
  scenario: Scenario;
  view: View;
  itemId?: string;
  expanded?: string;
}

function preset(name: SceneName): Preset {
  const scenario = buildScenario('many');
  const find = (id: string): MediaItem => {
    const found = scenario.media.find((m) => m.id === id);
    if (!found) throw new Error(`Scene data: no media ${id}`);
    return found;
  };
  const hls = find('m_7f3a');
  const bare = find('m_bare');
  const dash = find('m_dash');
  const live = find('m_live');
  const all = [...scenario.media];
  switch (name) {
    case 'one':
      scenario.media = [hls];
      return { scenario, view: 'main' };
    case 'bare':
      scenario.media = [bare];
      return { scenario, view: 'main' };
    case 'many':
      return { scenario, view: 'main' };
    case 'choices':
      return { scenario, view: 'main', expanded: dash.id, itemId: dash.id };
    case 'active': {
      const protectedItem: MediaItem = { ...dash, id: 'm_drm', protected: true, variants: [] };
      protectedItem.title = 'Streaming service episode';
      scenario.media = [...all.slice(0, 5), protectedItem, ...all.slice(5)];
      scenario.jobs = [
        makeJob('j_run', hls, {
          progress: 0.42,
          bytesWritten: bytesFor(hls, 0.42),
          outputName: 'Sample video.mp4',
        }),
        makeJob('j_audio', hls, {
          mode: 'audio',
          status: 'queued',
          waiting: { reason: 'header-conflict', blockingJobId: 'j_live' },
          outputName: 'Sample video.mp3',
        }),
        makeJob('j_fail', bare, {
          status: 'failed',
          progress: 0.35,
          bytesWritten: bytesFor(bare, 0.35),
          error: { kind: 'http', status: 403 },
          outputName: 'media-bare.mp4',
        }),
        makeJob('j_pause', dash, {
          status: 'paused',
          progress: 0.2,
          bytesWritten: bytesFor(dash, 0.2),
        }),
        makeJob('j_live', live, {
          progress: 'indeterminate',
          bytesWritten: 48_000_000,
          outputName: 'Evening news (live).mp4',
        }),
      ];
      return { scenario, view: 'main' };
    }
    case 'item':
      scenario.jobs = [
        makeJob('j_run', hls, {
          progress: 0.42,
          bytesWritten: bytesFor(hls, 0.42),
          outputName: 'Sample video.mp4',
        }),
        makeJob('j_old', hls, {
          status: 'failed',
          progress: 0.35,
          error: { kind: 'http', status: 403 },
          outputName: 'Sample video (1).mp4',
        }),
      ];
      return { scenario, view: 'item', itemId: hls.id };
    case 'downloads': {
      scenario.media = all.slice(0, 5);
      const gone: MediaItem = { ...hls, id: 'm_gone', title: '' };
      scenario.jobs = [
        makeJob('j_fail', bare, {
          status: 'failed',
          error: { kind: 'http', status: 403 },
          outputName: 'media-bare.mp4',
        }),
        makeJob('j_run', hls, {
          progress: 0.42,
          bytesWritten: bytesFor(hls, 0.42),
          outputName: 'Sample video.mp4',
        }),
        makeJob('j_live', live, { progress: 'indeterminate', bytesWritten: 48_000_000 }),
        makeJob('j_other', gone, {
          progress: 0.7,
          bytesWritten: 56_000_000,
          outputName: 'Old clip from another tab.mp4',
        }),
        makeJob('j_done', dash, {
          status: 'done',
          progress: 1,
          outputName: 'A conference talk.mp4',
        }),
      ];
      return { scenario, view: 'downloads' };
    }
  }
}

// ---------- DOM helpers ----------

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

function button(label: string, key: string, onClick: () => void, cls?: string): HTMLButtonElement {
  const node = el('button', { type: 'button', 'data-key': key, class: cls }, label);
  node.addEventListener('click', onClick);
  return node;
}

function iconButton(
  label: string,
  key: string,
  glyph: string,
  onClick: () => void,
  expanded?: boolean,
): HTMLButtonElement {
  const node = el('button', {
    type: 'button',
    'data-key': key,
    class: 'icon',
    'data-glyph': glyph,
    'aria-label': label,
    'aria-expanded': expanded === undefined ? undefined : String(expanded),
  });
  node.addEventListener('click', onClick);
  return node;
}

function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${String(h)}:${String(m).padStart(2, '0')}:${s}` : `${String(m)}:${s}`;
}

function formatSize(bytes: number): string {
  return new Intl.NumberFormat(languageTag(), {
    style: 'unit',
    unit: 'megabyte',
    maximumFractionDigits: 0,
  }).format(bytes / 1_000_000);
}

function trackLabel(track: Track, n: number, fallbackKey: 'audio' | 'subtitle'): string {
  if (track.label) return track.label;
  if (track.language) {
    try {
      const name = new Intl.DisplayNames([languageTag()], { type: 'language' }).of(track.language);
      if (name) return name;
    } catch {
      // Unknown tag: fall through to the numbered name.
    }
  }
  return fallbackKey === 'audio'
    ? t('popup_audio_track', String(n))
    : t('popup_subtitle_track', String(n));
}

function variantLabel(variant: Variant, n: number): string {
  return variant.height === undefined
    ? t('popup_quality_option', String(n))
    : t('popup_quality_height', String(variant.height));
}

// ---------- state ----------

const initial = preset(scene);
const client = createMockClient({
  scenario: initial.scenario,
  latencyMs: 0,
  autoRun: !isStatic,
});

const state: State = {
  view: initial.view,
  itemId: initial.itemId,
  expanded: variation === 'b' ? undefined : initial.expanded,
  opener: undefined,
  media: [],
  jobs: [],
  known: new Map(),
  choices: new Map(),
};
if (scene === 'choices' && variation === 'b') state.view = 'item';

const frame = el('div', { class: params.has('tall') ? 'popup tall' : 'popup' });

async function refresh(): Promise<void> {
  state.media = await client.request('media/list', { tabId: TAB_ID });
  state.jobs = await client.request('download/list', {});
  for (const m of state.media) state.known.set(m.id, m);
  render();
}

function mediaOf(job: DownloadJob): MediaItem | undefined {
  return state.media.find((m) => m.id === job.mediaId);
}

function run(call: () => Promise<unknown>): () => void {
  return () => {
    void call()
      .catch((error: unknown) => {
        // `unknown-request` means the feature is not available yet; the wireframe ignores it.
        console.warn(error);
      })
      .finally(() => {
        void refresh();
      });
  };
}

function open(view: View, itemId: string | undefined, opener: string): void {
  state.view = view;
  state.itemId = itemId;
  state.opener = opener;
  render(true);
}

function back(): void {
  state.view = 'main';
  render(false, state.opener);
}

// ---------- job parts shared by rows and cards ----------

const RELEVANCE: Record<DownloadJob['status'], number> = {
  running: 0,
  paused: 1,
  queued: 2,
  failed: 3,
  done: 4,
  cancelled: 5,
};

function relevantJobs(mediaId: string): DownloadJob[] {
  return state.jobs
    .filter((j) => j.mediaId === mediaId && j.status !== 'cancelled')
    .sort((a, b) => RELEVANCE[a.status] - RELEVANCE[b.status]);
}

function errorStep(error: DownloadError | undefined): string {
  switch (error?.kind) {
    case 'http':
      return error.status === 401 || error.status === 403
        ? t('popup_err_auth')
        : t('popup_err_http');
    case 'incomplete':
      return t('popup_err_incomplete');
    case 'quota':
      return t('popup_err_quota');
    case 'decrypt':
      return t('popup_err_decrypt');
    case 'protected':
      return t('popup_protected_label');
    default:
      return t('popup_err_unknown');
  }
}

function statusText(job: DownloadJob, media: MediaItem | undefined): string {
  const live = media?.duration === 'live';
  const size = formatSize(job.bytesWritten);
  const percent = typeof job.progress === 'number' ? String(Math.floor(job.progress * 100)) : '';
  switch (job.status) {
    case 'queued':
      return job.waiting ? t('popup_status_waiting') : t('popup_status_queued');
    case 'running':
      if (live) return t('popup_status_recording', size);
      return percent ? t('popup_status_running', percent) : t('popup_status_running_size', size);
    case 'paused':
      if (live) return t('popup_status_paused_live', size);
      return percent ? t('popup_status_paused', percent) : t('popup_status_running_size', size);
    case 'failed':
      return t('popup_status_failed');
    case 'done':
      return t('popup_status_done');
    case 'cancelled':
      return '';
  }
}

function controls(job: DownloadJob, media: MediaItem | undefined): HTMLElement[] {
  const key = (name: string): string => `${job.id}:${name}`;
  const call = (name: 'pause' | 'resume' | 'cancel' | 'stop' | 'retry' | 'remove'): (() => void) =>
    run(() => client.request(`download/${name}`, { jobId: job.id }));
  const cancel = button(t('popup_btn_cancel'), key('cancel'), call('cancel'), 'apart');
  const stop = (): HTMLButtonElement =>
    button(t('popup_btn_stop'), key('stop'), call('stop'), 'primary');
  const live = media?.duration === 'live';
  switch (job.status) {
    case 'queued':
      return [cancel];
    case 'running':
      return [
        ...(live ? [stop()] : []),
        button(t('popup_btn_pause'), key('pause'), call('pause')),
        cancel,
      ];
    case 'paused':
      return [
        ...(live ? [stop()] : []),
        button(t('popup_btn_resume'), key('resume'), call('resume')),
        cancel,
      ];
    case 'failed':
      return job.error?.kind === 'protected'
        ? [button(t('popup_btn_dismiss'), key('remove'), call('remove'))]
        : [
            button(t('popup_btn_retry'), key('retry'), call('retry'), 'primary'),
            button(t('popup_btn_dismiss'), key('remove'), call('remove')),
          ];
    case 'done':
      return [button(t('popup_btn_dismiss'), key('remove'), call('remove'))];
    case 'cancelled':
      return [];
  }
}

function progressBar(job: DownloadJob): HTMLElement | null {
  if (job.status !== 'running' && job.status !== 'paused') return null;
  const label = statusText(job, mediaOf(job));
  return typeof job.progress === 'number'
    ? el('progress', { max: '1', value: String(job.progress), 'aria-label': label })
    : el('progress', { 'aria-label': label });
}

// ---------- choices ----------

function choiceOf(media: MediaItem): Choice {
  const existing = state.choices.get(media.id);
  if (existing) return existing;
  const fresh: Choice = { audioOnly: false };
  state.choices.set(media.id, fresh);
  return fresh;
}

function enqueue(media: MediaItem, choice?: Choice): () => void {
  return run(() => {
    const payload: Parameters<typeof client.request<'download/enqueue'>>[1] = {
      mediaId: media.id,
    };
    if (choice?.audioOnly) payload.mode = 'audio';
    else if (choice) {
      if (choice.variantId) payload.variantId = choice.variantId;
      if (choice.audioId) payload.audioTrackIds = [choice.audioId];
      if (choice.subtitleId) payload.subtitleIds = [choice.subtitleId];
    }
    return client.request('download/enqueue', payload);
  });
}

function pillGroup(
  legend: string,
  name: string,
  options: { value: string; label: string }[],
  selected: string,
  onPick: (value: string) => void,
): HTMLElement {
  const pills = options.map((o) => {
    const input = el('input', {
      type: 'radio',
      name,
      value: o.value,
      checked: o.value === selected,
    });
    input.addEventListener('change', () => {
      onPick(o.value);
    });
    return el('label', { class: 'pill' }, input, o.label);
  });
  return el('fieldset', {}, el('legend', {}, legend), el('div', { class: 'pills' }, ...pills));
}

function selectGroup(
  legend: string,
  name: string,
  options: { value: string; label: string }[],
  selected: string,
  onPick: (value: string) => void,
): HTMLElement {
  const select = el('select', { id: name }, ...options.map(optionEl(selected)));
  select.addEventListener('change', () => {
    onPick(select.value);
  });
  return el('div', { class: 'field' }, el('label', { for: name }, legend), select);
}

function optionEl(selected: string): (o: { value: string; label: string }) => HTMLOptionElement {
  return (o) => el('option', { value: o.value, selected: o.value === selected }, o.label);
}

function choicesForm(media: MediaItem, compact: boolean): HTMLElement {
  const choice = choiceOf(media);
  const group = compact ? selectGroup : pillGroup;
  const rebuild = (): void => {
    render();
  };
  const parts: Child[] = [];
  if (!choice.audioOnly) {
    if (media.variants.length > 1) {
      parts.push(
        group(
          t('popup_group_quality'),
          `q-${media.id}`,
          [
            { value: '', label: t('popup_quality_best') },
            ...media.variants.map((v, i) => ({ value: v.id, label: variantLabel(v, i + 1) })),
          ],
          choice.variantId ?? '',
          (v) => {
            if (v) choice.variantId = v;
            else delete choice.variantId;
          },
        ),
      );
    }
    if (media.audioTracks.length > 1) {
      parts.push(
        group(
          t('popup_group_audio'),
          `a-${media.id}`,
          media.audioTracks.map((tr, i) => ({
            value: tr.id,
            label: trackLabel(tr, i + 1, 'audio'),
          })),
          choice.audioId ?? media.audioTracks[0]?.id ?? '',
          (v) => {
            choice.audioId = v;
          },
        ),
      );
    }
    if (media.subtitles.length > 0) {
      parts.push(
        group(
          t('popup_group_subtitles'),
          `s-${media.id}`,
          [
            { value: '', label: t('popup_subtitles_none') },
            ...media.subtitles.map((tr, i) => ({
              value: tr.id,
              label: trackLabel(tr, i + 1, 'subtitle'),
            })),
          ],
          choice.subtitleId ?? '',
          (v) => {
            if (v) choice.subtitleId = v;
            else delete choice.subtitleId;
          },
        ),
      );
    }
  }
  const audioOnly = el('input', {
    type: 'checkbox',
    id: `mp3-${media.id}`,
    checked: choice.audioOnly,
  });
  audioOnly.addEventListener('change', () => {
    choice.audioOnly = audioOnly.checked;
    rebuild();
  });
  parts.push(
    el(
      'div',
      { class: 'field check' },
      audioOnly,
      el('label', { for: audioOnly.id }, t('popup_audio_only')),
    ),
  );
  parts.push(
    button(
      media.duration === 'live' ? t('popup_btn_record') : t('popup_btn_download'),
      `${media.id}:go`,
      enqueue(media, choice),
      'primary',
    ),
  );
  return el(
    'div',
    { class: compact ? 'choices compact' : 'choices', id: `choices-${media.id}` },
    ...parts,
  );
}

// ---------- main view ----------

function thumb(media: MediaItem | undefined): HTMLElement {
  return media?.thumbnail
    ? el('img', { class: 'thumb', src: media.thumbnail, alt: '' })
    : el('div', { class: 'thumb empty', 'aria-hidden': 'true' });
}

function metaText(media: MediaItem): string {
  if (media.duration === 'live') return t('popup_duration_live');
  return media.duration === 0 ? t('popup_duration_unknown') : formatDuration(media.duration);
}

function mediaRow(media: MediaItem): HTMLLIElement {
  const jobs = relevantJobs(media.id);
  const job = jobs[0];
  const expanded = state.expanded === media.id;
  const toggle = (): void => {
    if (variation === 'b') {
      open('item', media.id, `${media.id}:choices`);
    } else {
      state.expanded = expanded ? undefined : media.id;
      render(false, `${media.id}:choices`);
    }
  };
  const meta = job && job.status !== 'queued' ? statusText(job, media) : metaText(media);
  const title = el(
    'span',
    { class: 'title' },
    media.title || t('popup_untitled'),
    job?.mode === 'audio' && el('span', { class: 'tag' }, t('popup_tag_mp3')),
  );
  const id = el('div', { class: 'id' }, title, el('span', { class: 'meta' }, meta));
  const actions = el('div', { class: 'actions' });
  const choicesLabel = t('popup_btn_choices');
  const glyph = variation === 'b' ? 'next' : 'down';
  const choicesOpener = (compactIcon: boolean): HTMLButtonElement => {
    const key = `${media.id}:choices`;
    const aria = variation === 'b' ? undefined : expanded;
    if (compactIcon) return iconButton(choicesLabel, key, glyph, toggle, aria);
    const b = button(choicesLabel, key, toggle, `choices-toggle ${glyph}`);
    if (aria !== undefined) {
      b.setAttribute('aria-expanded', String(aria));
      b.setAttribute('aria-controls', `choices-${media.id}`);
    }
    return b;
  };
  let bar: HTMLElement | null = null;
  if (media.protected) {
    actions.append(
      el(
        'details',
        { class: 'protected' },
        el('summary', {}, t('popup_protected_label')),
        el('p', {}, t('popup_protected_why')),
      ),
    );
  } else if (job) {
    bar = progressBar(job);
    if (job.status === 'queued')
      actions.append(el('span', { class: 'step' }, statusText(job, media)));
    if (job.status === 'failed')
      actions.append(el('span', { class: 'step' }, errorStep(job.error)));
    actions.append(...controls(job, media));
    if (jobs.length > 1) {
      actions.append(
        button(
          t('popup_btn_more_jobs', String(jobs.length - 1)),
          `${media.id}:more`,
          () => {
            open('item', media.id, `${media.id}:more`);
          },
          'quiet',
        ),
      );
    }
    actions.append(choicesOpener(true));
  } else {
    actions.append(
      button(
        media.duration === 'live' ? t('popup_btn_record') : t('popup_btn_download'),
        `${media.id}:go`,
        enqueue(media),
        'primary',
      ),
      choicesOpener(false),
    );
  }
  return el(
    'li',
    { class: media.protected ? 'row is-protected' : 'row', 'data-key': `row-${media.id}` },
    thumb(media),
    id,
    bar && el('div', { class: 'bar' }, bar),
    actions,
    expanded && !media.protected && variation !== 'b' && choicesForm(media, variation === 'c'),
  );
}

function summary(): HTMLElement | null {
  if (state.jobs.length === 0) return null;
  const attention = state.jobs.filter(
    (j) => j.status === 'failed' || (j.status === 'queued' && j.waiting),
  ).length;
  const active = state.jobs.filter(
    (j) => j.status === 'running' || j.status === 'paused' || (j.status === 'queued' && !j.waiting),
  ).length;
  const parts = [
    active > 0 && t('popup_summary_active', String(active)),
    attention > 0 && t('popup_summary_attention', String(attention)),
  ].filter((p): p is string => p !== false);
  const text =
    parts.length === 2
      ? t('popup_summary_join', parts)
      : (parts[0] ?? t('popup_summary_all', String(state.jobs.length)));
  const b = el(
    'button',
    {
      type: 'button',
      class: 'summary',
      'data-key': 'summary',
      'aria-label': t('popup_summary_label', text),
    },
    el('span', { 'aria-hidden': 'true' }, text),
  );
  b.addEventListener('click', () => {
    open('downloads', undefined, 'summary');
  });
  return el('footer', {}, b);
}

function header(heading: string | null): HTMLElement {
  const history = el(
    'a',
    { href: '#history', 'data-key': 'history', class: 'link' },
    t('popup_history'),
  );
  history.addEventListener('click', (e) => {
    e.preventDefault();
  });
  return el(
    'header',
    {},
    heading === null
      ? el('h1', {}, t('popup_title'))
      : button(t('popup_btn_back'), 'back', back, 'back'),
    history,
  );
}

function mainView(): HTMLElement[] {
  return [
    header(null),
    el(
      'main',
      { class: 'scroll' },
      el('h2', { class: 'list-heading' }, t('popup_page_heading')),
      el('ul', { class: 'rows' }, ...state.media.map(mediaRow)),
    ),
    summary(),
  ].filter((n): n is HTMLElement => n !== null);
}

// ---------- job cards, item and downloads views ----------

function jobCard(job: DownloadJob): HTMLLIElement {
  const media = mediaOf(job) ?? state.known.get(job.mediaId);
  const onPage = mediaOf(job) !== undefined;
  const bar = progressBar(job);
  return el(
    'li',
    { class: 'card' },
    el(
      'div',
      { class: 'id' },
      el(
        'span',
        { class: 'title' },
        job.outputName,
        job.mode === 'audio' && el('span', { class: 'tag' }, t('popup_tag_mp3')),
      ),
      el('span', { class: 'meta' }, statusText(job, media)),
    ),
    !onPage && el('p', { class: 'note' }, t('popup_job_media_gone')),
    bar && el('div', { class: 'bar' }, bar),
    job.status === 'failed' && el('p', { class: 'step' }, errorStep(job.error)),
    job.status === 'queued' && el('p', { class: 'step' }, statusText(job, media)),
    el('div', { class: 'actions' }, ...controls(job, onPage ? media : undefined)),
  );
}

function itemView(): HTMLElement[] {
  const media = state.itemId ? state.known.get(state.itemId) : undefined;
  const onPage = media !== undefined && state.media.some((m) => m.id === media.id);
  const jobs = media ? relevantJobs(media.id) : [];
  return [
    header('item'),
    el(
      'main',
      { class: 'scroll view' },
      el('h2', { tabindex: '-1', 'data-heading': '' }, media?.title || t('popup_untitled')),
      media && !onPage && el('p', { class: 'note' }, t('popup_job_media_gone')),
      media &&
        onPage &&
        variation === 'b' &&
        !media.protected &&
        el('section', {}, el('h3', {}, t('popup_choices_heading')), choicesForm(media, false)),
      el('h3', {}, t('popup_item_jobs')),
      jobs.length > 0
        ? el('ul', { class: 'cards' }, ...jobs.map(jobCard))
        : el('p', { class: 'note' }, t('popup_item_none')),
    ),
  ];
}

function downloadsView(): HTMLElement[] {
  const groups: [string, (j: DownloadJob) => boolean][] = [
    [
      t('popup_group_attention'),
      (j) => j.status === 'failed' || (j.status === 'queued' && j.waiting !== undefined),
    ],
    [
      t('popup_group_active'),
      (j) =>
        j.status === 'running' ||
        j.status === 'paused' ||
        (j.status === 'queued' && j.waiting === undefined),
    ],
    [t('popup_group_finished'), (j) => j.status === 'done' || j.status === 'cancelled'],
  ];
  return [
    header('downloads'),
    el(
      'main',
      { class: 'scroll view' },
      el('h2', { tabindex: '-1', 'data-heading': '' }, t('popup_downloads_heading')),
      ...groups.flatMap(([label, test]) => {
        const jobs = state.jobs.filter(test);
        return jobs.length === 0
          ? []
          : [el('h3', {}, label), el('ul', { class: 'cards' }, ...jobs.map(jobCard))];
      }),
    ),
  ];
}

// ---------- render ----------

function render(focusHeading = false, focusKey?: string): void {
  const active = document.activeElement;
  const keep = focusKey ?? (active instanceof HTMLElement ? active.dataset['key'] : undefined);
  const scroller = frame.querySelector('.scroll');
  const top = scroller?.scrollTop ?? 0;
  const view =
    state.view === 'item' ? itemView() : state.view === 'downloads' ? downloadsView() : mainView();
  frame.replaceChildren(...view);
  const next = frame.querySelector('.scroll');
  if (next && !focusHeading) next.scrollTop = top;
  if (focusHeading) {
    frame.querySelector<HTMLElement>('[data-heading]')?.focus();
  } else if (keep) {
    frame.querySelector<HTMLElement>(`[data-key="${CSS.escape(keep)}"]`)?.focus();
  }
}

function renderNav(): HTMLElement {
  const link = (label: string, href: string, current: boolean): HTMLAnchorElement =>
    el('a', { href, 'aria-current': current ? 'page' : undefined }, label);
  const withParams = (patch: Record<string, string>): string => {
    const next = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    return `?${next.toString()}`;
  };
  const lang = params.get('lang') ?? 'en';
  const list = (items: HTMLElement[]): HTMLElement =>
    el('ul', {}, ...items.map((i) => el('li', {}, i)));
  return el(
    'nav',
    { class: 'wf-nav' },
    list(
      (['a', 'b', 'c'] as const).map((v) =>
        link(v, `popup-${v}.html${location.search}`, v === variation),
      ),
    ),
    list(SCENES.map((s) => link(s, withParams({ scene: s }), s === scene))),
    list(['en', 'pt_BR', 'pseudo'].map((l) => link(l, withParams({ lang: l }), l === lang))),
  );
}

await initI18n();
document.querySelector('#nav')?.replaceWith(renderNav());
document.querySelector('#popup')?.replaceWith(frame);
frame.id = 'popup';
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.view !== 'main') back();
});
client.on('job/updated', () => {
  void refresh();
});
client.on('job/removed', () => {
  void refresh();
});
client.on('tracks/updated', () => {
  void refresh();
});
client.on('media/updated', () => {
  void refresh();
});
client.onReconnect(() => {
  void refresh();
});
await refresh();
document.documentElement.dataset['ready'] = 'true';
