'use client'

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdminAuthStore } from '@/stores/admin-auth';
import { adminRegister, validateInviteCode } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Lock, Ticket, ArrowRight, Shield, CheckCircle, XCircle } from 'lucide-react';

export default function AdminRegisterPage() {
  const router = useRouter();
  const adminLoginStore = useAdminAuthStore();
  const login = adminLoginStore.login;
  const setLoading = adminLoginStore.setLoading;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    inviteCode: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [inviteCodeValid, setInviteCodeValid] = useState<boolean | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '请输入姓名';
    }

    if (!formData.email.trim()) {
      newErrors.email = '请输入邮箱';
    } else if (!formData.email.includes('@') || !formData.email.includes('.')) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    if (!formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码长度至少为6位';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    if (!formData.inviteCode.trim()) {
      newErrors.inviteCode = '请输入邀请码';
    } else if (inviteCodeValid === false) {
      newErrors.inviteCode = '邀请码无效或已过期';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInviteCodeBlur = async () => {
    const code = formData.inviteCode.trim();
    if (!code) {
      setInviteCodeValid(null);
      return;
    }

    setIsValidatingCode(true);
    try {
      const result = await validateInviteCode(code);
      if (result.success && result.valid) {
        setInviteCodeValid(true);
        setErrors((prev) => ({ ...prev, inviteCode: '' }));
      } else {
        setInviteCodeValid(false);
        setErrors((prev) => ({ ...prev, inviteCode: result.error || '邀请码无效' }));
      }
    } catch (error) {
      setInviteCodeValid(false);
      setErrors((prev) => ({ ...prev, inviteCode: '验证邀请码时出错' }));
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) {
      return;
    }

    if (inviteCodeValid !== true) {
      setErrors((prev) => ({ ...prev, inviteCode: '请先验证邀请码' }));
      return;
    }

    setIsLoading(true);
    setLoading(true);

    try {
      const response = await adminRegister({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        inviteCode: formData.inviteCode.trim(),
      });

      if (response.success && response.user && response.token) {
        login(response.user, response.token);
        router.push('/admin');
      } else {
        setErrors({ form: response.error || '注册失败' });
      }
    } catch (err: any) {
      setErrors({ form: err.message || '注册失败，请稍后重试' });
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-20 left-20 opacity-5 animate-float">
        <div className="w-64 h-32 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full blur-3xl"></div>
      </div>
      <div className="absolute bottom-20 right-20 opacity-5 animate-float" style={{ animationDelay: '1s' }}>
        <div className="w-48 h-48 bg-gradient-to-br from-red-500 to-red-600 rounded-full blur-3xl"></div>
      </div>

      <Card className="w-full max-w-md relative z-10 animate-scale-in">
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl border-4 border-white">
            <Shield className="w-8 h-8 text-white" />
          </div>
        </div>

        <CardHeader className="space-y-1 pt-10">
          <div className="flex items-center justify-center mb-2">
            <Shield className="w-6 h-6 text-orange-600" />
            <CardTitle className="text-2xl font-bold text-center mx-2">管理员注册</CardTitle>
          </div>
          <CardDescription className="text-center text-base">
            使用邀请码注册管理员账号
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">姓名</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  id="name"
                  type="text"
                  placeholder="请输入姓名"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-10 h-12 rounded-xl border-gray-200 focus:border-orange-500 focus:ring-orange-500"
                  disabled={isLoading}
                />
              </div>
              {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">邮箱地址</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 h-12 rounded-xl border-gray-200 focus:border-orange-500 focus:ring-orange-500"
                  disabled={isLoading}
                />
              </div>
              {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">密码</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="至少6位密码"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 h-12 rounded-xl border-gray-200 focus:border-orange-500 focus:ring-orange-500"
                  disabled={isLoading}
                />
              </div>
              {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">确认密码</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="再次输入密码"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="pl-10 h-12 rounded-xl border-gray-200 focus:border-orange-500 focus:ring-orange-500"
                  disabled={isLoading}
                />
              </div>
              {errors.confirmPassword && <p className="text-sm text-red-600">{errors.confirmPassword}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="inviteCode" className="text-sm font-medium">邀请码</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Ticket className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  id="inviteCode"
                  type="text"
                  placeholder="请输入管理员邀请码"
                  value={formData.inviteCode}
                  onChange={(e) => {
                    setFormData({ ...formData, inviteCode: e.target.value });
                    setInviteCodeValid(null);
                  }}
                  onBlur={handleInviteCodeBlur}
                  className={`pl-10 pr-10 h-12 rounded-xl border-gray-200 focus:border-orange-500 focus:ring-orange-500 ${
                    inviteCodeValid === true ? 'border-green-500' : ''
                  }`}
                  disabled={isLoading}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  {isValidatingCode && (
                    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {inviteCodeValid === true && !isValidatingCode && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {inviteCodeValid === false && !isValidatingCode && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>
              {errors.inviteCode && <p className="text-sm text-red-600">{errors.inviteCode}</p>}
            </div>

            {errors.form && (
              <div className="text-sm text-red-600 text-center bg-red-50 border border-red-200 p-3 rounded-xl">
                {errors.form}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 font-medium text-base"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  注册中...
                </div>
              ) : (
                '注册管理员账号'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">已有管理员账号？</span>{' '}
            <Link href="/admin/login" className="text-orange-600 hover:text-orange-700 font-medium inline-flex items-center gap-1">
              立即登录
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="mt-4 text-center text-xs text-gray-500">
            <Link href="/" className="hover:text-gray-700">
              返回用户登录
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
