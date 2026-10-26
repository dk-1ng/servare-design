# Contract gaps

- Status: draft for D1 — Discovery
- Issue: #7
- Inputs: `docs/brief.md`, `docs/discovery/state-inventory.md`, `references/ui-contract.md`, `references/handoff-from-servare.md`

Data or actions the UI needs that `references/ui-contract.md` does not provide. Each entry becomes an issue in `dk-1ng/servare` during D8 (a contract change is a design change and updates servare's `docs/design.md` in the same PR). Every "proposed" item below is a **proposal**: the prototype and the mock client must not use it. They design the fallback instead.

The IDs are stable; the state inventory and later issues refer to them.

## How to read this

- **Marker.** **Blocking design**: the layout or a primary action of a core task changes depending on the answer, so the spec cannot be final without a decision from servare (accepted, rejected or deferred). **Nice to have**: the fallback is good enough to ship; the addition improves clarity.
- **Priority.** **P1**: affects a core task (brief tasks 1–4) for most users. **P2**: affects a core task in a less common case, or history. **P3**: polish or power-user detail.
- **Compatibility** is judged against contract §8: an optional field, a request, an event or a `DownloadError` kind is backwards compatible; removing or retyping is not. Every proposal here is additive. "Docs only" means no shape changes at all.

## Summary

| ID  | Gap                                             | Marker          | Priority |
| --- | ----------------------------------------------- | --------------- | -------- |
| G1  | Open or show a delivered file                   | Blocking design | P1       |
| G2  | Why a history entry failed                      | Nice to have    | P3       |
| G3  | Paging and search in history                    | Nice to have    | P3       |
| G4  | Whether a job is a live recording               | Blocking design | P1       |
| G5  | Translatable reason for interrupted jobs        | Nice to have    | P2       |
| G6  | Why a job is paused                             | Nice to have    | P2       |
| G7  | What is kept after a failure                    | Nice to have    | P2       |
| G8  | Why a page has no media                         | Nice to have    | P2       |
| G9  | Estimated file size (item and job)              | Blocking design | P1       |
| G10 | Size or bitrate per quality option              | Blocking design | P1       |
| G11 | Job title and picture after the tab navigated   | Blocking design | P1       |
| G12 | Speed profile in effect for a job               | Nice to have    | P3       |
| G13 | History entry thumbnail and audio mode          | Nice to have    | P3       |
| G14 | Job timestamps and queue order                  | Nice to have    | P2       |
| G15 | Download before the manifest is parsed          | Blocking design | P1       |
| G16 | Behavior clarifications (live, stop, client)    | Nice to have    | P3       |
| G17 | Retry lineage and removing a job                | Nice to have    | P2       |
| G18 | Site rule defaults, bundled rules and overlap   | Nice to have    | P3       |
| G19 | Settings defaults, language order, name preview | Nice to have    | P3       |
| G20 | History order, retention and link to jobs       | Nice to have    | P2       |

## Entries

### G1 — Open or show a delivered file

- **Found in:** #5 (J3, J5); `JOB-DONE`.
- **Use case:** after a download finishes, or later from history, the user wants to open the file or see it in its folder ("where is it?").
- **Missing:** neither `DownloadJob` nor `HistoryEntry` exposes a handle to the browser download.
- **Proposal (preferred):** optional `downloadId?: number` on `DownloadJob` (only on `done`) and on `HistoryEntry`, so the extension page calls `downloads.open` / `downloads.show` directly in its click handler. Firefox only allows `downloads.open` from a user-input handler, and that gesture is lost across a `runtime.Port` message. **Alternative:** requests `download/open`, `download/show`, `history/open`, `history/show` (`{ jobId }` / `{ entryId }` → `null`; `handler-failed` when the file no longer exists), at the risk that the background-side `open` is refused. Open points for servare: calling `downloads.open` needs the `downloads.open` manifest permission; a stored ID is stale if the user clears the browser's download list; and Firefox download-ID persistence across restarts must be checked. If IDs do not persist, keep `downloadId` on `DownloadJob` only and use `history/open` and `history/show` for history.
- **Compatibility:** optional field, or new requests; compatible.
- **Fallback:** "Saved in your downloads folder as {outputName}", or "Saved where you chose" (without claiming a file name) when `Settings.saveAs` is on, since the user may rename the file in the Save As dialog (only when `settings/get` answers, M5). Never assume the folder is called "Downloads". When `downloads.open` or `downloads.show` is rejected, or the ID is stale, show "The file could not be opened. It may have been moved or deleted."
- **Marker:** blocking design (it decides the primary action of the done card and the history row). **Priority:** P1.

### G2 — Why a history entry failed

- **Found in:** #5 (J4, J5).
- **Use case:** a failed entry in history should say why, as the queue does.
- **Proposal:** `HistoryEntry.error?: DownloadError`, present when `status` is `failed`.
- **Compatibility:** optional field; compatible.
- **Fallback:** "This download did not finish", with a link to `pageUrl` to try again.
- **Marker:** nice to have. **Priority:** P3.

### G3 — Paging and search in history

- **Found in:** #5 (J5).
- **Use case:** finding one past download in a long history.
- **Proposal:** `history/list { limit?, before?: number /* completedAt cursor */, query?: string }`.
- **Compatibility:** optional payload fields; compatible.
- **Fallback:** load with a generous `limit` and filter `title`, `outputName` and `pageUrl` in the UI.
- **Marker:** nice to have. **Priority:** P3.

### G4 — Whether a job is a live recording

- **Found in:** #6 (`JOB-RUNNING-LIVE`, `JOB-PAUSED-LIVE`); #8 (F5 Stop and keep after the tab navigated, F6 ending a live blocker).
- **Use case:** offering "Stop and keep" next to "Cancel", and showing how long it has been recording, even after the tab navigated away. Confusing the two loses the recording.
- **Missing:** a job does not say whether it is live; the UI must resolve `mediaId` in `media/list`, which fails once the tab navigates (§2.2).
- **Proposal:** `DownloadJob.live?: boolean` and `DownloadJob.startedAt?: number` (ms since epoch, first transition to `running`). Preferred: take `live` from G11's snapshot and add only `startedAt` here, so servare does not add both flags.
- **Compatibility:** optional fields; compatible.
- **Fallback:** live only when `mediaId` resolves to an item with `duration: 'live'`; otherwise show `bytesWritten` ("1.2 GB saved") and offer Pause and Cancel only.
- **Marker:** blocking design. **Priority:** P1.

### G5 — Translatable reason for interrupted jobs

- **Found in:** #6 (`ERR-UNKNOWN-PRIVATE-RESTART`, `ERR-UNKNOWN-HOST-TAB`, `NET-HANDLER-FAILED`).
- **Use case:** explaining in the user's language, with the right next step, why a private download ended at restart or why a Firefox download stopped when its tab closed.
- **Missing:** both arrive as `kind: 'unknown'` with free-text `message` (English, not localizable, not distinguishable). Same for `handler-failed` `message`.
- **Proposal:** new `DownloadError` kind `{ kind: 'interrupted', reason: 'private-window-restart' | 'host-tab-closed', message: string }`, with `message` kept equal to today's English text; optionally a stable `code?: string` next to `message` on `unknown` and on `handler-failed`.
- **Compatibility:** new error kind and optional field; compatible. Older UIs render `interrupted` as `unknown` (§8) and still get a readable `message`, because it is kept.
- **Fallback:** a localized lead-in ("This download stopped.") followed by `message` as given, and Retry.
- **Marker:** nice to have. **Priority:** P2.

### G6 — Why a job is paused

- **Found in:** #6 (`JOB-PAUSED`).
- **Use case:** telling the user a download paused because its Firefox host tab closed (#25), not by them, and that it will not resume on its own.
- **Proposal:** `DownloadJob.pausedBy?: 'user' | 'host-tab-closed'`, only on `paused`, cleared when the job leaves `paused`.
- **Compatibility:** optional field; compatible.
- **Fallback:** one copy for both causes: "Paused. Your progress is kept; resume when you are ready."
- **Marker:** nice to have. **Priority:** P2.

### G7 — What is kept after a failure

- **Found in:** #6 (`JOB-FAILED`).
- **Use case:** saying honestly whether anything was kept after a failure, especially a long live recording or an `incomplete` download.
- **Missing:** §3.1 says `cancelled` deletes the temporary file; it says nothing about `failed`.
- **Proposal:** document the behavior in §3.1; if partial output can be delivered, add `DownloadJob.partialDelivered?: boolean` on `failed`.
- **Compatibility:** docs only, or optional field; compatible.
- **Fallback:** copy that makes no claim either way about a partial file.
- **Marker:** nice to have. **Priority:** P2.

### G8 — Why a page has no media

- **Found in:** #6 (`PAGE-EMPTY`).
- **Use case:** telling the user why nothing was found: a browser page Servare cannot read, a site Servare never supports, or a site disabled by a per-domain rule, as opposed to "nothing played yet".
- **Proposal:** request `tab/status { tabId }` → `{ state: 'active' | 'restricted' | 'unsupported' | 'disabled-by-rule' }`.
- **Compatibility:** new request; compatible (`unknown-request` until shipped).
- **Fallback:** one message for all cases: "Nothing found yet. Play the video on the page. Some pages cannot be saved."
- **Marker:** nice to have. **Priority:** P2.

### G9 — Estimated file size (item and job)

- **Found in:** handoff note; #6 (`MEDIA-DIRECT`, `JOB-RUNNING-DETERMINATE`).
- **Use case:** before downloading, "about 350 MB" helps the user decide (disk space, metered connection); during a download, "120 of 350 MB" is clearer than a bare percentage. `ERR-QUOTA` is also easier to prevent.
- **Missing:** `MediaItem` has no size; direct files have no variants, so there is nothing to estimate from. `DownloadJob` has `bytesWritten` and `progress` but no total.
- **Proposal:** `MediaItem.size?: number` (bytes; `Content-Length` for direct files, absent when unknown or live) and `DownloadJob.totalBytes?: number` (expected output size, absent when `progress` is `'indeterminate'`).
- **Compatibility:** optional fields; compatible.
- **Fallback:** no size on the item card. On a determinate job, the UI may estimate the total as `bytesWritten / progress` once `progress` ≥ ~0.05, labeled "about", only for `mode: 'video'` jobs on `kind: 'direct'` items, and only while `mediaId` still resolves (or G11's `media.kind` is present). Elsewhere `progress` may count segments, or the temporary file may differ from the delivered one (`mode: 'audio'`); what `progress` measures is an open point for servare (see G16).
- **Marker:** blocking design (it decides whether the item card and the quality picker reserve a size slot). **Priority:** P1.

### G10 — Size or bitrate per quality option

- **Found in:** #6 (`MEDIA-VARIANTS`, `MEDIA-VARIANT-UNLABELED`).
- **Use case:** a lay user picks a quality by "how big is it" ("720p · about 640 MB"), not by bitrate. Unlabeled variants need a distinguishing figure too.
- **Missing:** `Variant.bandwidth` is optional and, for HLS, is the peak `BANDWIDTH` attribute, so `bandwidth × duration / 8` overstates the size. Audio tracks carry no bandwidth at all, so DASH split sizes cannot be summed.
- **Proposal:** `Variant.averageBandwidth?: number` (HLS `AVERAGE-BANDWIDTH` only; DASH `@bandwidth` is an upper bound, not an average, and DASH has no average, so `estimatedBytes` or segment sizes are its only accurate source) and `Track.bandwidth?: number`; or, simpler for the UI, `Variant.estimatedBytes?: number` computed by the background (absent for live).
- **Compatibility:** optional fields; compatible.
- **Fallback:** label options by height ("1080p") only; when `bandwidth` and a known `duration` exist, show the estimate only in _Details_, marked as "up to".
- **Marker:** blocking design (layout of the quality picker). **Priority:** P1.

### G11 — Job title and picture after the tab navigated

- **Found in:** #6 (`JOB-MEDIA-GONE`); #8 (F1, F3: no page to reopen for `ERR-HTTP-AUTH` after navigation).
- **Use case:** the queue lists jobs from every tab; most of them outlive their `MediaItem` (any navigation or tab close clears it). The user still needs a recognizable title, picture and source page.
- **Missing:** a job has only `mediaId` and `outputName`.
- **Proposal:** `DownloadJob.media?: { title: string, thumbnail?: string, pageUrl: string, kind: 'direct' | 'hls' | 'dash', live: boolean }`, a snapshot taken at enqueue. It also covers G4's `live`.
- **Compatibility:** optional field; compatible.
- **Fallback:** title from `outputName` (extension stripped), neutral placeholder picture, no source link.
- **Marker:** blocking design (it decides the job card layout). **Priority:** P1.

### G12 — Speed profile in effect for a job

- **Found in:** #7 (known candidate); `JOB-RUNNING-DETERMINATE`.
- **Use case:** in _Details_, explaining that a slow download is deliberate ("Economy speed for this site") and pointing to the setting.
- **Missing:** the effective profile is resolved in the background (global `Settings.speedProfile` overridden by a `DomainRule`), and the job does not carry it.
- **Proposal:** `DownloadJob.speedProfile?: 'economy' | 'standard' | 'fast'`.
- **Compatibility:** optional field; compatible.
- **Fallback:** none shown in the popup; from M5 the options page shows the setting itself.
- **Marker:** nice to have. **Priority:** P3.

### G13 — History entry thumbnail and audio mode

- **Found in:** #7 (known candidate); #5 (J5).
- **Use case:** recognizing a past download at a glance, and telling an MP3 apart from the video it came from.
- **Missing:** `HistoryEntry` has neither `thumbnail` nor `mode`.
- **Proposal:** `HistoryEntry.thumbnail?: string` (a small `data:image/…` stored locally, so history never fetches remote images after the fact) and `HistoryEntry.mode?: 'video' | 'audio'`.
- **Compatibility:** optional fields; compatible.
- **Fallback:** placeholder glyph chosen from the `outputName` extension (audio vs video).
- **Marker:** nice to have. **Priority:** P3.

### G14 — Job timestamps and queue order

- **Found in:** #6 (`PAGE-QUEUE`).
- **Use case:** ordering the queue predictably (active first, then most recently finished) and saying "finished 5 min ago".
- **Missing:** `download/list` order is not documented, and jobs have no timestamps.
- **Proposal:** `DownloadJob.createdAt?: number` and `DownloadJob.endedAt?: number` (set on a terminal status); document `download/list` order as oldest first, like `media/list`.
- **Compatibility:** optional fields plus docs; compatible.
- **Fallback:** keep the order `download/list` returns, append new jobs from `job/updated`, no relative times.
- **Marker:** nice to have. **Priority:** P2.

### G15 — Download before the manifest is parsed

- **Found in:** #6 (`MEDIA-VARIANTS-PENDING`, §8 open questions).
- **Use case:** an HLS/DASH item appears before its variants are known. Should Download be enabled (default quality) or wait?
- **Missing:** §2.2 defines a missing `variantId` as "default variant" only for direct files and audio-only.
- **Proposal:** document in §4.2 whether `download/enqueue` without `variantId` on an `hls`/`dash` item is accepted (and which variant is picked, e.g. highest), or fails with `handler-failed`.
- **Compatibility:** docs only.
- **Fallback:** enable Download and handle `handler-failed` with a notice; the picker shows "More options may appear".
- **Marker:** blocking design (whether the button is enabled in a common first-seconds state). **Priority:** P1.

### G16 — Behavior clarifications (live, stop, client)

- **Found in:** #6 (§8 open questions); #8 (F1, D-F2: who applies `preferredLanguages`).
- **Use case:** avoiding controls that the background will reject, and a dead end when the connection never returns.
- **Missing and proposal (docs only):**
  - whether `mode: 'audio'` is allowed with `duration: 'live'` (decides if "Audio only" shows on `MEDIA-LIVE`);
  - what `download/stop` does on a non-live job (expected: `handler-failed`);
  - what `DownloadJob.progress` measures (bytes, HLS/DASH segments, or the temporary file when `mode: 'audio'`), which G9's size estimate depends on;
  - who applies `Settings.preferredLanguages` (§4.4 "pre-selects matching audio and subtitle tracks"): the UI, or the background when `audioTrackIds`/`subtitleIds` are omitted. The flows (D-F2) assume the UI preselects and always sends the IDs it shows; the docs should say whether omitted IDs fall back to the preferred languages, so the two rules cannot diverge;
  - whether `PortClient` ever stops reconnecting; if it does, an `onGiveUp` hook so the UI can show "Could not reach Servare. Close and reopen this window."
- **Compatibility:** docs only, plus an additive client hook.
- **Fallback:** hide "Audio only" on live items; never offer Stop on non-live jobs; keep "Reconnecting" visible indefinitely; the UI preselects tracks from `settings/get` and sends them explicitly (none before M5).
- **Marker:** nice to have. **Priority:** P3.

### G17 — Retry lineage and removing a job

- **Found in:** #8 (F3, D-F3).
- **Use case:** after a retry, the user should see one card per video, not the failed one next to the new one. Removing the failed job with `download/remove` does that, but must not erase the record of the failed attempt.
- **Missing:** §4.2 says the old job "stays as history until removed", and `HistoryEntry.status` includes `'failed'` (§4.3), so `download/remove` may also delete the failed `HistoryEntry`. The contract does not say. The same question applies when the user dismisses any terminal job. Without lineage, the UI also cannot tell after a reconnect which new job replaced which failed one.
- **Proposal:** document in §4.2 that `download/remove` only removes the job from `download/list` and never touches history; optionally `DownloadJob.retryOf?: string` (the failed job's `id`) on jobs created by `download/retry`.
- **Compatibility:** docs only, or optional field; compatible.
- **Fallback:** until §4.2 confirms that `download/remove` leaves history alone, the UI never calls it on a retried job: the failed card stays in the queue, marked "Tried again" (a client-side label on the job whose retry returned a new job in this session). User-initiated dismissal stays available, since the user asked for it.
- **Marker:** nice to have. **Priority:** P2.

### G18 — Site rule defaults, bundled rules and overlap

- **Found in:** #10 (rules editor, `RULE-EDIT`).
- **Use case:** in the site rules editor, the user sees what "Default" means for each key before overriding it, knows whether a rule came with Servare, and understands which rule applies when a site and its subdomain both have one.
- **Missing:** §4.4 says every `DomainRule` key "falls back to the default", but only `speedProfile`'s default is documented (`Settings.speedProfile`); the design §6 values are a sample rule. It is not documented whether `rules/get` includes the entries of the bundled `default-rules.json`, whether removing one of them survives an extension update, which rule wins (or whether keys merge) when `example.com` and `video.example.com` both have a rule, and which domain forms `rules/set` accepts (scheme or path pasted in, port, leading dot, wildcard, IDN vs punycode); and the planned `settings/updated` event (§5) fires when "settings or rules changed" but carries only `Settings`, so a page cannot tell a rule change apart or get the new rules without re-fetching.
- **Proposal:** document the per-key defaults, precedence (expected: most specific domain wins per key) and accepted domain forms in §4.4; optionally `settings/updated` gains `rules?: { version, domains }`, and `rules/get` → `{ version, domains, defaults?: Required<DomainRule>, bundled?: string[] }` (the effective defaults and which domains came from `default-rules.json`).
- **Compatibility:** docs plus optional response fields; compatible.
- **Fallback:** "Default" without a value for every key except `speedProfile`; no "built-in" marker; a subdomain row says "Also covered by {parent}" without claiming which wins; the options page re-fetches `rules/get` on every `settings/updated`; the UI strips scheme, path and port before sending and surfaces `invalid-payload` otherwise.
- **Marker:** nice to have. **Priority:** P3.

### G19 — Settings defaults, language order, name preview

- **Found in:** #10 (options page, Saving files and Languages).
- **Use case:** restoring defaults without the UI hard-coding them; telling the user whether the order of preferred languages matters; showing the real file name a template will produce; knowing whether the subfolder still applies when the user is asked where to save.
- **Missing:** no way to read the default `Settings` from servare; §4.4 does not say whether `preferredLanguages` is ordered by priority; the UI cannot reproduce design §7 sanitization exactly (reserved names, 180-character limit, `video` fallback), and it is not documented what happens to an unknown `{variable}` in `nameTemplate` (kept literally, removed, or `invalid-payload`); the effect of `subfolder` when `saveAs` is `true` is not documented.
- **Proposal:** `settings/get` → `Settings & { defaults?: Settings }` or a `settings/defaults` request; document that `preferredLanguages` is in priority order; a request `settings/previewName { nameTemplate, subfolder? } → { outputName, path }` using fixed sample metadata; document unknown variables and the `saveAs`/`subfolder` interaction in §4.4.
- **Compatibility:** optional field or new requests, plus docs; compatible.
- **Fallback:** "Restore defaults" sends the §4.4 defaults; languages are shown as an ordered list labeled by priority; the example file name is computed in the UI from sample values and labeled as an example; the subfolder field stays editable when `saveAs` is on, with no claim about where the dialog opens.
- **Marker:** nice to have. **Priority:** P3.

### G20 — History order, retention and link to jobs

- **Found in:** #10 (history page, relation to the popup's finished jobs).
- **Use case:** the history list is in a predictable order; the user knows how long history is kept; a retried download does not leave confusing duplicates; the popup can say "not added to history" for a private-window job.
- **Missing:** `history/list` order and retention (count or age cap) are not documented; the planned `history/updated` event (§5) carries the full `entries` list, and it is not documented how that relates to `history/list { limit }` or to paging (G3); it is not documented whether each failed attempt of a retried download becomes its own entry (see G17); `HistoryEntry` does not reference its job, and `DownloadJob` does not say whether its tab was private (the background records it, design §4.1.1).
- **Proposal:** document `history/list` as newest first, the retention policy, and whether `history/updated.entries` is the whole history or the first page; `HistoryEntry.jobId?: string`; `DownloadJob.private?: boolean`.
- **Compatibility:** optional fields and docs; compatible.
- **Fallback:** the history page renders from `history/updated` and re-fetches `history/list` on reconnect and when the tab becomes visible; sorts by `completedAt` in the UI and applies its own display limit; shows no retention promise; the popup's done card says nothing about history.
- **Marker:** nice to have. **Priority:** P2.
