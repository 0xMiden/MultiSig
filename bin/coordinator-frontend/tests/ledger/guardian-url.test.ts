import { describe, expect, it } from 'vitest';
import { guardianUrlProblem } from '../../src/lib/guardianUrl';

const policy = { configured: 'https://guardian.example.org/api', extra: 'https://g2.example.net, http://localhost:3001', self: 'http://localhost:3000' };

describe('guardianUrlProblem', () => {
  it('admits exactly what connect-src admits', () => {
    expect(guardianUrlProblem('https://guardian.example.org', policy)).toBeNull();
    expect(guardianUrlProblem('https://guardian-devnet.openzeppelin.com', policy)).toBeNull();
    expect(guardianUrlProblem('https://g2.example.net/x', policy)).toBeNull();
    expect(guardianUrlProblem('http://localhost:3001', policy)).toBeNull();
  });

  it('explains a URL the CSP would block', () => {
    expect(guardianUrlProblem('https://evil.example.com', policy)).toMatch(/NEXT_PUBLIC_CSP_CONNECT_SRC/);
    // The wildcard is https on the default port only.
    expect(guardianUrlProblem('http://guardian.openzeppelin.com', policy)).not.toBeNull();
    expect(guardianUrlProblem('https://guardian.openzeppelin.com:8443', policy)).not.toBeNull();
    expect(guardianUrlProblem('https://openzeppelin.com.evil.io', policy)).not.toBeNull();
  });

  it('rejects empty and malformed input', () => {
    expect(guardianUrlProblem('  ', policy)).toMatch(/Enter a Guardian URL/);
    expect(guardianUrlProblem('guardian.example.org', policy)).toMatch(/full http/);
  });
});
