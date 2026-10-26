import { MockClient, type MockClientOptions } from './client.ts';
import { isScenarioName, type ScenarioName } from './scenarios.ts';

export { MockClient } from './client.ts';
export type { MockClientOptions } from './client.ts';
export { SCENARIO_NAMES, type ScenarioName } from './scenarios.ts';
export { MOCK_NOW, TAB_ID } from './fixtures/media.ts';
export * from './types.ts';

/** Reads `?scenario=` from the page URL; falls back to `many`. */
export function scenarioFromUrl(search: string = location.search): ScenarioName {
  const value = new URLSearchParams(search).get('scenario');
  return isScenarioName(value) ? value : 'many';
}

export function createMockClient(options: MockClientOptions = {}): MockClient {
  return new MockClient({ scenario: scenarioFromUrl(), ...options });
}
