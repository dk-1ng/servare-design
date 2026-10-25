import { Backend, type BackendOptions } from './backend.ts';
import { buildScenario, type Scenario, type ScenarioName } from './scenarios.ts';
import {
  MessagingError,
  type Client,
  type EventMap,
  type EventName,
  type RequestMap,
  type RequestName,
  type Unsubscribe,
} from './types.ts';

export interface MockClientOptions extends BackendOptions {
  scenario?: ScenarioName | Scenario;
  /** Simulated round trip of a request. */
  latencyMs?: number;
  /** Run the clock by itself. Tests turn this off and call `advance`. */
  autoRun?: boolean;
}

const TICK_MS = 100;

/** Mirrors servare's `PortClient`: requests, events and a reconnect hook. */
export class MockClient implements Client {
  private readonly backend: Backend;
  private readonly scenario: Scenario;
  private readonly latencyMs: number;
  private readonly listeners = new Map<EventName, Set<(payload: never) => void>>();
  private readonly reconnectHandlers = new Set<() => void>();
  private connected = true;
  private elapsed = 0;
  private tracksSent = false;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(options: MockClientOptions = {}) {
    const scenario = options.scenario ?? 'many';
    this.scenario = typeof scenario === 'string' ? buildScenario(scenario) : scenario;
    this.latencyMs = options.latencyMs ?? 80;
    this.backend = new Backend(
      this.scenario,
      (name, payload) => {
        this.dispatch(name, payload);
      },
      options,
    );
    if (options.autoRun ?? true) {
      this.timer = setInterval(() => {
        this.advance(TICK_MS);
      }, TICK_MS);
    }
  }

  request<K extends RequestName>(name: K, payload: RequestMap[K][0]): Promise<RequestMap[K][1]> {
    return new Promise((resolve, reject) => {
      const run = (): void => {
        if (!this.connected) {
          reject(new MessagingError('disconnected'));
          return;
        }
        if (!(name in this.backend.handlers) || this.scenario.unavailable.has(name)) {
          reject(new MessagingError('unknown-request', name));
          return;
        }
        try {
          // Each handler is typed per request name; the lookup by a generic key cannot be.
          const handler = this.backend.handlers[name] as (p: RequestMap[K][0]) => RequestMap[K][1];
          resolve(handler(payload));
        } catch (error) {
          reject(
            error instanceof Error ? error : new MessagingError('handler-failed', String(error)),
          );
        }
      };
      if (this.latencyMs > 0) setTimeout(run, this.latencyMs);
      else run();
    });
  }

  on<K extends EventName>(name: K, handler: (payload: EventMap[K]) => void): Unsubscribe {
    const set = this.listeners.get(name) ?? new Set();
    set.add(handler);
    this.listeners.set(name, set);
    return () => {
      set.delete(handler);
    };
  }

  onReconnect(handler: () => void): Unsubscribe {
    this.reconnectHandlers.add(handler);
    return () => {
      this.reconnectHandlers.delete(handler);
    };
  }

  /** Moves simulated time forward: job lifecycle, late tracks and scheduled outages. */
  advance(dtMs: number): void {
    this.elapsed += dtMs;
    this.backend.step(dtMs);
    const late = this.scenario.lateTracks;
    if (late && !this.tracksSent && this.elapsed >= late.afterMs) {
      this.tracksSent = true;
      const media = this.scenario.media.find((m) => m.id === late.mediaId);
      if (media) media.audioTracks = late.tracks;
      this.dispatch('tracks/updated', { mediaId: late.mediaId, audioTracks: late.tracks });
    }
    const outage = this.scenario.outage;
    if (outage) {
      const phase = this.elapsed % outage.everyMs;
      const down = this.elapsed >= outage.everyMs && phase < outage.forMs;
      if (down && this.connected) this.disconnect();
      else if (!down && !this.connected) this.reconnect();
    }
  }

  /** Drops the port: requests fail with `disconnected` and events are lost until `reconnect`. */
  disconnect(): void {
    this.connected = false;
  }

  reconnect(): void {
    if (this.connected) return;
    this.connected = true;
    for (const handler of this.reconnectHandlers) handler();
  }

  dispose(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
  }

  private dispatch<K extends EventName>(name: K, payload: EventMap[K]): void {
    if (!this.connected) return;
    for (const handler of this.listeners.get(name) ?? [])
      (handler as (p: EventMap[K]) => void)(payload);
  }
}
