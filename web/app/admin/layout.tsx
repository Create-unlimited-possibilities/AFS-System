'use client'

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAdminAuthStore } from '@/stores/admin-auth';
import { usePermissionStore } from '@/stores/permission';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Loader2 } from 'lucide-react';
import { isAdmin } from '@/lib/permissions';

interface AdminLayoutProps {
  children: React.ReactNode;
}

// Public admin routes that don't require authentication
const publicRoutes = ['/admin/login', '/admin/register'];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin, isAuthenticated, token, hasHydrated } = useAdminAuthStore();
  const { initializePermissions, clearPermissions } = usePermissionStore();
  const [isChecking, setIsChecking] = useState(true);

  const isPublicRoute = publicRoutes.some((route) =>
    pathname?.startsWith(route)
  );

  useEffect(() => {
    // Wait for hydration to complete
    if (!hasHydrated) {
      return;
    }

    const checkAuth = async () => {
      setIsChecking(true);

      // If public route, no auth check needed
      if (isPublicRoute) {
        setIsChecking(false);
        return;
      }

      // Check authentication
      if (!isAuthenticated || !admin || !token) {
        clearPermissions();
        router.push('/admin/login');
        setIsChecking(false);
        return;
      }

      // Initialize permissions
      if (admin.role) {
        initializePermissions(admin);
      }

      // Check if user has admin role (admin users are already verified by admin auth)
      if (!isAdmin(admin)) {
        // Non-admin user trying to access admin area
        // Clear their session and redirect to admin login
        clearPermissions();
        router.push('/admin/login?error=unauthorized');
        setIsChecking(false);
        return;
      }

      setIsChecking(false);
    };

    checkAuth();
  }, [hasHydrated, isAuthenticated, admin, token, isPublicRoute, router, initializePermissions, clearPermissions]);

  // Show loading while checking auth
  if (!hasHydrated || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">正在验证身份...</p>
        </div>
      </div>
    );
  }

  // Public routes (login, register) don't get the admin layout
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Protected routes get the full admin layout
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="lg:ml-64">
        <AdminHeader />
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
