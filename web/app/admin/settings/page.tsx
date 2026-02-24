'use client'

import { usePermissionStore } from '@/stores/permission';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  Settings,
  Key,
  Shield,
  Users,
  Ticket,
  ChevronRight,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const { can } = usePermissionStore();

  const settingsSections = [
    {
      title: '环境变量',
      description: '管理系统环境变量和配置',
      icon: Key,
      href: '/admin/settings/env',
      permission: 'system:view',
      badge: '配置',
    },
    {
      title: '邀请码管理',
      description: '创建和管理管理员注册邀请码',
      icon: Ticket,
      href: '/admin/settings/invite-codes',
      permission: 'invitecode:view',
      badge: '访问',
    },
    {
      title: '角色权限',
      description: '管理系统角色和权限分配',
      icon: Shield,
      href: '/admin/roles',
      permission: 'role:view',
      badge: '管理',
    },
  ];

  const filteredSections = settingsSections.filter(
    (section) => !section.permission || can(section.permission)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
        <p className="text-gray-600">配置系统参数和管理权限</p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="hover:shadow-lg transition-all cursor-pointer h-full group">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-lg bg-gray-100 group-hover:bg-orange-100 transition-colors">
                      <Icon className="w-6 h-6 text-gray-600 group-hover:text-orange-600 transition-colors" />
                    </div>
                    {section.badge && (
                      <Badge variant="outline">{section.badge}</Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-4">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-orange-600 text-sm font-medium">
                    访问
                    <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            系统信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">系统版本</dt>
              <dd className="font-medium">AFS System v1.0.0</dd>
            </div>
            <div>
              <dt className="text-gray-500">运行环境</dt>
              <dd className="font-medium">Production</dd>
            </div>
            <div>
              <dt className="text-gray-500">Node.js 版本</dt>
              <dd className="font-medium">v18.x</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
