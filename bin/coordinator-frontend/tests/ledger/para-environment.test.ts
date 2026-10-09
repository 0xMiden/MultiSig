import { describe, expect, it } from 'vitest';
import { Environment } from '@getpara/react-sdk-lite';
import { paraIsHosted, parseParaEnvironment } from '../../src/lib/paraEnvironment';
import { buildContentSecurityPolicy } from '../../src/lib/securityHeaders';

const csp = (paraHosted: boolean) => buildContentSecurityPolicy({
  nonce: 'n', dev: false, guardianEndpoints: [], midenRpcUrl: '', noteTransportUrl: '', proverUrl: '',
  chatEndpoint: '', paraHosted, extraConnectSrc: '',
});

describe('Para environment', () => {
  it.each(['sandbox', 'beta', 'production', ' BETA '])('accepts %j as a hosted environment', (value) => {
    const env = parseParaEnvironment(value);
    expect(paraIsHosted(env)).toBe(true);
  });

  it('keeps development (Para local stack) as the default', () => {
    expect(parseParaEnvironment(undefined)).toBe('development');
    expect(paraIsHosted('development')).toBe(false);
  });

  it('rejects unknown environments instead of silently using the local stack', () => {
    expect(() => parseParaEnvironment('staging')).toThrow(/NEXT_PUBLIC_PARA_ENVIRONMENT/);
  });

  it('every accepted name has a Para SDK environment', () => {
    expect([Environment.DEV, Environment.SANDBOX, Environment.BETA, Environment.PROD].every(Boolean)).toBe(true);
  });

  it('lets a hosted (e.g. beta) Para reach *.getpara.com and never localhost', () => {
    const hosted = csp(true);
    expect(hosted).toMatch(/connect-src[^;]*https:\/\/\*\.getpara\.com/);
    expect(hosted).toMatch(/connect-src[^;]*wss:\/\/\*\.getpara\.com/);
    expect(hosted).not.toMatch(/localhost:8080/);
    expect(csp(false)).toMatch(/localhost:8080/);
  });
});
