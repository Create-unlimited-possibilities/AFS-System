'use client'

import Link from 'next/link'
import { ArrowLeft, User } from 'lucide-react'

export function Sidebar() {
  return (
    <aside className="w-16 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <Link
        href="/dashboard"
        className="p-4 hover:bg-gray-50 border-b border-gray-200 flex flex-col items-center"
        title="返回"
      >
        <ArrowLeft className="w-5 h-5 text-gray-600" />
        <span className="text-xs mt-1 text-gray-500">返回</span>
      </Link>
      <Link
        href="/dashboard"
        className="p-4 hover:bg-gray-50 border-b border-gray-200 flex flex-col items-center"
        title="个人中心"
      >
        <User className="w-5 h-5 text-gray-600" />
        <span className="text-xs mt-1 text-gray-500">中心</span>
      </Link>
    </aside>
  )
}
