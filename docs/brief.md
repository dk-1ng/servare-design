# Design brief

The one page every task starts from. Details live in the sources linked here; read them only when an issue lists them.

## Product

Servare is a Firefox and Chromium (MV3) extension that detects video and audio loaded by the current page and saves it locally (direct files, HLS, DASH, HLS live), with all processing in the browser. It can also pick quality, alternate audio and subtitles, and extract audio to MP3.

It never supports YouTube, never circumvents DRM or access controls, and sends no telemetry. Private windows leave no persistent trace (no history entries). Source: `references/design.md` §1.

## User

A **non-technical person by default** who wants to save a video they are watching, with **detail on demand** for those who want it. Primary words: "video", "quality", "audio", "subtitles", "download". Technical terms (HLS, DASH, codec, bitrate, HTTP status) appear only in expandable details.

## Main tasks

1. See what was found on this page.
2. Save one item, optionally choosing quality, audio language and subtitles, or audio only (MP3).
3. Follow progress; pause, resume, cancel; stop a live recording and keep what was recorded.
4. Understand why something failed or is waiting, and retry.
5. Find past downloads (history).
6. Adjust defaults: file name template, subfolder, speed, MP3 quality, preferred languages, per-site rules.

## Surfaces (priority order)

| Surface                                  | Contract                   | Servare milestone |
| ---------------------------------------- | -------------------------- | ----------------- |
| Popup: media list, choices, queue        | §2.1–§3, §4.1–4.2, §5      | M1–M4             |
| History                                  | §4.3                       | M1                |
| Scan page / MSE notice                   | §4.1 `media/scan`          | M4                |
| Options page                             | §4.4, design §6–§7         | M5                |
| Preview, context menu, shortcuts         | servare#36                 | M5                |
| Sidebar (Firefox), designed last         | design §2.2                | later             |

## Data the UI has (contract summary)

- **MediaItem** (§2.1): `kind` direct/hls/dash, `title` (may be empty), `thumbnail?`, `duration` (seconds, `0` unknown, `'live'`), `variants[]` (width/height/bandwidth/codecs optional), `audioTracks[]`, `subtitles[]`, `protected`. Design the "no title, no thumbnail, unknown duration" case.
- **DownloadJob** (§2.2–§3): status `queued | running | paused | done | failed | cancelled`; `progress` 0–1 or `'indeterminate'`; `bytesWritten` (the UI computes speed and ETA); `outputName`; `waiting.reason = header-conflict` (§3.2).
- **DownloadError** (§2.3): `cancelled`, `http` (401/403 → reopen the page and play again), `incomplete` (ratio), `decrypt`, `quota`, `protected`, `unknown` (message). Unknown kinds fall back to `unknown`.
- **Transport** (§1): the background can suspend; the UI reconnects by itself and must re-fetch. Show a discreet "reconnecting" state. `unknown-request` means "feature not available yet": hide or disable it.

## Constraints

- No UI framework; plain HTML/CSS/TS or Web Components. Nothing remote (system fonts, local SVG).
- Popup at most ~800×600; design for **380px** width so components also fit the sidebar. Light and dark themes.
- i18n: en + pt-BR now, structure ready for 8 languages (`_locales/<lang>/messages.json`). Leave room for ~40% longer text and use logical CSS properties.
- WCAG 2.2 AA.
- An original visual language, not modeled on other download extensions.

## Voice

Warm and friendly, always followed by a concrete action. Calm and honest when refusing (protected content). No jargon in primary text.

Example: "This page asked to sign in again. Open it, play the video once, then try again."

## Deliverables

A prototype on mock data (`prototype/`, mock client that mirrors `PortClient`), a state gallery, design tokens, `DESIGN.md`, and a spec (`docs/spec/`) with the state catalog, strings and contract gaps for servare.
