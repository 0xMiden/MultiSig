import React from 'react';
import { AppHeader } from '@/components/AppHeader';
import { ClientStartupNotice } from '@/components/ClientStartupNotice';

export const dynamic = 'force-dynamic';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <ClientStartupNotice />
      {children}
    </>
  );
}
