export const APP_MODE: 'wallet' | 'admin' =
  process.env.NEXT_PUBLIC_APP_MODE === 'admin' ? 'admin' : 'wallet';
export const isAdminMode = APP_MODE === 'admin';
