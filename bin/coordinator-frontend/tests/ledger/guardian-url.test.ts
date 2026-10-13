import { describe, expect, it, vi } from 'vitest';
import { guardianUrlProblem, normalizeGuardianUrl } from '../../src/lib/guardianUrl';

const policy = {
  guardians: ['https://guardian.example.org/api', 'https://guardian-devnet.example.org'],
  extra: 'http://localhost:3001',
  self: 'http://localhost:3000',
};

describe('guardianUrlProblem', () => {
  it('admits exactly what connect-src admits: the listed Guardians', () => {
    expect(guardianUrlProblem('https://guardian.example.org', policy)).toBeNull();
    expect(guardianUrlProblem('https://guardian-devnet.example.org/x', policy)).toBeNull();
    expect(guardianUrlProblem('http://localhost:3001', policy)).toBeNull();
  });

  it('refuses any other Guardian, OpenZeppelin ones included, and says where to add it', () => {
    const problem = guardianUrlProblem('https://guardian-testnet.openzeppelin.com', policy);
    expect(problem).toMatch(/NEXT_PUBLIC_GUARDIAN_ENDPOINTS/);
    expect(problem).toMatch(/https:\/\/guardian\.example\.org, https:\/\/guardian-devnet\.example\.org/);
    expect(guardianUrlProblem('http://guardian.example.org', policy)).not.toBeNull();
    expect(guardianUrlProblem('https://guardian.example.org:8443', policy)).not.toBeNull();
  });

  it('rejects empty and malformed input', () => {
    expect(guardianUrlProblem('  ', policy)).toMatch(/Enter a Guardian URL/);
    expect(guardianUrlProblem('guardian.example.org', policy)).toMatch(/full http/);
    expect(guardianUrlProblem('https://guardian.example.org/?x=1', policy)).toMatch(/without credentials, a query or a fragment/);
    expect(guardianUrlProblem('https://user:pw@guardian.example.org', policy)).toMatch(/without credentials/);
  });
});

describe('normalizeGuardianUrl (re-review of #33: a typed URL is used like an env one)', () => {
  it('drops trailing slashes, which would make the client request "//pubkey"', () => {
    expect(normalizeGuardianUrl(' https://guardian.example.org/ ')).toBe('https://guardian.example.org');
    expect(normalizeGuardianUrl('https://guardian.example.org/api//')).toBe('https://guardian.example.org/api');
    expect(normalizeGuardianUrl('HTTPS://Guardian.Example.org:443')).toBe('https://guardian.example.org');
  });

  it('refuses what an env Guardian URL may not contain', () => {
    for (const value of ['guardian.example.org', 'ftp://guardian.example.org', 'https://guardian.example.org/?q', 'https://a:b@guardian.example.org']) {
      expect(normalizeGuardianUrl(value)).toBeNull();
    }
  });
});

describe('switchGuardianProblem', () => {
  it('flags a switch to a Guardian this deployment cannot reach, and nothing else', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_GUARDIAN_ENDPOINT', 'https://guardian-testnet.example');
    vi.stubEnv('NEXT_PUBLIC_GUARDIAN_ENDPOINTS', 'https://guardian-devnet.example');
    const { switchGuardianProblem } = await import('../../src/lib/guardianUrl');
    const proposal = (newGuardianEndpoint?: string) => ({ metadata: { proposalType: 'switch_guardian', newGuardianEndpoint } });
    expect(switchGuardianProblem(proposal('https://guardian-devnet.example'))).toBeNull();
    expect(switchGuardianProblem(proposal('https://guardian.openzeppelin.com')))
      .toMatch(/switches to https:\/\/guardian\.openzeppelin\.com, which this app cannot reach\. .*NEXT_PUBLIC_GUARDIAN_ENDPOINTS/);
    expect(switchGuardianProblem(proposal())).toMatch(/does not name the new Guardian/);
    expect(switchGuardianProblem({ metadata: { proposalType: 'p2id' } })).toBeNull();
    vi.unstubAllEnvs();
  });
});
