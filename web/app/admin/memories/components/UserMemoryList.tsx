'use client'

import { ChevronRight, Database, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { UserMemorySummary } from '@/lib/admin-api';
import { Search } from 'lucide-react';

interface UserMemoryListProps {
  users: UserMemorySummary[];
  isLoading: boolean;
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  onSearchChange: (search: string) => void;
  searchQuery: string;
}

export function UserMemoryList({
  users,
  isLoading,
  selectedUserId,
  onSelectUser,
  onSearchChange,
  searchQuery,
}: UserMemoryListProps) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="搜索用户..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* User List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              {searchQuery ? '没有找到匹配的用户' : '暂无用户数据'}
            </CardContent>
          </Card>
        ) : (
          users.map((user) => (
            <Card
              key={user._id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedUserId === user._id
                  ? 'ring-2 ring-orange-500 bg-orange-50'
                  : ''
              }`}
              onClick={() => onSelectUser(user._id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">
                          {user.name}
                        </h3>
                        {user.roleCardGenerated && (
                          <Badge variant="secondary" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            角色卡
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{user.email}</p>
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {user.uniqueCode}
                      </code>
                    </div>
                  </div>

                  {/* Stats & Actions */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm">
                        <Database className="w-3 h-3 text-gray-400" />
                        <span className="font-medium">{user.memoryCount}</span>
                        <span className="text-gray-500">条记忆</span>
                      </div>
                      {user.vectorIndexExists ? (
                        <Badge variant="default" className="text-xs mt-1 bg-green-100 text-green-700 border-green-300">
                          索引已创建
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs mt-1 text-gray-500">
                          无索引
                        </Badge>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
