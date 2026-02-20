'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, MessageSquare, Users, FileText, LogOut, User, Sparkles, MessageCircle, Menu, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { useNavigationGuard } from '@/components/NavigationGuardContext'

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/dashboard', label: '个人中心', icon: User },
  { href: '/questions', label: '回答问题', icon: MessageSquare },
  { href: '/answers', label: '查看回答', icon: FileText },
  { href: '/assist', label: '协助关系', icon: Users },
  { href: '/rolecard', label: '角色卡', icon: Sparkles },
  { href: '/chat', label: 'AI对话', icon: MessageCircle },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { checkAndBlock } = useNavigationGuard()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault()
    setMobileMenuOpen(false)
    const isBlocked = checkAndBlock(href, () => {
      router.push(href)
    })
    if (!isBlocked) {
      router.push(href)
    }
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* 左侧：品牌名称 */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-primary">传家之宝</span>
          </Link>

          {/* 桌面端：完整导航 */}
          <div className="hidden md:flex items-center space-x-1">
            {isAuthenticated ? (
              <>
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <Link key={item.href} href={item.href} onClick={(e) => handleNavClick(e, item.href)}>
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

          {/* 手机端：用户名 + 登出 + 汉堡菜单 */}
          <div className="flex md:hidden items-center space-x-2">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user?.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="gap-1 px-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">退出</span>
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm">登录</Button>
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* 手机端：下拉菜单 */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t">
            <div className="flex flex-col space-y-1">
              {isAuthenticated ? (
                <>
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={(e) => handleNavClick(e, item.href)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">登录</Button>
                  </Link>
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="default" className="w-full">注册</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
