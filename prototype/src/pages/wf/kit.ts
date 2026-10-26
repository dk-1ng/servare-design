// Shared helpers of the options and history wireframe pages (issue #13): DOM builder, the state
// figure with its annotations, and the control declaration check. Same convention as the popup
// wireframes (wireframe-states.ts): every rendered control carries `data-control`, each state
// declares the controls it shows, and the page throws when the declaration and the markup differ.
// Annotations are documentation in English (lang="en"); text inside a frame comes from _locales.

export type Child = Node | string | false | null | undefined;
export type Props = Record<string, string | boolean | undefined>;
export type Width = 1024 | 380;

export function el<K extends keyof HTMLElementTagNameMap>(
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

let counter = 0;
/** A document-unique id for label/description wiring. */
export const uid = (prefix: string): string => `${prefix}-${String(++counter)}`;

export interface State {
  id: string;
  /** State IDs of docs/flows/options-history-ia.md. */
  ids: string[];
  title: string;
  /** Controls rendered by every width unless `narrowControls` is given. */
  controls: string[];
  /** Controls at 380px when they differ (for example Back replaces the side panel). */
  narrowControls?: string[];
  /** Contract requests the state uses. */
  requests: string[];
  note?: string;
  widths?: Width[];
  build: (width: Width) => HTMLElement;
}

export interface Section {
  id: string;
  title: string;
  intro: string;
  states: State[];
}

function verify(s: State, width: Width, frame: HTMLElement): void {
  // Controls inside a closed <details> are in the DOM but not on screen; only its summary counts.
  const rendered = new Set(
    [...frame.querySelectorAll<HTMLElement>('[data-control]')]
      .filter((n) => n.tagName === 'SUMMARY' || n.closest('details:not([open])') === null)
      .map((n) => n.dataset['control'] ?? ''),
  );
  const declared = new Set(width === 380 && s.narrowControls ? s.narrowControls : s.controls);
  const missing = [...declared].filter((c) => !rendered.has(c));
  const extra = [...rendered].filter((c) => !declared.has(c));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `State ${s.id} at ${String(width)}px: declared but not rendered [${missing.join(', ')}]; rendered but not declared [${extra.join(', ')}]`,
    );
  }
}

const list = (items: string[]): string => (items.length > 0 ? items.join(', ') : 'none');

function figure(s: State): HTMLElement {
  const widths = s.widths ?? [1024, 380];
  const frames = widths.map((w) => {
    const frame = s.build(w);
    verify(s, w, frame);
    return el(
      'div',
      { class: 'frame-slot' },
      el('p', { class: 'frame-width' }, `${String(w)}px`),
      frame,
    );
  });
  const dl = el('dl', { class: 'anno' });
  const shows = s.controls.length > 0 ? list(s.controls) : 'none (read-only)';
  dl.append(el('dt', {}, 'Shows'), el('dd', {}, shows));
  if (s.narrowControls) dl.append(el('dt', {}, 'At 380px'), el('dd', {}, list(s.narrowControls)));
  dl.append(el('dt', {}, 'Requests'), el('dd', {}, list(s.requests)));
  if (s.note) dl.append(el('dt', {}, 'Notes'), el('dd', {}, s.note));
  return el(
    'figure',
    { class: 'state wide', id: s.id },
    el(
      'figcaption',
      {},
      el('h3', {}, s.title),
      el(
        'ul',
        { class: 'ids', 'aria-label': 'State IDs' },
        ...s.ids.map((id) => el('li', {}, el('code', {}, id))),
      ),
      dl,
    ),
    el('div', { class: 'pair' }, ...frames),
  );
}

export interface DocOptions {
  title: string;
  intro: string;
  /** Path of this page, for the language links. */
  page: string;
  sections: Section[];
  /** Coverage block built after all frames exist (and checked: it throws on a gap). */
  coverage: (root: HTMLElement) => HTMLElement;
}

export function renderDoc(o: DocOptions): HTMLElement {
  const lang = new URLSearchParams(location.search).get('lang') ?? 'en';
  const langLinks = ['en', 'pt_BR', 'pseudo'].map((l) =>
    el(
      'li',
      {},
      el(
        'a',
        { href: `wireframes/${o.page}?lang=${l}`, 'aria-current': l === lang ? 'page' : undefined },
        l,
      ),
    ),
  );
  const root = el(
    'div',
    { class: 'states-doc', lang: 'en' },
    el('h1', {}, o.title),
    el('p', {}, o.intro),
    el('ul', { class: 'langs', 'aria-label': 'Language of the frames' }, ...langLinks),
    el(
      'nav',
      { 'aria-label': 'Sections' },
      el(
        'ul',
        { class: 'toc' },
        ...o.sections.map((sec) =>
          el('li', {}, el('a', { href: `wireframes/${o.page}#${sec.id}` }, sec.title)),
        ),
        el('li', {}, el('a', { href: `wireframes/${o.page}#coverage` }, 'Coverage')),
      ),
    ),
    ...o.sections.map((sec) =>
      el(
        'section',
        { id: sec.id, 'aria-labelledby': `${sec.id}-h` },
        el('h2', { id: `${sec.id}-h` }, sec.title),
        el('p', {}, sec.intro),
        ...sec.states.map(figure),
      ),
    ),
  );
  root.append(o.coverage(root));
  return root;
}

/** Which states render each control or field, from the built page (`data-control` / `data-field`). */
export function usage(root: HTMLElement, attribute: 'control' | 'field'): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const fig of root.querySelectorAll<HTMLElement>('figure.state')) {
    for (const n of fig.querySelectorAll<HTMLElement>(`[data-${attribute}]`)) {
      const key = n.dataset[attribute] ?? '';
      map.set(key, (map.get(key) ?? new Set()).add(fig.id));
    }
  }
  return new Map([...map].map(([k, v]) => [k, [...v]]));
}

export interface CoverageRow {
  field: string;
  where: string;
  /** Any one of these names must be rendered. */
  anyOf: string[];
}

/** The coverage table; throws when a required field is rendered nowhere. */
export function coverageTable(
  root: HTMLElement,
  heading: string,
  rows: CoverageRow[],
  attribute: 'control' | 'field',
  id = 'coverage',
): HTMLElement {
  const used = usage(root, attribute);
  const body = rows.map((r) => {
    const states = new Set(r.anyOf.flatMap((n) => used.get(n) ?? []));
    if (states.size === 0) throw new Error(`Coverage: ${r.field} is rendered in no state`);
    return el(
      'tr',
      {},
      el('th', { scope: 'row' }, el('code', {}, r.field)),
      el('td', {}, r.where),
      el('td', {}, [...states].join(', ')),
    );
  });
  return el(
    'section',
    { id, 'aria-labelledby': `${id}-h` },
    el('h2', { id: `${id}-h` }, heading),
    el(
      'p',
      {},
      `${String(rows.length)} of ${String(rows.length)} required items rendered; the page throws if one is missing.`,
    ),
    el(
      'table',
      { class: 'coverage' },
      el(
        'thead',
        {},
        el(
          'tr',
          {},
          el('th', { scope: 'col' }, 'Field'),
          el('th', { scope: 'col' }, 'Control'),
          el('th', { scope: 'col' }, 'States'),
        ),
      ),
      el('tbody', {}, ...body),
    ),
  );
}
