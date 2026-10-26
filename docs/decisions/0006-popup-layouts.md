# 0006. Popup main view: row anatomy and where choices live

- Status: proposed
- Date: 2026-10-25
- Issue: #11

## Context

[ADR 0005](0005-popup-structure.md) fixed the structure: a main view (this page's media, job status inline), an item view, a Downloads view and a header. It left the main view's **row anatomy** open, and asked #11 to test the tightest spot, the compact action line, at +40% text, including whether the short `ERR-HTTP-AUTH` next step fits.

Three throwaway grayscale wireframes at 380px, running on the mock client (`prototype/wireframes/popup-{a,b,c}.html`, one script, `prototype/src/pages/wireframe-popup.ts`). Scenes (`?scene=`): `one`, `bare` (no title, no thumbnail, `duration: 0`), `many` (12 items), `choices` (quality, audio, subtitles, audio only), `active` (running, queued-waiting, paused, live "Stop and keep" apart from Cancel, failed `ERR-HTTP-AUTH`, protected), `item`, `downloads`. Add `&lang=pseudo` for +40% text. Screenshots: [`assets/0006-popup-layouts/`](assets/0006-popup-layouts/), named `<variant>-<scene>[-pseudo].png`; regenerate with `scripts/wireframe-shots.ts`.

| Variant | Row                                                                                                         | Choices                                                                                    |
| ------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **A**   | 48px thumbnail spanning two lines: identity (title, duration or status) and action line.                    | Expand inside the row, as radio groups ([progressive disclosure](../process.md#glossary)). |
| **B**   | Same row as A.                                                                                              | Open the item view (ADR 0005 as written); the list is replaced.                            |
| **C**   | Thumbnail-led: 72px thumbnail beside a two-line title and meta; the action line takes the full 348px below. | Expand inside the row, as compact selects.                                                 |

All three keep a job's controls on the action line: Pause or Resume and Cancel, plus "Stop and keep" for live, with Cancel pushed to the far end and dashed so it never sits next to Stop. Once a job owns the action line, Choices becomes an icon-only button (accessible name "Choices", 28×28) at its end.

## Findings

Measured in Chromium at 380px (row heights in px; `en` unless noted).

| Criterion                                              | A                                                                                             | B                                                                     | C                                                           |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| Idle row height; items visible in 600px (12 scroll)    | 67; about 7                                                                                   | 67; about 7                                                           | 96; about 5                                                 |
| Choices, dash sample (4 quality, 3 audio, 3 subs)      | About 300px inline: the popup shows 3 rows, summary and everything below are pushed away      | Item view: choices, then the job list; the main list is not disturbed | About 190px inline                                          |
| Clicks to save with a non-default choice               | Choices, pick (radio: 1), Download = 3                                                        | Same 3, plus Back to the list                                         | Choices, open select, pick, Download = 4 per changed select |
| Keeps the list in view while choosing                  | Yes, but covered by the form                                                                  | No                                                                    | Yes                                                         |
| Job row, determinate (Pause, Cancel, +N, Choices)      | 77, one line of controls                                                                      | 79                                                                    | 108                                                         |
| Live row (Stop and keep, Pause, Cancel, Choices), 100% | Fits one line                                                                                 | Fits one line                                                         | Fits one line                                               |
| Live row at +40%                                       | Wraps to 2 lines (Cancel + Choices fall to the second)                                        | 2 to 3 lines                                                          | 2 lines (Cancel alone on the second)                        |
| Failed `ERR-HTTP-AUTH` row, `en`                       | Step text 1 line, buttons below: 88                                                           | 1 line, buttons below: 90                                             | 1 line, buttons below: 118                                  |
| Failed row, `pt_BR` (57-char step)                     | Step wraps to 2 lines: 106                                                                    | 2 lines: 108                                                          | Fits in 1 line: 118                                         |
| Failed row at +40%                                     | Step 2 lines: 106                                                                             | 2 lines: 108                                                          | 2 lines: 135                                                |
| No title / no thumbnail / `duration: 0`                | "Untitled video", crossed placeholder, "Length unknown"; same height as a titled row          | Same                                                                  | Same; title clamps to 2 lines, meta below                   |
| Protected row                                          | Calm label that is itself the disclosure ("why" detail inside); no Download, Choices or Retry | Same                                                                  | Same                                                        |
| Fit for the sidebar (#37)                              | Fine                                                                                          | Fine; the item view can sit beside the list                           | Wastes the width the sidebar adds                           |

Results that apply to every variant:

- **The short `ERR-HTTP-AUTH` step does not fit in one line at +40%.** "Open the page, play the video once, then try again." is one line in `en` at 100% but wraps in `pt_BR` (A, B) and at +40% in all three, even at C's full width. Retry and Dismiss never share the line with the step, so a failed row is always step plus buttons. ADR 0005's exception stands: failed rows take one more line (two at +40% or `pt_BR`). Rows grow by 18 to 40px, and only for rows that need attention.
- **The live action line holds at 100% and wraps at +40%.** It wraps without clipping or horizontal overflow; Cancel stays apart and Stop and Cancel are never adjacent on one line unless the wrap puts them there at `margin-inline-start: auto`, where Cancel is still dashed and last. Wrapping is acceptable only if the buttons keep 24×24px targets and the row can grow; a design that clips would not be.
- **The icon-only Choices at the end of the action line is the weak point.** It is the control that falls alone onto an extra line at +40% (A, B; the determinate row wraps only because of it). Placing it on the identity line, or making it a row-level affordance, is a visual-design question (see below).
- **Keyboard and focus are only partly working in the wireframes.** Choices and "+N more" take focus from and return it to their opener on Back or Esc, with native controls only. But focus falls to `<body>` when a live tick re-renders the item view, when "Audio only" is toggled, and when Download, Pause or Retry replaces the focused control with one that has a different key (checked in Chromium). #12 and #20 must move focus to the row's new primary control or its status after a control replaces itself (WCAG 2.4.3), and live updates must not rebuild a focused form control. The composite pattern that keeps the list one tab stop (flows constraint 1) is not explored; every row control is a tab stop.
- The four-step save flow is unchanged; not explored: the Cancel confirmation and the `unknown-request` fallbacks beyond ignoring the error.

## Decision

Use **B**: the A/B row (48px thumbnail, two lines, 67px idle) with Choices opening the item view, as ADR 0005 specifies.

- Row anatomy: identity line (title, then duration, `Length unknown` or `Live`, or the job's short status) and an action line. No job: Download or Record, and a labeled Choices. With a job: its controls, "+N more" when needed, and the icon-only Choices.
- Choices live in the item view only. The main list never reflows when someone chooses.
- Failed and waiting rows may take extra lines (ADR 0005 exception); the live action line may wrap at +40%.
- The Downloads view and job cards in the wireframes are provisional; #20 owns the job card.

## Alternatives considered

- **A. Inline choices.** The row anatomy is the same as B, and it keeps the list visible. Rejected because one expanded item fills half of the 600px popup, hides the summary and the rows below, and grows further with more tracks or +40% text. This confirms the concern ADR 0005 recorded about the inline option, now measured. A remains the fallback if the item view tests badly in #12: the only difference is where `choicesForm` renders.
- **C. Thumbnail-led row.** Rejected as the default: rows are 43% taller (5 visible instead of 7 of 12 items), the compact selects cost two clicks per changed choice, and the extra width it gives the action line helps only in `pt_BR` and at +40%. Worth keeping: the full-width action line is the only variant where the live row stays on two lines at +40%.

## Consequences

- #12 (high-fidelity popup) builds the B rows and the item view. Visual-design questions: where Choices sits when a job owns the action line (the icon wraps alone at +40%); whether the 48px thumbnail is enough for recognition; whether Cancel needs more than a dashed border to read as destructive and apart.
- #20 (job card) uses one status-to-controls mapping for the compact and full variants; `wireframe-popup.ts` (`controls`, `statusText`, `errorStep`) is a working sketch of it, not code to keep.
- Open for #12: with "Audio only" on, the wireframe hides the Audio group and drops the track, but contract §4.2 uses `audioTrackIds[0]` as the source for `mode: 'audio'`; keep the language choice visible for multi-language items.
- Copy: the `ERR-HTTP-AUTH` short step should be re-tested by the ux-writer; at 57 characters in `pt_BR` it wraps. Aim for 45 or fewer, or accept two lines.
- `scripts/wireframe-shots.ts` regenerates the screenshots and prints row heights for the wrap checks; it needs the dev server on port 4180.
- The wireframes and their strings (`popup_*` keys in both locales) are throwaway; the keys that survive move with the final components.
