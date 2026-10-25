# Handoff from servare

Notes written from the servare repository on what the design work needs. Translated from the original Portuguese note.

## Data contract: `ui-contract.md` (essential)

It is the only thing the UI can rely on. Most useful for design:

- **§2.1 `MediaItem`:** what can be shown for each detected media: title, thumbnail, duration (or `'live'`), kind (direct/hls/dash), qualities (`variants`), audio tracks, subtitles and `protected`. Almost everything is optional, so design the "no thumbnail, no title, unknown duration" case.
- **§2.2 and §3, `DownloadJob` and states:** `queued`, `running`, `paused`, `done`, `failed` and `cancelled`, plus the transition diagram. Each state needs its own visual and actions. Progress may be `indeterminate` (live or unknown size); speed and ETA are computed by the UI from `bytesWritten`.
- **§2.3, errors:** seven kinds, each with a message and a suggested action. This is already the list of error messages to write.
- **§3.2, `waiting`:** a job held because another job blocks the same origin. A hard UX case to explain.
- **§6, protected content:** listed, but as unavailable, with an explanation. Never has a download button.
- **§7, actions per milestone:** practically the list of features the UI must cover.

The JSON examples in the contract serve as mock data for the prototypes.

## Surfaces to design

| Surface                                                                                                                  | Source             | When                |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------ | ------------------- |
| **Popup**: tab list, quality/audio/subtitle choice, queue and progress                                                   | §2.1–§3, §4.1–4.2  | primary, M1–M4      |
| **History** (no private-window entries)                                                                                  | §4.3               | M1 (servare#15)     |
| **"Scan page"** and the MSE/`blob:` notice                                                                               | §4.1, servare#31   | M4                  |
| **Options page**: per-domain rules, name template, subfolder, speed profile, MP3 quality, preferred languages            | §4.4, design §6, §7, servare#34 | M5     |
| **Preview before download, context menu, shortcuts**                                                                     | servare#36         | M5                  |
| **Sidebar** (Firefox), listed in design §2.2                                                                             | design §2.2        | after popup/options |

The temporary popup of servare#16 does not need design; it is throwaway.

## Product context (from `design.md`)

- **§1.1–1.3, scope, non-goals and principles:** what the extension does and never does — no YouTube, no DRM, no telemetry, privacy in private windows. This sets the tone of refusal messages.
- **§6, per-domain rules:** the fields the rules editor exposes.
- **§7, file names:** template variables (`{title}`, `{host}`, `{date}`, `{quality}`, `{lang}`) and the 180-character limit.

## Constraints that affect design

- **Two browsers (Firefox and Chromium):** the popup has a limited size (about 800×600 at most) and must work in light and dark themes.
- **README in 8 languages:** the UI will be translated. Leave room for longer text (German, Russian) and use labels that do not depend on English.
- **Suspendable background:** the UI can lose its connection and reconnect by itself (contract §1). A discreet "reconnecting" state is worth having.
- **Originality:** an original visual language; do not base it on the interface of other download extensions.

## Constraints for reuse in servare

- **No framework**, or decide the framework in servare. Servare has none today (only zod). A prototype in React/Svelte/etc. would become a stack decision for `docs/design.md`. Plain HTML/CSS/TS or Web Components imposes nothing.
- **Nothing remote.** The MV3 CSP does not let extensions load remote fonts, CDNs or icons. Use system or bundled fonts and local SVG icons.
- **Mock data = the contract's JSON.** A `mock-client` layer that mimics `PortClient`, with requests and the `media/updated` and `job/updated` events, makes swapping in the real client trivial.
- **i18n from the start:** strings outside the HTML, with room for longer text.
- **Spec:** a state catalog (every job state and every error, with visual and action) and the tokens. The spec must also list what the contract is missing, to become issues in servare.

## Out of scope

Source code, `schemas.ts`, tests and network/libav details. `ui-contract.md` already summarizes them as data.

The contract is marked **"draft for review"**. If design reveals something missing (for example an estimated file size, which `MediaItem` does not have today), raise it as an issue in servare. Changing the contract is a design change and must update `docs/design.md` in the same PR.
