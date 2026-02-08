'use client'

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { postAuth } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const setLoading = useAuthStore((state) => state.setLoading);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('请输入姓名');
      return;
    }

    if (!email.trim()) {
      setError('请输入邮箱');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setError('请输入有效的邮箱地址');
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少为6位');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    setLoading(true);

    try {
      const response = await postAuth('/auth/register', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (response.success && response.user && response.token) {
        login(response.user, response.token);
        router.push('/dashboard');
      } else {
        setError(response.error || '注册失败');
      }
    } catch (err: any) {
      console.error('注册错误:', err);

      if (err.status === 400) {
        setError(err.message || '请求参数错误');
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('网络错误，请稍后重试');
      }
    } finally {
      setIsLoading(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-20 left-20 opacity-5 animate-float">
        <div className="w-64 h-32 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full blur-3xl"></div>
      </div>
      <div className="absolute bottom-20 right-20 opacity-5 animate-float" style={{ animationDelay: '1s' }}>
        <div className="w-48 h-48 bg-gradient-to-br from-red-500 to-red-600 rounded-full blur-3xl"></div>
      </div>

      <Card className="w-full max-w-md relative z-10 animate-scale-in">
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl border-4 border-white">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
        </div>

        <CardHeader className="space-y-1 pt-10">
          <div className="flex items-center justify-center mb-2">
            <Sparkles className="w-6 h-6 text-orange-500 animate-pulse-slow" />
            <CardTitle className="text-2xl font-bold text-center mx-2">创建账户</CardTitle>
            <Sparkles className="w-6 h-6 text-orange-500 animate-pulse-slow" />
          </div>
          <CardDescription className="text-center text-base">
            加入传家之宝，开始传承家族记忆
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <Label htmlFor="name" className="text-sm font-medium">姓名</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  id="name"
                  type="text"
                  placeholder="您的姓名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10 h-12 rounded-xl border-gray-200 focus:border-orange-500 focus:ring-orange-500 transition-all duration-300"
                />
              </div>
            </div>

            <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Label htmlFor="email" className="text-sm font-medium">邮箱地址</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10 h-12 rounded-xl border-gray-200 focus:border-orange-500 focus:ring-orange-500 transition-all duration-300"
                />
              </div>
            </div>

            <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <Label htmlFor="password" className="text-sm font-medium">密码</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="至少6位"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10 h-12 rounded-xl border-gray-200 focus:border-orange-500 focus:ring-orange-500 transition-all duration-300"
                />
              </div>
            </div>

            <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <Label htmlFor="confirmPassword" className="text-sm font-medium">确认密码</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10 h-12 rounded-xl border-gray-200 focus:border-orange-500 focus:ring-orange-500 transition-all duration-300"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 text-center bg-red-50 border border-red-200 p-3 rounded-xl animate-fade-in">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 font-medium text-base animate-slide-up"
              disabled={isLoading}
              style={{ animationDelay: '0.5s' }}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  注册中...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  注册
                  <ArrowRight className="w-5 h-5" />
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <span className="text-gray-600">已有账号？</span>{' '}
            <Link href="/login" className="text-orange-600 hover:text-orange-700 font-medium inline-flex items-center gap-1 transition-colors duration-300">
              立即登录
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
