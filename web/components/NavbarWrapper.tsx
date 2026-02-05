'use client';

import { usePathname } from 'next/navigation';
import Navbar from './navbar';

const authPaths = ['/login', '/register'];

export function NavbarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNavbar = !authPaths.some(path => pathname?.startsWith(path));

  return (
    <>
      {showNavbar && <Navbar />}
      <main className={showNavbar ? '' : 'min-h-screen'}>
        {children}
      </main>
    </>
  );
}
