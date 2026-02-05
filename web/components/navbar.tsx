'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageSquare, Users, FileText, LogOut, User } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { useEffect } from 'react'

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/dashboard', label: '个人中心', icon: User },
  { href: '/questions', label: '回答问题', icon: MessageSquare },
  { href: '/answers', label: '查看回答', icon: FileText },
  { href: '/assist', label: '协助关系', icon: Users },
]

export default function Navbar() {
  const pathname = usePathname()
  const { user, isAuthenticated, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-primary">传家之宝</span>
          </Link>

          <div className="flex items-center space-x-1">
            {isAuthenticated ? (
              <>
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant={isActive ? 'default' : 'ghost'}
                        size="sm"
                        className="gap-2"
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Button>
                    </Link>
                  )
                })}
                <div className="flex items-center space-x-2 ml-4 pl-4 border-l">
                  <span className="text-sm text-muted-foreground">
                    {user?.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    退出
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">登录</Button>
                </Link>
                <Link href="/register">
                  <Button variant="default" size="sm">注册</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
