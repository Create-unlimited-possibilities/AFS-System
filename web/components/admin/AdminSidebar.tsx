'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { usePermissionStore } from '@/stores/permission';
import { useAdminAuthStore } from '@/stores/admin-auth';
import {
  LayoutDashboard,
  Users,
  FileQuestion,
  Database,
  Settings,
  Ticket,
  Variable,
  Shield as ShieldIcon,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  badge?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    title: '仪表盘',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    title: '用户管理',
    href: '/admin/users',
    icon: Users,
    permission: 'user:view',
  },
  {
    title: '问卷管理',
    href: '/admin/questionnaires',
    icon: FileQuestion,
    permission: 'questionnaire:view',
  },
  {
    title: '记忆库管理',
    href: '/admin/memories',
    icon: Database,
    permission: 'memory:view',
  },
  {
    title: '角色管理',
    href: '/admin/roles',
    icon: ShieldIcon,
    permission: 'role:view',
  },
  {
    title: '系统设置',
    href: '/admin/settings',
    icon: Settings,
    permission: 'system:view',
    children: [
      {
        title: '邀请码管理',
        href: '/admin/settings/invite-codes',
        icon: Ticket,
        permission: 'invitecode:view',
      },
      {
        title: '环境变量',
        href: '/admin/settings/env',
        icon: Variable,
        permission: 'system:update',
      },
      {
        title: '角色权限',
        href: '/admin/roles',
        icon: ShieldIcon,
        permission: 'role:view',
      },
    ],
  },
];

interface AdminSidebarProps {
  className?: string;
}

export function AdminSidebar({ className }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { can } = usePermissionStore();
  const { admin, logout } = useAdminAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Auto-expand parent items when on a child route
  useEffect(() => {
    navItems.forEach(item => {
      if (item.children && item.children.some(child => pathname?.startsWith(child.href))) {
        setExpandedItems(prev => new Set([...prev, item.href]));
      }
    });
  }, [pathname]);

  const handleLogout = () => {
    logout();
    router.push('/admin/login');
  };

  const filteredNavItems = navItems.filter((item) => {
    if (!item.permission) return true;
    return can(item.permission);
  });

  const toggleExpanded = (href: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(href)) {
        newSet.delete(href);
      } else {
        newSet.add(href);
      }
      return newSet;
    });
  };

  const renderNavItem = (item: NavItem, level = 0): React.ReactNode => {
    const hasChildren = item.children && item.children.length > 0;
    // For items with children, use startsWith for nested route matching
    // For items without children (like Dashboard), use exact match only
    const isActive = hasChildren
      ? (pathname === item.href || pathname?.startsWith(item.href + '/'))
      : pathname === item.href;
    const isExpanded = expandedItems.has(item.href);
    const Icon = item.icon;

    // Filter children by permissions
    const filteredChildren = hasChildren
      ? item.children!.filter(child => {
          if (!child.permission) return true;
          return can(child.permission);
        })
      : [];

    return (
      <li key={item.href}>
        <div
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
            isActive
              ? 'bg-orange-500 text-white shadow-lg'
              : 'text-gray-300 hover:bg-gray-700 hover:text-white',
            isCollapsed && 'justify-center'
          )}
          title={isCollapsed ? item.title : undefined}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
        >
          <Link
            href={item.href}
            className="flex items-center gap-3 flex-1 min-w-0"
            onClick={() => {
              // Also expand when navigating to a parent item
              if (hasChildren && !isExpanded) {
                toggleExpanded(item.href);
              }
            }}
          >
            <Icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-white')} />
            {!isCollapsed && (
              <span className="flex-1 truncate">{item.title}</span>
            )}
          </Link>
          {!isCollapsed && hasChildren && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleExpanded(item.href);
              }}
              className="p-1 hover:bg-gray-600 rounded transition-colors flex-shrink-0"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronRight
                className={cn(
                  'w-4 h-4 transition-transform',
                  isExpanded && 'rotate-90'
                )}
              />
            </button>
          )}
          {!isCollapsed && item.badge && (
            <span className="px-2 py-0.5 text-xs bg-red-500 rounded-full flex-shrink-0">
              {item.badge}
            </span>
          )}
        </div>
        {hasChildren && !isCollapsed && isExpanded && (
          <ul className="mt-1 space-y-1">
            {filteredChildren.map(child => renderNavItem(child, level + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        {isCollapsed ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64',
          'lg:translate-x-0',
          className
        )}
      >
        {/* Logo/Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <ShieldIcon className="w-8 h-8 text-orange-500" />
              <div>
                <h1 className="font-bold text-lg">管理后台</h1>
                <p className="text-xs text-gray-400">AFS System</p>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="flex justify-center w-full">
              <ShieldIcon className="w-8 h-8 text-orange-500" />
            </div>
          )}
        </div>

        {/* User Info */}
        {!isCollapsed && (
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center font-semibold">
                {admin?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{admin?.name || '管理员'}</p>
                <p className="text-xs text-gray-400 truncate">{admin?.email || ''}</p>
              </div>
            </div>
            <div className="mt-2 text-xs">
              <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full">
                {admin?.role?.name || '管理员'}
              </span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {filteredNavItems.map(item => renderNavItem(item))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-300 hover:bg-red-500/20 hover:text-red-400 transition-colors',
              isCollapsed && 'justify-center'
            )}
            title={isCollapsed ? '退出登录' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span>退出登录</span>}
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}
    </>
  );
}
