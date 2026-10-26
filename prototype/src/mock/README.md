# Mock client

A stand-in for servare's `PortClient` (ADR [0001](../../../docs/decisions/0001-prototype-stack.md)). Components talk to the `Client` interface in `types.ts`: `request(name, payload)`, `on(event, handler)` and `onReconnect(handler)`. Swapping in the real client needs no component change.

- `types.ts` — hand-written mirrors of servare `schemas.ts` / `protocol.ts` (contract §1–§5).
- `transitions.ts` — the `DownloadJob` table of contract §3.1. `Backend.move` is the only place a status changes and throws on anything else.
- `backend.ts` — state, request handlers and the simulated job lifecycle. Time only moves through `step`.
- `client.ts` — transport: latency, events, disconnect/reconnect.
- `scenarios.ts`, `fixtures/media.ts` — data per scenario.

```ts
import { createMockClient } from './mock/index.ts';
const client = createMockClient(); // scenario from ?scenario=, default "many"
const items = await client.request('media/list', { tabId: 42 });
```

Tests build `new MockClient({ scenario, latencyMs: 0, autoRun: false })` and call `advance(ms)`.

## Scenarios

Pick one with `?scenario=<name>` in the page URL. Tab id is always `42`.

| Scenario         | What it shows                                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `empty`          | No media found.                                                                                                                                                                                                             |
| `many` (default) | Twelve items: direct, HLS and DASH; missing titles and thumbnails; `duration: 0`; one live. Audio tracks of the first item arrive late (`tracks/updated`, 2 s). `media/scan` finds nothing new (`found: 0`, not blob-only). |
| `live`           | A live item and a direct file. Live jobs stay `indeterminate` until `download/stop`.                                                                                                                                        |
| `protected`      | A protected item (enqueue is refused) and a normal one; a seeded job failed with `protected`.                                                                                                                               |
| `http-403`       | Jobs fail at 35% with `http` 403. The retry then succeeds, as if the user had reopened the page.                                                                                                                            |
| `incomplete`     | Jobs fail at the end with `incomplete` (ratio 0.91). The retry succeeds.                                                                                                                                                    |
| `quota`          | Jobs fail at 10% with `quota`. The retry succeeds.                                                                                                                                                                          |
| `waiting`        | A live job is already running; any new job stays `queued` with `waiting.reason = header-conflict` until the live job ends.                                                                                                  |
| `disconnected`   | A job is running; every 15 s the port drops for 4 s (requests reject with `disconnected`, events are lost), then `onReconnect` fires.                                                                                       |
| `not-available`  | Planned requests (`media/scan`, `download/retry`, `download/remove`, `download/stop`, `history/*`, `rules/*`, `settings/*`) reject with `unknown-request`.                                                                  |

## Not simulated

- Validation of `rules/*` and `settings/*` (`invalid-payload`) and the `settings/updated` event: the handlers store what they are given.
- Private windows, browser restart and the "Firefox host tab closed" pause (contract §3.1).
- The `many` scenario does not emit `media/updated` after load; `media/list` is the full list.
- Thumbnails are local SVG data URIs, never remote images.
