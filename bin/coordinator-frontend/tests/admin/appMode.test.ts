import { describe, it, expect, afterEach } from 'vitest';

describe('appMode', () => {
  const orig = process.env.NEXT_PUBLIC_APP_MODE;
  afterEach(() => { process.env.NEXT_PUBLIC_APP_MODE = orig; });

  it('defaults to wallet when unset', async () => {
    delete process.env.NEXT_PUBLIC_APP_MODE;
    const mod = await import('@/config/appMode?wallet');
    expect(mod.APP_MODE).toBe('wallet');
    expect(mod.isAdminMode).toBe(false);
  });

  it('is admin only for the exact value "admin"', async () => {
    process.env.NEXT_PUBLIC_APP_MODE = 'admin';
    const mod = await import('@/config/appMode?admin');
    expect(mod.APP_MODE).toBe('admin');
    expect(mod.isAdminMode).toBe(true);
  });
});
