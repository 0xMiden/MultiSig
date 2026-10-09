import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, type CspConfig } from '../../src/lib/securityHeaders';
import { staticSecurityHeaders } from '../../security-headers.mjs';

const base: CspConfig = {
  nonce: 'abc123',
  dev: false,
  guardianEndpoints: ['https://guardian-devnet.openzeppelin.com'],
  midenRpcUrl: 'https://rpc.devnet.miden.io',
  noteTransportUrl: 'https://transport.devnet.miden.io',
  proverUrl: 'local',
  chatEndpoint: '',
  paraHosted: true,
  extraConnectSrc: '',
};

function directives(policy: string): Map<string, string[]> {
  return new Map(policy.split('; ').map((part) => {
    const [name, ...values] = part.split(' ');
    return [name, values];
  }));
}

describe('buildContentSecurityPolicy', () => {
  it('allows only nonced scripts plus WebAssembly, never inline or eval in production', () => {
    const script = directives(buildContentSecurityPolicy(base)).get('script-src')!;
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).toContain("'wasm-unsafe-eval'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it('forbids framing, plugins and foreign form targets', () => {
    const csp = directives(buildContentSecurityPolicy(base));
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('form-action')).toEqual(["'self'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
  });

  it('limits connections to the configured services', () => {
    const connect = directives(buildContentSecurityPolicy({
      ...base,
      guardianEndpoints: ['https://guardian-devnet.openzeppelin.com/api', 'https://guardian-testnet.openzeppelin.com'],
      midenRpcUrl: 'http://localhost:57291',
      chatEndpoint: 'https://chat.example.com/api/v1',
      extraConnectSrc: 'https://guardian.example.org, not-a-url javascript:alert(1)',
    })).get('connect-src')!;
    expect(connect).toEqual(expect.arrayContaining([
      "'self'",
      'https://guardian-devnet.openzeppelin.com',
      'https://guardian-testnet.openzeppelin.com',
      'https://transport.devnet.miden.io',
      'http://localhost:57291',
      'https://chat.example.com',
      'https://guardian.example.org',
      'https://*.getpara.com',
    ]));
    expect(connect.join(' ')).not.toMatch(/javascript:|not-a-url|\*(?!\.)|https:(?!\/\/)/);
    // No wildcard for Miden or Guardian hosts: only what is configured.
    expect(connect.filter((source) => /miden\.io|openzeppelin\.com/.test(source) && source.includes('*'))).toEqual([]);
  });

  it("follows Para's environment and relaxes only what React's dev build needs", () => {
    const dev = directives(buildContentSecurityPolicy({ ...base, dev: true, paraHosted: false }));
    expect(dev.get('script-src')).toContain("'unsafe-eval'");
    expect(dev.get('connect-src')).toEqual(expect.arrayContaining(['http://localhost:8080', 'ws://localhost:*']));
    expect(dev.get('connect-src')).not.toContain('https://*.getpara.com');
  });
});

describe('staticSecurityHeaders', () => {
  it('sends anti-framing, nosniff and a WebHID-only permissions policy; HSTS in production', () => {
    const headers = new Map(staticSecurityHeaders(true).map(({ key, value }) => [key, value]));
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Permissions-Policy')).toMatch(/^hid=\(self\)/);
    expect(headers.get('Strict-Transport-Security')).toMatch(/max-age=\d+/);
    expect(new Map(staticSecurityHeaders(false).map(({ key, value }) => [key, value])).has('Strict-Transport-Security')).toBe(false);
  });
});
