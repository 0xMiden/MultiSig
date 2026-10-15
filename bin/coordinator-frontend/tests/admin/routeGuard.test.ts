import { describe, it, expect } from 'vitest';
import { adminRouteGuard } from '@/lib/admin/routeGuard';

describe('adminRouteGuard', () => {
  describe('admin mode (adminMode = true)', () => {
    it('redirects /dashboard/home to the admin mask', () => {
      expect(adminRouteGuard('/dashboard/home', true)).toEqual({ redirectTo: '/dashboard/admin' });
    });

    it('redirects /dashboard/assets to the admin mask', () => {
      expect(adminRouteGuard('/dashboard/assets', true)).toEqual({ redirectTo: '/dashboard/admin' });
    });

    it('redirects bare /dashboard to the admin mask', () => {
      expect(adminRouteGuard('/dashboard', true)).toEqual({ redirectTo: '/dashboard/admin' });
    });

    it('allows /dashboard/admin itself', () => {
      expect(adminRouteGuard('/dashboard/admin', true)).toBeNull();
    });

    it('allows other dashboard routes', () => {
      expect(adminRouteGuard('/dashboard/transactions', true)).toBeNull();
      expect(adminRouteGuard('/dashboard/settings', true)).toBeNull();
    });
  });

  describe('wallet mode (adminMode = false)', () => {
    it('redirects /dashboard/admin to the wallet home', () => {
      expect(adminRouteGuard('/dashboard/admin', false)).toEqual({ redirectTo: '/dashboard/home' });
    });

    it('redirects nested /dashboard/admin/* routes to the wallet home', () => {
      expect(adminRouteGuard('/dashboard/admin/x', false)).toEqual({ redirectTo: '/dashboard/home' });
    });

    it('allows /dashboard/home', () => {
      expect(adminRouteGuard('/dashboard/home', false)).toBeNull();
    });

    it('allows other dashboard routes', () => {
      expect(adminRouteGuard('/dashboard/assets', false)).toBeNull();
      expect(adminRouteGuard('/dashboard/transactions', false)).toBeNull();
    });
  });

  describe('non-dashboard paths', () => {
    it('never redirects /login, in either mode', () => {
      expect(adminRouteGuard('/login', true)).toBeNull();
      expect(adminRouteGuard('/login', false)).toBeNull();
    });
  });
});
