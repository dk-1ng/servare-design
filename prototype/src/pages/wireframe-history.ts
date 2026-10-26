// Low-fidelity wireframes of the history page (issue #13), from docs/flows/options-history-ia.md
// §4. Static snapshots of contract-shaped HistoryEntry data from the mock layer, at 1024px and
// 380px. Same conventions as wireframe-options.ts: declared controls per state, checked on load.
import { initI18n, languageTag, t } from '../i18n/index.ts';
import { MOCK_NOW, type HistoryEntry } from '../mock/index.ts';
import { buildScenario } from '../mock/scenarios.ts';
import {
  coverageTable,
  el,
  renderDoc,
  uid,
  type Child,
  type CoverageRow,
  type Section,
  type Width,
} from './wf/kit.ts';

// ---------- data (mock layer only) ----------

/** Local calendar day of the mock clock, so day groups do not depend on the time zone of the run. */
const base = new Date(MOCK_NOW);
const at = (daysAgo: number, hour: number, minute: number): number =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() - daysAgo, hour, minute).getTime();
const NOW = at(0, 18, 0);

const seeded = buildScenario('many').history;
const seed = (id: string): HistoryEntry => {
  const found = seeded.find((e) => e.id === id);
  if (!found) throw new Error(`No history entry ${id}`);
  return found;
};

const LONG_WORD = 'Ultra-high-definition-remaster-director-cut-extended-edition-with-commentary';
const entries: HistoryEntry[] = [
  { ...seed('h_1'), completedAt: at(0, 14, 20) },
  {
    id: 'h_long',
    title: `Why long titles still have to fit on one small screen without breaking the page, a talk in three parts (${LONG_WORD})`,
    pageUrl: `https://videos.long-example-domain.example.org/series/2025/season-1/episode-12?session=${'a1b2c3d4'.repeat(6)}&lang=en`,
    outputName: `${LONG_WORD}-part-1-of-3.mp4`,
    kind: 'dash',
    completedAt: at(0, 11, 5),
    bytes: 2_400_000_000,
    status: 'done',
  },
  { ...seed('h_2'), completedAt: at(1, 20, 30) },
  {
    id: 'h_host',
    title: '',
    pageUrl: 'https://cdn.example.net/v/9',
    outputName: '',
    kind: 'direct',
    completedAt: at(1, 9, 12),
    bytes: 5_000_000,
    status: 'done',
  },
  {
    id: 'h_audio',
    title: 'Interview audio',
    pageUrl: 'https://example.com/interviews/4',
    outputName: 'Interview audio.mp3',
    kind: 'direct',
    completedAt: at(1, 8, 40),
    bytes: 0,
    status: 'done',
  },
  { ...seed('h_3'), completedAt: at(3, 16, 45) },
];

// ---------- text helpers ----------

const host = (url: string): string => new URL(url).host;
/** Title fallbacks (IA §4.4): title, then outputName, then the host of pageUrl. */
const titleOf = (e: HistoryEntry): string => e.title || e.outputName || host(e.pageUrl);
const isAudio = (e: HistoryEntry): boolean => /\.(mp3|m4a|aac|opus|ogg)$/i.test(e.outputName);

function sizeText(bytes: number): string {
  const gb = bytes >= 1_000_000_000;
  return new Intl.NumberFormat(languageTag(), {
    style: 'unit',
    unit: gb ? 'gigabyte' : 'megabyte',
    maximumFractionDigits: gb ? 1 : 0,
  }).format(bytes / (gb ? 1_000_000_000 : 1_000_000));
}

const timeText = (ms: number): string =>
  new Intl.DateTimeFormat(languageTag(), { timeStyle: 'short' }).format(ms);

function dayLabel(ms: number): string {
  const day = (n: number): number => new Date(n).setHours(0, 0, 0, 0);
  const diff = Math.round((day(NOW) - day(ms)) / 86_400_000);
  if (diff === 0) return t('hist_today');
  if (diff === 1) return t('hist_yesterday');
  return new Intl.DateTimeFormat(languageTag(), { dateStyle: 'full' }).format(ms);
}

const kindText = (e: HistoryEntry): string => t(`hist_kind_${e.kind}`);

// ---------- frame pieces ----------

const win = (width: Width, ...children: Child[]): HTMLElement =>
  el('div', { class: `win w${String(width)}`, lang: languageTag() }, ...children);

interface Frame {
  search?: string;
  /** Show search and Clear history. */
  tools?: boolean;
  clearDisabled?: boolean;
  body: Child[];
  /** Dialog drawn over the page (HIST-CONFIRM-CLEAR). */
  dialog?: HTMLElement;
}

function histPage(width: Width, f: Frame): HTMLElement {
  const searchId = uid('hist-search');
  const tools =
    f.tools === false
      ? false
      : el(
          'div',
          { class: 'hist-tools' },
          f.search !== undefined &&
            el(
              'span',
              {},
              el('label', { for: searchId }, `${t('hist_search_label')} `),
              el('input', {
                id: searchId,
                type: 'search',
                value: f.search,
                'data-control': 'history-search',
              }),
            ),
          el(
            'button',
            { type: 'button', 'data-control': 'history-clear', disabled: f.clearDisabled },
            t('hist_clear'),
          ),
        );
  return win(
    width,
    el(
      'div',
      { class: 'hist', inert: f.dialog ? true : undefined },
      el(
        'div',
        { class: 'hist-head' },
        el('h1', {}, t('hist_title')),
        el('a', { href: '#', 'data-control': 'nav-options' }, t('hist_nav_options')),
      ),
      tools,
      ...f.body,
    ),
    f.dialog && el('div', { class: 'scrim' }),
    f.dialog,
  );
}

let rowCount = 0;

interface RowOptions {
  /** Draw the focus ring on this row's first action (focus note). */
  focusFirst?: boolean;
  open?: boolean;
}

function row(e: HistoryEntry, o: RowOptions = {}): HTMLElement {
  const title = titleOf(e);
  const failed = e.status === 'failed';
  const helpId = `rm-help-${String(++rowCount)}`;
  return el(
    'li',
    { class: 'entry' },
    el('div', {
      class: 'glyph',
      'data-kind': isAudio(e) ? 'audio' : 'video',
      'aria-hidden': 'true',
    }),
    el(
      'div',
      {},
      el('p', { class: 'entry-title', 'data-field': 'title' }, title),
      el(
        'p',
        { class: 'entry-meta' },
        el('span', { 'data-field': 'pageUrl' }, host(e.pageUrl)),
        ' · ',
        el('time', { 'data-field': 'completedAt' }, timeText(e.completedAt)),
        e.bytes > 0 && ' · ',
        e.bytes > 0 && el('span', { 'data-field': 'bytes' }, sizeText(e.bytes)),
        failed && ' ',
        failed && el('span', { class: 'tag', 'data-field': 'status' }, t('hist_failed')),
      ),
      el(
        'div',
        { class: 'entry-actions' },
        el(
          'a',
          {
            href: e.pageUrl,
            target: '_blank',
            rel: 'noopener',
            class: o.focusFirst ? 'focus-sim' : undefined,
            'data-control': failed ? 'history-retry-link' : 'history-open-page',
          },
          failed ? t('hist_retry_page') : t('hist_open_page'),
        ),
        el(
          'button',
          {
            type: 'button',
            'aria-label': t('hist_remove_aria', title),
            'aria-describedby': helpId,
            'data-control': 'history-remove',
            'data-field': 'id',
          },
          t('hist_remove'),
        ),
        el('span', { class: 'sr-only', id: helpId }, t('hist_remove_help')),
      ),
      el(
        'details',
        { open: o.open },
        el('summary', { 'data-control': 'history-details' }, t('hist_details')),
        el(
          'dl',
          {},
          el('dt', {}, t('hist_d_file')),
          el('dd', { 'data-field': 'outputName' }, e.outputName || '-'),
          el('dt', {}, t('hist_d_format')),
          el('dd', { 'data-field': 'kind' }, kindText(e)),
          el('dt', {}, t('hist_d_page')),
          el('dd', {}, e.pageUrl),
        ),
      ),
    ),
  );
}

interface ListOptions {
  entries: HistoryEntry[];
  focusIndex?: number;
  openIndex?: number;
  truncated?: boolean;
}

function groupedList(o: ListOptions): Child[] {
  const sorted = [...o.entries].sort((a, b) => b.completedAt - a.completedAt);
  const out: Child[] = [];
  let label = '';
  let ul: HTMLElement | undefined;
  sorted.forEach((e, i) => {
    const day = dayLabel(e.completedAt);
    if (day !== label || !ul) {
      label = day;
      out.push(el('h2', { class: 'day' }, day));
      ul = el('ul', { class: 'entries' });
      out.push(ul);
    }
    ul.append(row(e, { focusFirst: i === o.focusIndex, open: i === o.openIndex }));
  });
  if (o.truncated) out.push(el('p', { class: 'end-note' }, t('hist_truncated')));
  out.push(el('p', { class: 'end-note' }, t('hist_footnote')));
  return out;
}

const longIndex = [...entries]
  .sort((a, b) => b.completedAt - a.completedAt)
  .findIndex((e) => e.id === 'h_long');

// ---------- declarations ----------

const NAV = ['nav-options'];
const ROW = ['history-open-page', 'history-retry-link', 'history-remove', 'history-details'];
const LIST = [...NAV, 'history-search', 'history-clear', ...ROW];

const SECTIONS: Section[] = [
  {
    id: 'states',
    title: 'History states',
    intro:
      'Seven states of IA §4.7 plus the clear dialog and the row removal. Rows follow IA §4.4: title (fallbacks: title, then outputName, then host), site, time, size, "Did not finish" only on failed entries, actions Open page / Try again on the page and Remove from history, file name, format and page address under Details. Sorted newest first and grouped by day in the UI.',
    states: [
      {
        id: 'hist-loading',
        ids: ['HIST-LOADING'],
        title: 'Loading',
        controls: NAV,
        requests: ['history/list { limit: 500 }'],
        note: 'Skeleton rows; the list region carries aria-busy. Search and Clear history are withheld until the response arrives.',
        build: (w) =>
          histPage(w, {
            tools: false,
            body: [
              el(
                'div',
                {
                  class: 'skeleton-rows',
                  'aria-busy': 'true',
                  role: 'status',
                  'aria-label': t('hist_loading'),
                },
                ...[0, 1, 2].map(() =>
                  el('div', { class: 'skeleton-row' }, el('i'), el('i'), el('i'), el('i')),
                ),
              ),
            ],
          }),
      },
      {
        id: 'hist-empty',
        ids: ['HIST-EMPTY'],
        title: 'Empty, with the private-window note',
        controls: [...NAV, 'history-clear'],
        requests: ['history/list (response is [])'],
        note: 'Clear history is present but disabled; there is no search field. The second sentence is the private-window note (design principle 4).',
        build: (w) =>
          histPage(w, {
            clearDisabled: true,
            body: [
              el(
                'div',
                { class: 'hist-empty' },
                el('h2', {}, t('hist_empty_title')),
                el('p', {}, t('hist_empty_body')),
              ),
            ],
          }),
      },
      {
        id: 'hist-list',
        ids: ['HIST-LIST'],
        title: 'List: day groups, fallbacks, failed row, long text',
        controls: LIST,
        requests: [
          'history/list { limit: 500 }',
          'history/updated (event)',
          'onReconnect (re-fetch)',
        ],
        note: 'Rows drawn: a normal entry; a very long title, file name and address that wrap instead of widening the page (Details open to show the address); an empty title that falls back to the file name; an empty title and file name that fall back to the site; an audio file (glyph from the extension, size hidden when bytes is 0); a failed entry with "Did not finish" and "Try again on the page" (a link to the page: history cannot retry). The footnote repeats the private-window note. Open file and Show in folder are not offered until G1.',
        build: (w) =>
          histPage(w, {
            search: '',
            body: groupedList({ entries, openIndex: longIndex }),
          }),
      },
      {
        id: 'hist-no-match',
        ids: ['HIST-NO-MATCH'],
        title: 'Search finds nothing',
        controls: [...NAV, 'history-search', 'history-clear', 'history-search-reset'],
        requests: ['none (search filters title, outputName and host in the UI)'],
        note: 'Clear history stays enabled and still clears everything; the dialog says so (see the search variant of HIST-CONFIRM-CLEAR). The result count change is announced politely.',
        build: (w) =>
          histPage(w, {
            search: 'zebra',
            body: [
              el(
                'div',
                { class: 'hist-empty', role: 'status' },
                el('p', {}, t('hist_no_match', 'zebra')),
                el(
                  'button',
                  { type: 'button', 'data-control': 'history-search-reset' },
                  t('hist_search_reset'),
                ),
              ),
            ],
          }),
      },
      {
        id: 'hist-truncated',
        ids: ['HIST-TRUNCATED'],
        title: 'Exactly 500 entries returned',
        controls: LIST,
        requests: ['history/list { limit: 500 }'],
        note: 'Six rows are drawn for the wireframe; the state is "exactly limit entries came back". The end of the list says older downloads are not shown (G3), above the footnote.',
        build: (w) => histPage(w, { search: '', body: groupedList({ entries, truncated: true }) }),
      },
      {
        id: 'hist-row-remove',
        ids: ['HIST-LIST'],
        title: 'After Remove from history: focus note',
        controls: LIST,
        requests: ['history/remove { entryId }', 'history/updated (event)'],
        note: 'Remove acts at once, no confirmation and no Undo (the contract has no request to put an entry back). The "Removed from history" status is announced and focus moves to the next row, drawn here on its first action (the previous row, or the search field, when the removed one was last). The file stays on the computer; the button is described by that sentence for screen readers.',
        build: (w) => {
          const next = entries.filter((e) => e.id !== 'h_long' && e.id !== 'h_host');
          return histPage(w, {
            search: '',
            body: [
              el('p', { class: 'help', role: 'status' }, t('hist_removed')),
              ...groupedList({ entries: next, focusIndex: 1 }),
            ],
          });
        },
      },
      {
        id: 'hist-confirm-clear',
        ids: ['HIST-CONFIRM-CLEAR'],
        title: 'Clear history: confirmation dialog',
        controls: [...LIST, 'history-confirm-clear', 'history-confirm-cancel'],
        requests: ['history/clear {}', 'history/updated (event)'],
        note: 'Modal: the page behind is inert, focus is trapped, Esc cancels. Cancel has focus when it opens (drawn). The dialog says how many entries go and that files stay. Confirm sends history/clear and the page shows HIST-EMPTY.',
        build: (w) => confirmFrame(w, false),
      },
      {
        id: 'hist-confirm-clear-search',
        ids: ['HIST-CONFIRM-CLEAR'],
        title: 'Clear history while a search is active',
        controls: [...LIST, 'history-confirm-clear', 'history-confirm-cancel'],
        requests: ['history/clear {}'],
        note: 'Clear history always clears everything; with a search active the dialog says so, so nobody expects only the matches to go.',
        build: (w) => confirmFrame(w, true),
      },
      {
        id: 'hist-error',
        ids: ['HIST-ERROR'],
        title: 'Request failure',
        controls: [...NAV, 'history-try-again'],
        requests: ['history/list (rejected, for example timeout)'],
        note: 'The F8 request-failure pattern: calm message and a concrete action. Try again repeats history/list. Search and Clear are withheld.',
        build: (w) =>
          histPage(w, {
            tools: false,
            body: [
              el(
                'div',
                { class: 'hist-empty', role: 'status' },
                el('p', {}, t('hist_error')),
                el(
                  'button',
                  { type: 'button', class: 'primary', 'data-control': 'history-try-again' },
                  t('hist_try_again'),
                ),
              ),
            ],
          }),
      },
    ],
  },
];

function confirmFrame(w: Width, searching: boolean): HTMLElement {
  const count = String(entries.length);
  const headingId = uid('confirm-h');
  const dialog = el(
    'dialog',
    { open: true, 'aria-labelledby': headingId, 'aria-modal': 'true' },
    el('h2', { id: headingId }, t('hist_confirm_title')),
    el('p', {}, t(searching ? 'hist_confirm_body_search' : 'hist_confirm_body', count)),
    el(
      'div',
      { class: 'dialog-actions' },
      el(
        'button',
        { type: 'button', class: 'focus-sim', 'data-control': 'history-confirm-cancel' },
        t('hist_confirm_cancel'),
      ),
      el(
        'button',
        { type: 'button', class: 'primary', 'data-control': 'history-confirm-clear' },
        t('hist_clear'),
      ),
    ),
  );
  return histPage(w, {
    search: searching ? 'sample' : '',
    body: groupedList({ entries }),
    dialog,
  });
}

// ---------- coverage ----------

const FIELDS: CoverageRow[] = [
  { field: 'id', where: 'Remove from history sends history/remove { entryId }', anyOf: ['id'] },
  { field: 'title', where: 'Row title (fallbacks: outputName, then host)', anyOf: ['title'] },
  { field: 'pageUrl', where: 'Site (host), Open page link, Details', anyOf: ['pageUrl'] },
  { field: 'outputName', where: 'Details; title fallback; audio glyph', anyOf: ['outputName'] },
  { field: 'kind', where: 'Details: format', anyOf: ['kind'] },
  { field: 'completedAt', where: 'Day group, time, sort key', anyOf: ['completedAt'] },
  { field: 'bytes', where: 'Size (hidden when 0)', anyOf: ['bytes'] },
  { field: 'status', where: '"Did not finish" tag on failed', anyOf: ['status'] },
];
const CONTROLS: CoverageRow[] = [
  {
    field: 'history/list',
    where: 'Every state; loading and error variants',
    anyOf: ['history-open-page'],
  },
  { field: 'history/remove', where: 'Remove from history', anyOf: ['history-remove'] },
  {
    field: 'history/clear',
    where: 'Clear history and its dialog',
    anyOf: ['history-confirm-clear'],
  },
  {
    field: 'Search (UI-only)',
    where: 'Search field and Clear search',
    anyOf: ['history-search', 'history-search-reset'],
  },
  { field: 'Try again', where: 'HIST-ERROR', anyOf: ['history-try-again'] },
  { field: 'Link to options page', where: 'Header', anyOf: ['nav-options'] },
];

await initI18n();
document.body.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('a[href="#"]')) e.preventDefault();
});
document.querySelector('#states')?.replaceWith(
  renderDoc({
    title: 'History page (low fidelity)',
    intro:
      'Issue #13, from docs/flows/options-history-ia.md §4. Frames are static snapshots at 1024px and 380px built from contract-shaped HistoryEntry data. State IDs and requests are annotated per frame; the text inside each frame follows the language chosen below. Declared controls per frame are checked on load.',
    page: 'history-states.html',
    sections: SECTIONS,
    coverage: (root) =>
      el(
        'div',
        {},
        coverageTable(
          root,
          'Coverage of IA §5.3 (HistoryEntry fields)',
          FIELDS,
          'field',
          'coverage',
        ),
        coverageTable(
          root,
          'Coverage of requests and controls',
          CONTROLS,
          'control',
          'coverage-requests',
        ),
      ),
  }),
);
document.documentElement.dataset['ready'] = 'true';
