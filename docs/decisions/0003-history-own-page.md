# 0003. History lives on its own extension page

- Status: proposed
- Date: 2026-10-25
- Issue: #10

## Context

History (`history/list`, `history/remove`, `history/clear`, contract §4.3) is planned for servare M1 (#15); the options page arrives in M5 (#34). History grows without bound, needs search (G3 fallback filters in the UI), a confirmed "Clear all", and room for details on demand. The popup is designed for 380px and closes when it loses focus. The popup structure itself is still being decided (#9: two tabs, one list with inline jobs, or list plus slide-over), and the popup already shows the jobs from `download/list` (persisted until removed), including finished ones. Details in [`options-history-ia.md`](../flows/options-history-ia.md) §4.

## Decision

History is its own extension page, `history.html`, opened in a browser tab from one "History" link in the popup and from the options page navigation. The popup never renders `HistoryEntry` data; its finished jobs stay `DownloadJob`s from `download/list`. The page reflows down to 320 CSS px so the same components can later fill the sidebar. The link is hidden while `history/list` answers `unknown-request`.

## Alternatives considered

- **A section or tab inside the popup.** Fastest to reach, but it competes for the 380px with the media list and the queue, mixes two stores that look alike (jobs and entries, with different actions) in one surface, makes "Clear all" and search cramped, and loses state whenever the popup closes. It would also force #9 to reserve a third view.
- **A section of the options page.** One page for everything secondary, but the options page does not exist before M5 while history ships in M1, settings and records are different tasks (configure vs find), and Firefox may embed options in `about:addons`.

## Consequences

- The popup structure (#9) only needs one visible History entry point, whatever option it picks.
- Reaching history costs one extra click and a new tab; acceptable for brief task 5, which is occasional.
- The history page has its own state set (`HIST-*`) and its own refresh rule: render from the `history/updated` event (contract §5, planned #15), and re-fetch `history/list` on reconnect and visibility, since events sent while disconnected are lost (§1).
- Servare needs one more extension page in its build; no contract change.
