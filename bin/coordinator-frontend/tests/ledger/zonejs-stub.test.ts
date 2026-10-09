import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config.mjs';

// Para's telemetry (switched on per API key by Para's servers) dynamically
// imports @opentelemetry/context-zone, which installs zone.js. zone.js replaces
// the global Promise, and the Miden SDK's IndexedDB transactions (Dexie) then
// fail with PrematureCommitError, e.g. on every claim. The build must stub it.
describe('zone.js is kept out of the bundle', () => {
  it('replaces @opentelemetry/context-zone and zone.js with the empty stub', () => {
    const replaced: Array<{ pattern: RegExp; target: string }> = [];
    class NormalModuleReplacementPlugin {
      constructor(pattern: RegExp, target: string) { replaced.push({ pattern, target }); }
    }
    const config = { experiments: {}, module: { rules: [] }, resolve: { fallback: {}, alias: {} }, plugins: [] as unknown[] };
    (nextConfig as { webpack: (c: unknown, o: unknown) => unknown }).webpack(config, { webpack: { NormalModuleReplacementPlugin } });

    const stubbed = (request: string) =>
      replaced.some(({ pattern, target }) => pattern.test(request) && target.endsWith('src/stubs/empty.js'));
    expect(stubbed('@opentelemetry/context-zone')).toBe(true);
    expect(stubbed('@opentelemetry/context-zone-peer-dep')).toBe(true);
    expect(stubbed('zone.js')).toBe(true);
    // Para's own telemetry stays.
    expect(stubbed('@opentelemetry/api')).toBe(false);
    expect(stubbed('@opentelemetry/sdk-trace-base')).toBe(false);
  });
});
