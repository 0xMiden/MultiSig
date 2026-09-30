import { useEffect } from 'react';
import { clearWalletCookie, setWalletCookie } from '@/lib/walletCookie';

export const useAuth = () => {
  useEffect(() => {
    // Sync localStorage with the cookie. Always rewrite it, so a cookie set
    // before the SameSite/Secure attributes existed gets upgraded.
    const walletId = localStorage.getItem('currentWalletId');
    if (walletId) setWalletCookie(walletId);
  }, []);

  const logout = () => {
    localStorage.removeItem('currentWalletId');
    clearWalletCookie();
  };

  const setWalletId = (walletId: string) => {
    localStorage.setItem('currentWalletId', walletId);
    setWalletCookie(walletId);
  };

  const getWalletId = () => {
    return localStorage.getItem('currentWalletId');
  };

  return {
    logout,
    setWalletId,
    getWalletId,
  };
}; 