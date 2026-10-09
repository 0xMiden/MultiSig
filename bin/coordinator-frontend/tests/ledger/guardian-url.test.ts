import { describe, expect, it } from 'vitest';
import { guardianUrlProblem } from '../../src/lib/guardianUrl';

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
  });
});
