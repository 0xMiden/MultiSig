import { describe, expect, it } from 'vitest';
import { expiredWalletCookie, walletCookie } from '../../src/lib/walletCookie';

describe('wallet cookie attributes', () => {
  it('is SameSite=Lax and Secure on https', () => {
    const cookie = walletCookie('0xdeadc17b13b218c14cfa7801d10884', 'https:');
    expect(cookie).toBe('currentWalletId=0xdeadc17b13b218c14cfa7801d10884; path=/; max-age=31536000; SameSite=Lax; Secure');
  });

  it('omits Secure on http so local development keeps the cookie', () => {
    expect(walletCookie('0x1', 'http:')).toBe('currentWalletId=0x1; path=/; max-age=31536000; SameSite=Lax');
  });

  it('clears with matching attributes', () => {
    expect(expiredWalletCookie('https:')).toBe('currentWalletId=; path=/; max-age=0; SameSite=Lax; Secure');
  });

  it('encodes the value so it cannot add attributes', () => {
    expect(walletCookie('0x1; domain=evil.example', 'https:')).toMatch(/^currentWalletId=0x1%3B%20domain%3Devil\.example; path=\//);
  });
});
