'use client'

import { useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PermissionGate } from '@/components/PermissionGate';
import { Settings as SettingsIcon, Users, Shield, Server } from 'lucide-react';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3 mb-8">
            <SettingsIcon className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">设置</h1>
              <p className="text-muted-foreground">管理您的应用偏好</p>
            </div>
          </div>

          <PermissionGate permissions={['user:view', 'role:view', 'system:view']} requireAll={false}>
            <Card>
              <CardHeader>
                <CardTitle>管理员设置</CardTitle>
                <CardDescription>系统管理和配置</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PermissionGate permissions={['user:view']}>
                  <Link href="/settings/users" className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <Users className="h-6 w-6 text-blue-600" />
                    <div>
                      <div className="font-medium">用户管理</div>
                      <div className="text-sm text-muted-foreground">管理系统用户</div>
                    </div>
                  </Link>
                </PermissionGate>
                <PermissionGate permissions={['role:view']}>
                  <Link href="/settings/roles" className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <Shield className="h-6 w-6 text-green-600" />
                    <div>
                      <div className="font-medium">角色管理</div>
                      <div className="text-sm text-muted-foreground">配置角色和权限</div>
                    </div>
                  </Link>
                </PermissionGate>
                <PermissionGate permissions={['system:view']}>
                  <Link href="/settings/system" className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <Server className="h-6 w-6 text-purple-600" />
                    <div>
                      <div className="font-medium">系统设置</div>
                      <div className="text-sm text-muted-foreground">配置系统参数</div>
                    </div>
                  </Link>
                </PermissionGate>
              </CardContent>
            </Card>
          </PermissionGate>

          <Card>
            <CardHeader>
              <CardTitle>外观</CardTitle>
              <CardDescription>自定义应用的外观设置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>深色模式</Label>
                  <p className="text-sm text-muted-foreground">
                    切换应用的主题模式
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>通知</CardTitle>
              <CardDescription>管理通知偏好设置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>邮件通知</Label>
                  <p className="text-sm text-muted-foreground">
                    接收重要更新的邮件通知
                  </p>
                </div>
                <input type="checkbox" className="h-5 w-5 rounded" defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>隐私</CardTitle>
              <CardDescription>管理您的隐私设置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>公开资料</Label>
                  <p className="text-sm text-muted-foreground">
                    让其他用户可以查看您的基本信息
                  </p>
                </div>
                <input type="checkbox" className="h-5 w-5 rounded" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>情感记忆权限</Label>
                  <p className="text-sm text-muted-foreground">
                    仅家庭成员可查看您的情感记忆
                  </p>
                </div>
                <input type="checkbox" className="h-5 w-5 rounded" />
              </div>
            </CardContent>
          </Card>

          {saved && (
            <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-4 py-3 rounded-md text-center text-sm">
              设置已保存
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} size="lg">
              保存设置
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
