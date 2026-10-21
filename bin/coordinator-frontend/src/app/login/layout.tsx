import React from 'react';
import { AppHeader } from '@/components/AppHeader';
import { ClientStartupNotice, StoreResetNotice } from '@/components/ClientStartupNotice';

export const dynamic = 'force-dynamic';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <ClientStartupNotice />
      <StoreResetNotice className="mx-auto mt-3 w-[90%] md:w-[70%]" />
      {children}
    </>
  );
}
