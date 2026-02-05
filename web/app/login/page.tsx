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

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const setLoading = useAuthStore((state) => state.setLoading);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // 客户端验证
    if (!email.trim()) {
      setError('请输入邮箱');
      return;
    }
    
    if (!password.trim()) {
      setError('请输入密码');
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
    
    setIsLoading(true);
    setLoading(true);

    try {
      const response = await postAuth('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      if (response.success && response.user && response.token) {
        login(response.user, response.token);
        router.push('/dashboard');
      } else {
        setError(response.error || '登录失败');
      }
    } catch (err: any) {
      console.error('登录错误:', err);
      
      // 更详细的错误处理
      if (err.status === 400) {
        setError('请检查输入的邮箱和密码格式');
      } else if (err.status === 401) {
        setError('邮箱或密码错误');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">登录</CardTitle>
          <CardDescription className="text-center">
            欢迎回到传家之宝
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="text-sm text-destructive text-center bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            还没有账号？{' '}
            <Link href="/register" className="text-primary hover:underline">
              立即注册
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
