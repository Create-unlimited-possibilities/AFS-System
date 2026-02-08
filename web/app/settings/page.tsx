'use client'

import { useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PermissionGate } from '@/components/PermissionGate';
import { Settings as SettingsIcon, Users, Shield, Server, Moon, Sun, Bell, Lock } from 'lucide-react';
import CloudPattern from '@/components/decorations/CloudPattern'

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen gradient-bg">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto relative">
          <div className="absolute top-10 right-10 opacity-10 animate-float">
            <CloudPattern className="w-32 h-16 text-orange-500" />
          </div>

          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <SettingsIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">设置</h1>
                <p className="text-gray-600 mt-1">管理您的应用偏好</p>
              </div>
            </div>

            <PermissionGate permissions={['user:view', 'role:view', 'system:view']} requireAll={false}>
              <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200 hover:shadow-xl transition-all duration-300 animate-slide-up">
                <CardHeader>
                  <CardTitle className="text-xl text-gray-900">管理员设置</CardTitle>
                  <CardDescription className="text-gray-600">系统管理和配置</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <PermissionGate permissions={['user:view']}>
                    <Link href="/settings/users" className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-white transition-all duration-300 group">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">用户管理</div>
                        <div className="text-sm text-gray-600">管理系统用户</div>
                      </div>
                    </Link>
                  </PermissionGate>
                  <PermissionGate permissions={['role:view']}>
                    <Link href="/settings/roles" className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-white transition-all duration-300 group">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Shield className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">角色管理</div>
                        <div className="text-sm text-gray-600">配置角色和权限</div>
                      </div>
                    </Link>
                  </PermissionGate>
                  <PermissionGate permissions={['system:view']}>
                    <Link href="/settings/system" className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-purple-400 hover:bg-white transition-all duration-300 group">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Server className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">系统设置</div>
                        <div className="text-sm text-gray-600">配置系统参数</div>
                      </div>
                    </Link>
                  </PermissionGate>
                </CardContent>
              </Card>
            </PermissionGate>

            <Card className="hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl text-gray-900">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center">
                    <Sun className="h-5 w-5 text-white dark:hidden" />
                    <Moon className="h-5 w-5 text-white hidden dark:block" />
                  </div>
                  外观
                </CardTitle>
                <CardDescription className="text-gray-600">自定义应用的外观设置</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-orange-100">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">深色模式</Label>
                    <p className="text-sm text-gray-600">
                      切换应用的主题模式
                    </p>
                  </div>
                  <ThemeToggle />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl text-gray-900">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                    <Bell className="h-5 w-5 text-white" />
                  </div>
                  通知
                </CardTitle>
                <CardDescription className="text-gray-600">管理通知偏好设置</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border-2 border-orange-100">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">邮件通知</Label>
                    <p className="text-sm text-gray-600">
                      接收重要更新的邮件通知
                    </p>
                  </div>
                  <input type="checkbox" className="h-6 w-6 rounded border-2 border-orange-200 text-orange-600 focus:ring-orange-500" defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-all duration-300 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl text-gray-900">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Lock className="h-5 w-5 text-white" />
                  </div>
                  隐私
                </CardTitle>
                <CardDescription className="text-gray-600">管理您的隐私设置</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border-2 border-blue-100">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">公开资料</Label>
                    <p className="text-sm text-gray-600">
                      让其他用户可以查看您的基本信息
                    </p>
                  </div>
                  <input type="checkbox" className="h-6 w-6 rounded border-2 border-blue-200 text-blue-600 focus:ring-blue-500" defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border-2 border-blue-100">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">情感记忆权限</Label>
                    <p className="text-sm text-gray-600">
                      仅家庭成员可查看您的情感记忆
                    </p>
                  </div>
                  <input type="checkbox" className="h-6 w-6 rounded border-2 border-blue-200 text-blue-600 focus:ring-blue-500" />
                </div>
              </CardContent>
            </Card>

            {saved && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 text-green-700 px-6 py-4 rounded-xl text-center text-base font-medium animate-fade-in">
                设置已保存 ✓
              </div>
            )}

            <div className="flex justify-end animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <Button
                onClick={handleSave}
                size="lg"
                className="gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
              >
                保存设置
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
