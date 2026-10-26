// Low-fidelity wireframes of the options page and the site rules editor (issue #13), from
// docs/flows/options-history-ia.md. Static snapshots built from contract-shaped data (Settings,
// DomainRule, RulesDocument from the mock layer). Frames are drawn at 1024px and 380px inside
// containers, so the layout answers to the frame width (the real page will use media queries).
import { initI18n, languageTag, t } from '../i18n/index.ts';
import type { DomainRule, RulesDocument, Settings, SpeedProfile } from '../mock/index.ts';
import { buildScenario } from '../mock/scenarios.ts';
import {
  coverageTable,
  el,
  renderDoc,
  uid,
  type Child,
  type CoverageRow,
  type Props,
  type Section,
  type Width,
} from './wf/kit.ts';

// ---------- data (mock layer only) ----------

const scenario = buildScenario('many');
const settings: Settings = scenario.settings;
const rules: RulesDocument = scenario.rules;
/** More rules so the list passes the 10-rule threshold of the filter field (IA §3.2). */
const manyRules: RulesDocument = {
  version: 1,
  domains: {
    ...rules.domains,
    'clips.example.org': { speedProfile: 'fast' },
    'news.example.org': { detection: true },
    'tv.example.org': { audioOnly: false, speedProfile: 'economy' },
    'archive.example.net': {},
    'media.example.net': { hideFragments: true },
    'watch.example.io': { feedMode: true },
    'video.example.io': { minDirectSize: 1_048_576 },
    'docs.example.net': { audioOnly: true },
  },
};

// ---------- text helpers ----------

/** Fixed sample values. The date stays ISO on purpose: it ends up in a file name, where slashes are not allowed. */
const sample = (): Record<string, string> => ({
  title: t('opt_name_sample_title'),
  host: 'example.com',
  date: '2025-10-25',
  quality: '720p',
  lang: 'en',
});
const NAME_LIMIT = 180;

/** UI-side approximation of the file name (the background sanitizes; gap G19). */
function exampleName(template: string): string {
  const values = sample();
  const name = template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
  return `${name}.mp4`;
}

const speedName = (p: SpeedProfile): string => t(`opt_speed_${p}`);
const langName = (code: string): string =>
  new Intl.DisplayNames(languageTag(), { type: 'language' }).of(code) ?? code;

function sizeText(bytes: number): string {
  return bytes % 1_048_576 === 0
    ? `${String(bytes / 1_048_576)} ${t('opt_unit_mb')}`
    : `${String(Math.round(bytes / 1024))} ${t('opt_unit_kb')}`;
}

function ruleSummary(rule: DomainRule): string {
  const parts: string[] = [];
  if (rule.detection !== undefined)
    parts.push(t(rule.detection ? 'opt_sum_detection_on' : 'opt_sum_detection_off'));
  if (rule.audioOnly !== undefined)
    parts.push(t(rule.audioOnly ? 'opt_sum_audio_on' : 'opt_sum_audio_off'));
  if (rule.speedProfile !== undefined) parts.push(t('opt_sum_speed', speedName(rule.speedProfile)));
  if (rule.minDirectSize !== undefined)
    parts.push(t('opt_sum_minsize', sizeText(rule.minDirectSize)));
  if (rule.hideFragments !== undefined)
    parts.push(t(rule.hideFragments ? 'opt_sum_hide_on' : 'opt_sum_hide_off'));
  if (rule.feedMode !== undefined)
    parts.push(t(rule.feedMode ? 'opt_sum_feed_on' : 'opt_sum_feed_off'));
  if (rule.propagateQuery !== undefined)
    parts.push(t(rule.propagateQuery ? 'opt_sum_query_on' : 'opt_sum_query_off'));
  return parts.length > 0 ? parts.join(' · ') : t('opt_rules_defaults');
}

/** Subdomains sort under their parent: compare the reversed labels. */
const domainOrder = (d: string): string => d.split('.').reverse().join('.');

/** Longest other domain that this one is a subdomain of (UI-derived, IA §3.2 Overlap). */
function parentOf(domain: string, all: string[]): string | undefined {
  return all
    .filter((d) => domain.endsWith(`.${d}`))
    .sort((a, b) => b.length - a.length)
    .at(0);
}

// ---------- frame chrome ----------

function win(width: Width, ...children: Child[]): HTMLElement {
  return el('div', { class: `win w${String(width)}`, lang: languageTag() }, ...children);
}

const SECTION_KEYS = ['files', 'languages', 'speed', 'mp3', 'rules', 'advanced'] as const;

function nav(): HTMLElement {
  return el(
    'nav',
    { class: 'opt-nav', 'aria-label': t('opt_nav_label'), 'data-control': 'nav' },
    el(
      'ul',
      {},
      ...SECTION_KEYS.map((k) =>
        el(
          'li',
          {},
          el('a', { href: '#', class: k === 'files' ? 'current' : undefined }, t(`opt_sec_${k}`)),
        ),
      ),
      el('li', { class: 'to-history' }, el('a', { href: '#' }, t('opt_nav_history'))),
    ),
  );
}

interface PageOptions {
  /** Draw the navigation and the page heading (full page frames). */
  chrome?: boolean;
  saved?: boolean;
}

function page(width: Width, sections: HTMLElement[], o: PageOptions = {}): HTMLElement {
  const saved = el(
    'p',
    { class: 'saved', role: 'status', 'data-control': 'saved-region' },
    o.saved ? t('opt_saved') : '',
  );
  return win(
    width,
    el(
      'div',
      { class: o.chrome ? 'opt-layout' : 'opt-layout bare' },
      o.chrome && nav(),
      el(
        'main',
        { class: 'opt-main' },
        o.chrome && el('h1', {}, t('opt_title')),
        saved,
        ...sections,
      ),
    ),
  );
}

function section(titleKey: string, body: Child[], restore = true): HTMLElement {
  return el(
    'section',
    { class: 'sec' },
    el('h2', {}, t(titleKey)),
    ...body,
    restore &&
      el(
        'p',
        { class: 'sec-foot' },
        el(
          'button',
          { type: 'button', class: 'quiet', 'data-control': 'restore-defaults' },
          t('opt_restore'),
        ),
      ),
  );
}

// ---------- field builders ----------

interface TextOptions {
  label: string;
  value: string;
  control: string;
  help?: string | undefined;
  error?: string | undefined;
  type?: string;
  extra?: Props;
  /** Ids of further descriptions (appended after help and error). */
  describedBy?: string[];
  after?: Child[];
}

function textField(o: TextOptions): HTMLElement {
  const id = uid('f');
  const describedBy = [
    o.help ? `${id}-help` : '',
    o.error ? `${id}-err` : '',
    ...(o.describedBy ?? []),
  ].filter(Boolean);
  return el(
    'div',
    { class: o.error ? 'field invalid' : 'field' },
    el('label', { for: id }, o.label),
    el('input', {
      id,
      type: o.type ?? 'text',
      value: o.value,
      'data-control': o.control,
      'aria-invalid': o.error ? 'true' : undefined,
      'aria-describedby': describedBy.length > 0 ? describedBy.join(' ') : undefined,
      ...o.extra,
    }),
    ...(o.after ?? []),
    o.help && el('p', { class: 'help', id: `${id}-help` }, o.help),
    o.error && el('p', { class: 'error', id: `${id}-err` }, o.error),
  );
}

interface Choice {
  value: string;
  label: string;
  desc?: string;
}

function radioGroup(
  name: string,
  legend: string,
  control: string,
  choices: Choice[],
  checked: string,
  help?: string,
): HTMLElement {
  const group = uid(name);
  return el(
    'fieldset',
    {
      class: 'radios',
      'data-control': control,
      'aria-describedby': help ? `${group}-help` : undefined,
    },
    el('legend', { class: 'sr-only' }, legend),
    ...choices.map((c) =>
      el(
        'label',
        { class: 'choice' },
        el('input', { type: 'radio', name: group, value: c.value, checked: c.value === checked }),
        el('span', {}, el('strong', {}, c.label), c.desc && el('span', { class: 'desc' }, c.desc)),
      ),
    ),
    help && el('p', { class: 'help', id: `${group}-help` }, help),
  );
}

// ---------- section 1: saving files ----------

function filesSection(s: Settings, errors: { name?: boolean } = {}): HTMLElement {
  const length = s.nameTemplate.length;
  const over = length > NAME_LIMIT;
  const vars = [
    ['title', 'opt_var_title'],
    ['host', 'opt_var_host'],
    ['date', 'opt_var_date'],
    ['quality', 'opt_var_quality'],
    ['lang', 'opt_var_lang'],
  ] as const;
  const counterId = uid('count');
  const nameField = textField({
    label: t('opt_name_label'),
    value: s.nameTemplate,
    control: 'nameTemplate',
    help: t('opt_name_help'),
    error: errors.name ? t('opt_name_too_long') : undefined,
    describedBy: [counterId],
    after: [
      el(
        'div',
        {
          class: 'pieces',
          role: 'group',
          'aria-label': t('opt_name_pieces'),
          'data-control': 'nameTemplate-variables',
        },
        ...vars.map(([, key]) =>
          el('button', { type: 'button', 'aria-label': t('opt_var_add', t(key)) }, t(key)),
        ),
      ),
      el('p', { class: 'example' }, t('opt_name_example', exampleName(s.nameTemplate))),
      el(
        'p',
        { class: over ? 'counter over' : 'counter', id: counterId },
        t('opt_name_counter', String(length)),
      ),
    ],
  });
  return section('opt_sec_files', [
    nameField,
    textField({
      label: t('opt_subfolder_label'),
      value: s.subfolder,
      control: 'subfolder',
      help: t('opt_subfolder_help'),
    }),
    el(
      'label',
      { class: 'choice' },
      el('input', { type: 'checkbox', checked: s.saveAs, 'data-control': 'saveAs' }),
      el('span', {}, el('strong', {}, t('opt_saveas_label'))),
    ),
  ]);
}

// ---------- section 2: languages ----------

function languagesSection(s: Settings): HTMLElement {
  const langs = s.preferredLanguages;
  const picker = uid('add');
  const body =
    langs.length === 0
      ? el(
          'div',
          { class: 'lang-empty', 'data-control': 'preferredLanguages' },
          el('p', {}, t('opt_lang_empty')),
          el(
            'button',
            { type: 'button', 'data-control': 'preferredLanguages-browser' },
            t('opt_lang_browser'),
          ),
        )
      : el(
          'ol',
          { class: 'langs-list', 'data-control': 'preferredLanguages' },
          ...langs.map((code, i) =>
            el(
              'li',
              {},
              el('span', { class: 'lang-name' }, langName(code)),
              el(
                'span',
                { class: 'row-actions' },
                el('button', {
                  type: 'button',
                  'aria-label': t('opt_lang_up', langName(code)),
                  'data-control': 'preferredLanguages-move',
                  'data-glyph': 'up',
                  disabled: i === 0,
                }),
                el('button', {
                  type: 'button',
                  'aria-label': t('opt_lang_down', langName(code)),
                  'data-control': 'preferredLanguages-move',
                  'data-glyph': 'down',
                  disabled: i === langs.length - 1,
                }),
                el('button', {
                  type: 'button',
                  'aria-label': t('opt_lang_remove', langName(code)),
                  'data-control': 'preferredLanguages-remove',
                  'data-glyph': 'remove',
                }),
              ),
            ),
          ),
        );
  return section('opt_sec_languages', [
    el(
      'div',
      { class: 'field' },
      el('p', { class: 'label' }, t('opt_lang_label')),
      el('p', { class: 'help' }, t('opt_lang_help')),
      body,
      el(
        'div',
        { class: 'add-row' },
        el('label', { for: picker }, t('opt_lang_add_label')),
        el(
          'select',
          { id: picker },
          ...['fr', 'de', 'es', 'it', 'ja'].map((c) => el('option', { value: c }, langName(c))),
        ),
        el(
          'button',
          { type: 'button', 'data-control': 'preferredLanguages-add' },
          t('opt_lang_add'),
        ),
      ),
    ),
  ]);
}

// ---------- sections 3 and 4: speed and MP3 ----------

function speedSection(s: Settings): HTMLElement {
  const choices: Choice[] = (['economy', 'standard', 'fast'] as const).map((p) => ({
    value: p,
    label: speedName(p),
    desc: t(`opt_speed_${p}_desc`),
  }));
  return section('opt_sec_speed', [
    radioGroup(
      'speed',
      t('opt_sec_speed'),
      'speedProfile',
      choices,
      s.speedProfile,
      t('opt_speed_help'),
    ),
  ]);
}

function mp3Section(s: Settings): HTMLElement {
  const presets: Choice[] = [
    { value: '0', label: t('opt_mp3_best'), desc: t('opt_mp3_best_desc') },
    { value: '2', label: t('opt_mp3_high'), desc: t('opt_mp3_high_desc') },
    { value: '5', label: t('opt_mp3_small'), desc: t('opt_mp3_small_desc') },
  ];
  const custom = !presets.some((p) => p.value === String(s.mp3Quality));
  if (custom)
    presets.push({ value: String(s.mp3Quality), label: t('opt_mp3_custom', String(s.mp3Quality)) });
  return section('opt_sec_mp3', [
    radioGroup(
      'mp3',
      t('opt_sec_mp3'),
      'mp3Quality',
      presets,
      String(s.mp3Quality),
      t('opt_mp3_help'),
    ),
  ]);
}

// ---------- section 6: advanced ----------

function advancedSection(s: Settings, errors: { threshold?: string } = {}): HTMLElement {
  const slider = uid('mp3');
  const percent = errors.threshold ?? String(Math.round(s.failureThreshold * 100));
  return section('opt_sec_advanced', [
    el(
      'details',
      { open: true, class: 'disclosure' },
      el('summary', { 'data-control': 'advanced-disclosure' }, t('opt_adv_summary')),
      el(
        'div',
        { class: 'field' },
        el('label', { for: slider }, t('opt_adv_mp3_label')),
        el('input', {
          id: slider,
          type: 'range',
          min: '0',
          max: '9',
          step: '1',
          value: String(s.mp3Quality),
          'data-control': 'mp3Quality-slider',
        }),
        el(
          'p',
          { class: 'ends' },
          el('span', {}, t('opt_mp3_best')),
          el('output', {}, t('opt_adv_mp3_value', String(s.mp3Quality))),
          el('span', {}, t('opt_adv_mp3_smallest')),
        ),
      ),
      textField({
        label: t('opt_fail_label'),
        value: percent,
        control: 'failureThreshold',
        type: 'number',
        extra: { min: '0', max: '100', step: '1', class: 'short' },
        after: [el('span', { class: 'unit' }, t('opt_fail_unit'))],
        help: t('opt_fail_help'),
        error: errors.threshold ? t('opt_fail_error') : undefined,
      }),
    ),
  ]);
}

// ---------- section 5: site rules ----------

interface RulesView {
  doc: RulesDocument;
  /** Rule shown selected while its editor is open. */
  selected?: string;
  readOnly?: boolean;
  undo?: string;
  /** Domains hidden because they were just removed. */
  removed?: string[];
}

function ruleList(v: RulesView): HTMLElement {
  const domains = Object.keys(v.doc.domains)
    .filter((d) => !v.removed?.includes(d))
    .sort((a, b) => domainOrder(a).localeCompare(domainOrder(b)));
  const filter = domains.length > 10;
  const filterId = uid('rules-filter');
  return el(
    'div',
    { class: 'rules' },
    filter &&
      el(
        'div',
        { class: 'field' },
        el('label', { for: filterId }, t('opt_rules_filter')),
        el('input', { id: filterId, type: 'search', 'data-control': 'rules-filter' }),
      ),
    el(
      'ul',
      { class: 'rule-list', 'aria-label': t('opt_rules_list_label') },
      ...domains.map((d) => {
        const parent = parentOf(d, domains);
        const rule = v.doc.domains[d] ?? {};
        return el(
          'li',
          { class: d === v.selected ? 'rule selected' : 'rule' },
          el(
            'div',
            { class: 'rule-main' },
            el('strong', {}, d),
            el('span', { class: 'summary' }, ruleSummary(rule)),
            parent && el('span', { class: 'also' }, t('opt_rules_also', parent)),
          ),
          !v.readOnly &&
            el(
              'div',
              { class: 'row-actions' },
              el(
                'button',
                {
                  type: 'button',
                  'aria-label': t('opt_rules_edit_aria', d),
                  'data-control': 'rules-edit',
                },
                t('opt_rules_edit'),
              ),
              el(
                'button',
                {
                  type: 'button',
                  'aria-label': t('opt_rules_remove_aria', d),
                  'data-control': 'rules-remove',
                },
                t('opt_rules_remove'),
              ),
            ),
        );
      }),
    ),
  );
}

function toast(site: string): HTMLElement {
  return el(
    'div',
    { class: 'toast', role: 'status' },
    el('span', {}, t('opt_rules_removed', site)),
    el('button', { type: 'button', 'data-control': 'rules-undo' }, t('opt_rules_undo')),
  );
}

function tri(labelKey: string, key: string, value: boolean | undefined): HTMLElement {
  const id = uid('r');
  const current = value === undefined ? '' : value ? 'on' : 'off';
  return el(
    'div',
    { class: 'field inline' },
    el('label', { for: id }, t(labelKey)),
    el(
      'select',
      { id, 'data-control': `rule-${key}` },
      ...(
        [
          ['', 'opt_tri_default'],
          ['on', 'opt_tri_on'],
          ['off', 'opt_tri_off'],
        ] as const
      ).map(([v, k]) => el('option', { value: v, selected: v === current }, t(k))),
    ),
  );
}

interface EditorOptions {
  domain: string;
  /** New rule: what the user typed, its normalized form and an error. */
  typed?: { raw: string; normalized: string; error?: boolean };
  rule: DomainRule;
  width: Width;
}

function ruleEditor(o: EditorOptions): HTMLElement {
  const isNew = o.typed !== undefined;
  const headingId = uid('editor-h');
  const speedId = uid('r');
  const sizeId = uid('r');
  const hasAdvanced = ['minDirectSize', 'hideFragments', 'feedMode', 'propagateQuery'].some(
    (k) => k in o.rule,
  );
  const unitKb = o.rule.minDirectSize !== undefined && o.rule.minDirectSize % 1_048_576 !== 0;
  const sizeValue =
    o.rule.minDirectSize === undefined
      ? ''
      : String(unitKb ? Math.round(o.rule.minDirectSize / 1024) : o.rule.minDirectSize / 1_048_576);
  const domainField = isNew
    ? textField({
        label: t('opt_edit_domain'),
        value: o.typed?.raw ?? '',
        control: 'rule-domain',
        help: t('opt_edit_domain_help'),
        error: o.typed?.error ? t('opt_edit_domain_error') : undefined,
        after: o.typed?.error
          ? []
          : [
              el(
                'p',
                { class: 'preview' },
                t('opt_edit_domain_preview', o.typed?.normalized ?? ''),
              ),
            ],
      })
    : textField({
        label: t('opt_edit_domain'),
        value: o.domain,
        control: 'rule-domain',
        help: t('opt_edit_domain_help'),
        extra: { readonly: true },
      });
  return el(
    'section',
    { class: 'panel', 'aria-labelledby': headingId },
    o.width === 380 &&
      el(
        'button',
        { type: 'button', class: 'back', 'data-control': 'rule-back' },
        t('opt_edit_back'),
      ),
    el(
      'h3',
      { id: headingId },
      isNew ? t('opt_edit_title_new') : t('opt_edit_title_existing', o.domain),
    ),
    domainField,
    tri('opt_key_detection', 'detection', o.rule.detection),
    tri('opt_key_audioonly', 'audioOnly', o.rule.audioOnly),
    el(
      'div',
      { class: 'field inline' },
      el('label', { for: speedId }, t('opt_key_speed')),
      el(
        'select',
        { id: speedId, 'data-control': 'rule-speedProfile' },
        el(
          'option',
          { value: '', selected: o.rule.speedProfile === undefined },
          t('opt_speed_same', speedName(settings.speedProfile)),
        ),
        ...(['economy', 'standard', 'fast'] as const).map((p) =>
          el('option', { value: p, selected: o.rule.speedProfile === p }, speedName(p)),
        ),
      ),
    ),
    el(
      'details',
      { class: 'disclosure', open: hasAdvanced },
      el('summary', { 'data-control': 'rule-more' }, t('opt_edit_more')),
      el(
        'div',
        { class: 'field inline' },
        el('label', { for: sizeId }, t('opt_key_minsize')),
        el(
          'span',
          { class: 'size' },
          el('input', {
            id: sizeId,
            type: 'number',
            min: '0',
            value: sizeValue,
            placeholder: t('opt_minsize_placeholder'),
            'data-control': 'rule-minDirectSize',
            class: 'short',
          }),
          el(
            'select',
            { 'aria-label': t('opt_unit_label') },
            el('option', { value: 'kb', selected: unitKb }, t('opt_unit_kb')),
            el('option', { value: 'mb', selected: !unitKb }, t('opt_unit_mb')),
          ),
        ),
      ),
      tri('opt_key_hide', 'hideFragments', o.rule.hideFragments),
      tri('opt_key_feed', 'feedMode', o.rule.feedMode),
      tri('opt_key_query', 'propagateQuery', o.rule.propagateQuery),
    ),
    el(
      'p',
      { class: 'sec-foot' },
      el(
        'button',
        { type: 'button', class: 'primary', 'data-control': 'rule-save' },
        t('opt_edit_save'),
      ),
      el('button', { type: 'button', 'data-control': 'rule-cancel' }, t('opt_edit_cancel')),
    ),
  );
}

/** Site rules section. Wide: the editor is a panel next to the list. Narrow: it replaces the list. */
function rulesSection(
  width: Width,
  v: RulesView,
  editor?: HTMLElement,
  notice?: boolean,
): HTMLElement {
  const empty = Object.keys(v.doc.domains).length === 0;
  const add =
    !v.readOnly &&
    el('button', { type: 'button', 'data-control': 'rules-add' }, t('opt_rules_add'));
  const listing = empty
    ? el('div', { class: 'empty' }, el('p', {}, t('opt_rules_empty')), add)
    : el('div', {}, ruleList(v), add && el('p', {}, add));
  const body =
    editor && width === 380
      ? [editor]
      : [
          el(
            'div',
            { class: editor ? 'rules-split' : undefined },
            el('div', {}, listing, v.undo && toast(v.undo)),
            editor,
          ),
        ];
  return section(
    'opt_sec_rules',
    [
      !(editor && width === 380) && el('p', { class: 'help' }, t('opt_rules_intro')),
      notice && el('p', { class: 'notice', role: 'note' }, t('opt_rules_unknown_version')),
      ...body,
    ],
    false,
  );
}

// ---------- declarations ----------

const FILES = ['nameTemplate', 'nameTemplate-variables', 'subfolder', 'saveAs', 'restore-defaults'];
const LANGS = [
  'preferredLanguages',
  'preferredLanguages-add',
  'preferredLanguages-move',
  'preferredLanguages-remove',
  'restore-defaults',
];
const LANGS_EMPTY = [
  'preferredLanguages',
  'preferredLanguages-add',
  'preferredLanguages-browser',
  'restore-defaults',
];
const SPEED = ['speedProfile', 'restore-defaults'];
const MP3 = ['mp3Quality', 'restore-defaults'];
const ADVANCED = [
  'advanced-disclosure',
  'mp3Quality-slider',
  'failureThreshold',
  'restore-defaults',
];
const LIST = ['rules-add', 'rules-edit', 'rules-remove'];
const EDITOR = [
  'rule-domain',
  'rule-detection',
  'rule-audioOnly',
  'rule-speedProfile',
  'rule-more',
  'rule-save',
  'rule-cancel',
];
const EDITOR_ADV = [
  'rule-minDirectSize',
  'rule-hideFragments',
  'rule-feedMode',
  'rule-propagateQuery',
];

const uniq = (...lists: string[][]): string[] => [...new Set(lists.flat())];
const withBack = (c: string[]): string[] => [...c, 'rule-back'];

const longTemplate = '{title} - {host} - '.repeat(10);

const SECTIONS: Section[] = [
  {
    id: 'settings',
    title: 'Settings sections',
    intro:
      'Not drawn here, deferred to D4: the unknown-request case (the Site rules section and its link are hidden) and the free BCP 47 code entry in the add step. Six sections in the order of IA §2.1. Settings save on change, one field at a time (settings/set); there is no Save button. The "Saved" line is a polite live region. Navigation anchors are inert in these static frames.',
    states: [
      {
        id: 'opt-page',
        ids: ['OPT-PAGE'],
        title: 'Options page, every section and field',
        controls: uniq(['nav', 'saved-region'], FILES, LANGS, SPEED, MP3, ADVANCED, LIST),
        requests: ['settings/get', 'settings/set', 'rules/get'],
        note: 'Side navigation at 1024px, a single row above the content at 380px (the layout answers to the frame width here; the real page uses a media query near 720px). Advanced is drawn open to show its fields; it is closed by default and its state is remembered locally. Each section has its own Restore defaults (the Site rules section has none: it has its own Remove).',
        build: (w) =>
          page(
            w,
            [
              filesSection(settings),
              languagesSection(settings),
              speedSection(settings),
              mp3Section(settings),
              rulesSection(w, { doc: rules }),
              advancedSection(settings),
            ],
            { chrome: true, saved: true },
          ),
      },
      {
        id: 'opt-invalid',
        ids: ['OPT-INVALID-PAYLOAD'],
        title: 'invalid-payload: errors beside the field',
        controls: uniq(['saved-region'], FILES, MP3, ADVANCED),
        requests: ['settings/set (rejected with invalid-payload)'],
        note: 'The background answers invalid-payload with issue paths; each path maps to its field: inline error linked by aria-describedby, aria-invalid, focus stays, the typed text stays and the stored value is unchanged. Shown: nameTemplate over 180 characters (counter turns into an error, the example line keeps showing the typed value) and failureThreshold outside 0-100. The same frame shows a stored mp3Quality (4) that is not a preset: a fourth radio "Custom (level 4)" and the slider at 4. The "Saved" region stays empty.',
        build: (w) =>
          page(w, [
            filesSection({ ...settings, nameTemplate: longTemplate }, { name: true }),
            mp3Section({ ...settings, mp3Quality: 4 }),
            advancedSection({ ...settings, mp3Quality: 4 }, { threshold: '150' }),
          ]),
      },
      {
        id: 'opt-loading',
        ids: ['OPT-LOADING'],
        title: 'Loading',
        controls: ['nav', 'saved-region'],
        requests: ['settings/get', 'rules/get'],
        note: 'Skeleton placeholder in the content area while the two requests are pending (aria-busy). No section shows a value the background did not return.',
        build: (w) =>
          page(
            w,
            [
              el(
                'div',
                {
                  class: 'skeleton-rows',
                  'aria-busy': 'true',
                  role: 'status',
                  'aria-label': t('opt_loading'),
                },
                ...[0, 1, 2].map(() =>
                  el('div', { class: 'skeleton-row' }, el('i'), el('i'), el('i'), el('i')),
                ),
              ),
            ],
            { chrome: true },
          ),
      },
      {
        id: 'opt-error',
        ids: ['OPT-ERROR'],
        title: 'Request failure',
        controls: ['nav', 'saved-region', 'opt-try-again'],
        requests: ['settings/get (rejected, for example timeout)'],
        note: 'The F8 request-failure pattern: calm message and a concrete action. Try again repeats the failed requests. Other failure codes on settings/set use the same pattern next to the field; invalid-payload has its own frame above.',
        build: (w) =>
          page(
            w,
            [
              el(
                'div',
                { class: 'empty', role: 'status' },
                el('p', {}, t('opt_error')),
                el(
                  'button',
                  { type: 'button', class: 'primary', 'data-control': 'opt-try-again' },
                  t('opt_try_again'),
                ),
              ),
            ],
            { chrome: true },
          ),
      },
      {
        id: 'opt-lang-empty',
        ids: ['OPT-LANGUAGES-EMPTY'],
        title: 'preferredLanguages empty',
        controls: uniq(['saved-region'], LANGS_EMPTY),
        requests: ['settings/set'],
        note: '"Use my browser languages" fills the list from navigator.languages (local). The add control is a short list of language names here; free BCP 47 entry in an Advanced part of the add step is not drawn (low fidelity).',
        build: (w) => page(w, [languagesSection({ ...settings, preferredLanguages: [] })]),
      },
    ],
  },
  {
    id: 'site-rules',
    title: 'Site rules',
    intro:
      'Not drawn here, deferred to D4: "This rule changes nothing. Remove it?" on Save, the unsaved-changes prompt when leaving the editor, and adding a domain that already has a rule (the editor opens that rule). Section 5 and the rule editor (IA §3). Each domain is one unit: the editor reads the whole rule, edits a copy and writes it with rules/set. Default means the key is absent.',
    states: [
      {
        id: 'rules-empty',
        ids: ['RULES-EMPTY'],
        title: 'No rules yet',
        controls: ['saved-region', 'rules-add'],
        requests: ['rules/get'],
        build: (w) => page(w, [rulesSection(w, { doc: { version: 1, domains: {} } })]),
      },
      {
        id: 'rules-list',
        ids: ['RULES-LIST'],
        title: 'Rules list with filter and Undo toast',
        controls: uniq(['saved-region', 'rules-filter', 'rules-undo'], LIST),
        requests: ['rules/get', 'rules/remove', 'rules/set (Undo restores the removed rule)'],
        note: 'Sorted by domain with subdomains under their parent; the row of video.example.com says "Also covered by example.com" without saying which rule wins (G18). The filter appears above 10 rules (eleven here). Each row summarizes only the keys that are set; an empty rule reads "Uses defaults". The toast follows a Remove: a status region, about 8 seconds, no timeout while focused, Undo reachable by keyboard.',
        build: (w) =>
          page(w, [
            rulesSection(w, {
              doc: manyRules,
              removed: ['archive.example.net'],
              undo: 'archive.example.net',
            }),
          ]),
      },
      {
        id: 'rule-edit-new',
        ids: ['RULE-EDIT (new)'],
        title: 'New rule: normalized site preview',
        controls: uniq(['saved-region'], LIST, EDITOR),
        narrowControls: uniq(['saved-region'], withBack(EDITOR)),
        requests: ['rules/set (on Save)'],
        note: 'The user pasted a full address; the UI trims, lowercases and strips scheme, path and port, and shows the result before Save. All keys start at Default. "More options for this site" is closed; its fields are listed in the existing-rule frame. At 380px the editor replaces the list and Back returns to it. Esc cancels; focus returns to Add (or the row).',
        build: (w) =>
          page(w, [
            rulesSection(
              w,
              { doc: rules },
              ruleEditor({
                domain: '',
                typed: { raw: 'https://www.Example.com/watch?v=1', normalized: 'www.example.com' },
                rule: {},
                width: w,
              }),
            ),
          ]),
      },
      {
        id: 'rule-edit-error',
        ids: ['RULE-EDIT (new)', 'NET-INVALID-PAYLOAD'],
        title: 'New rule: invalid site',
        controls: uniq(['saved-region'], LIST, EDITOR),
        narrowControls: uniq(['saved-region'], withBack(EDITOR)),
        requests: ['rules/set (rejected with invalid-payload)'],
        note: 'The background validates the domain (accepted forms: G18). The error sits under the site field and the preview is replaced by it; the typed text stays. Same place for errors on any other key of the rule.',
        build: (w) =>
          page(w, [
            rulesSection(
              w,
              { doc: rules },
              ruleEditor({
                domain: '',
                typed: { raw: 'not a site', normalized: '', error: true },
                rule: {},
                width: w,
              }),
            ),
          ]),
      },
      {
        id: 'rule-edit-existing',
        ids: ['RULE-EDIT (existing)'],
        title: 'Existing rule: every key',
        controls: uniq(['saved-region'], LIST, EDITOR, EDITOR_ADV),
        narrowControls: uniq(['saved-region'], withBack(EDITOR), EDITOR_ADV),
        requests: ['rules/set (on Save)', 'rules/remove (from the list)'],
        note: 'The site is read-only (renaming is remove and add). The rule sets an advanced key, so "More options for this site" opens by itself. Default / On / Off are native selects; speed offers "Same as general setting (Standard)" reading Settings.speedProfile; minimum size is a number with a KB/MB unit and is stored in bytes. Choosing Default deletes the key from the rule on Save.',
        build: (w) =>
          page(w, [
            rulesSection(
              w,
              { doc: rules, selected: 'news.example.net' },
              ruleEditor({
                domain: 'news.example.net',
                rule: rules.domains['news.example.net'] ?? {},
                width: w,
              }),
            ),
          ]),
      },
      {
        id: 'rules-unknown-version',
        ids: ['RULES-UNKNOWN-VERSION'],
        title: 'Unknown rules version: read-only',
        controls: ['saved-region'],
        requests: ['rules/get (version other than 1)'],
        note: 'The list is shown without Add, Edit or Remove, with a notice; the page never writes rules it cannot read. If rules/* answers unknown-request, the section and its navigation link are hidden instead.',
        build: (w) => page(w, [rulesSection(w, { doc: rules, readOnly: true }, undefined, true)]),
      },
    ],
  },
];

// ---------- coverage ----------

const COVERAGE: CoverageRow[] = [
  {
    field: 'Settings.nameTemplate',
    where: 'Saving files: text field, variable buttons, example, counter',
    anyOf: ['nameTemplate'],
  },
  { field: 'Settings.subfolder', where: 'Saving files: text field', anyOf: ['subfolder'] },
  { field: 'Settings.saveAs', where: 'Saving files: checkbox', anyOf: ['saveAs'] },
  {
    field: 'Settings.preferredLanguages',
    where: 'Languages: ordered list, add, move, remove, empty state',
    anyOf: ['preferredLanguages-move'],
  },
  { field: 'Settings.speedProfile', where: 'Download speed: radio group', anyOf: ['speedProfile'] },
  {
    field: 'Settings.mp3Quality (presets)',
    where: 'Audio only: presets and Custom',
    anyOf: ['mp3Quality'],
  },
  {
    field: 'Settings.mp3Quality (exact)',
    where: 'Advanced: slider 0-9',
    anyOf: ['mp3Quality-slider'],
  },
  {
    field: 'Settings.failureThreshold',
    where: 'Advanced: percent field',
    anyOf: ['failureThreshold'],
  },
  {
    field: 'DomainRule.detection',
    where: 'Editor main: Default / On / Off',
    anyOf: ['rule-detection'],
  },
  {
    field: 'DomainRule.audioOnly',
    where: 'Editor main: Default / On / Off',
    anyOf: ['rule-audioOnly'],
  },
  {
    field: 'DomainRule.speedProfile',
    where: 'Editor main: Same as general setting / three profiles',
    anyOf: ['rule-speedProfile'],
  },
  {
    field: 'DomainRule.minDirectSize',
    where: 'Editor, more options: number and unit',
    anyOf: ['rule-minDirectSize'],
  },
  {
    field: 'DomainRule.hideFragments',
    where: 'Editor, more options: Default / On / Off',
    anyOf: ['rule-hideFragments'],
  },
  {
    field: 'DomainRule.feedMode',
    where: 'Editor, more options: Default / On / Off',
    anyOf: ['rule-feedMode'],
  },
  {
    field: 'DomainRule.propagateQuery',
    where: 'Editor, more options: Default / On / Off',
    anyOf: ['rule-propagateQuery'],
  },
  {
    field: 'rules/get, rules/set, rules/remove',
    where: 'List, editor Save, row Remove and Undo',
    anyOf: ['rules-edit', 'rule-save', 'rules-remove', 'rules-undo'],
  },
  {
    field: 'Per-section Restore defaults',
    where: 'Sections 1-4 and 6',
    anyOf: ['restore-defaults'],
  },
  { field: 'Saved live region', where: 'Top of the content', anyOf: ['saved-region'] },
  { field: 'Navigation (side / row)', where: 'Full page frame', anyOf: ['nav'] },
];

await initI18n();
document.body.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('a[href="#"]')) e.preventDefault();
});
document.querySelector('#states')?.replaceWith(
  renderDoc({
    title: 'Options page and site rules (low fidelity)',
    intro:
      'Issue #13, from docs/flows/options-history-ia.md. Frames are static snapshots at 1024px and 380px. State IDs and requests are annotated per frame; the text inside each frame follows the language chosen below, everything around it is documentation in English. Required controls per frame are declared in code and the page throws when markup and declaration differ.',
    page: 'options-states.html',
    sections: SECTIONS,
    coverage: (root) => coverageTable(root, 'Coverage of IA §5.1 and §5.2', COVERAGE, 'control'),
  }),
);
document.documentElement.dataset['ready'] = 'true';
