'use client';

import { usePathname } from 'next/navigation';
import Navbar from './navbar';
import { Footer } from './Footer';

const authPaths = ['/login', '/register'];

export function NavbarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNavbar = !authPaths.some(path => pathname?.startsWith(path));

  return (
    <div className="flex flex-col min-h-screen">
      {showNavbar && <Navbar />}
      <main className={`flex-1 ${showNavbar ? '' : 'min-h-screen'}`}>
        {children}
      </main>
      {showNavbar && <Footer />}
    </div>
  );
}
