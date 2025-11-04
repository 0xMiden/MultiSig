import { useEffect } from 'react';

export const useAuth = () => {
  useEffect(() => {
    // Sync localStorage with cookies on client side
    const walletId = localStorage.getItem('currentWalletId');
    if (walletId) {
      // Set cookie if it doesn't exist
      const existingCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('currentWalletId='));
      
      if (!existingCookie) {
        document.cookie = `currentWalletId=${walletId}; path=/; max-age=31536000`;
      }
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('currentWalletId');
    document.cookie = 'currentWalletId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  };

  const setWalletId = (walletId: string) => {
    localStorage.setItem('currentWalletId', walletId);
    document.cookie = `currentWalletId=${walletId}; path=/; max-age=31536000`;
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