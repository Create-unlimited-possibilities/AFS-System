'use client'

import { useEffect, useState } from 'react';
import { usePermissionStore } from '@/stores/permission';
import { getInviteCodes, createInviteCode, deleteInviteCode, type InviteCode } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Ticket, Plus, MoreVertical, Copy, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function InviteCodesPage() {
  const { can } = usePermissionStore();

  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCodeData, setNewCodeData] = useState({
    maxUses: 1,
    expiresIn: 24, // hours
  });

  useEffect(() => {
    if (!can('invitecode:view')) {
      return;
    }
    loadCodes();
  }, [can]);

  const loadCodes = async () => {
    setIsLoading(true);
    try {
      const result = await getInviteCodes();
      if (result.success && result.codes) {
        setCodes(result.codes);
      }
    } catch (error) {
      console.error('Failed to load invite codes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCode = async () => {
    setIsCreating(true);
    try {
      const result = await createInviteCode(newCodeData);
      if (result.success && result.code) {
        setCodes([result.code, ...codes]);
        setIsDialogOpen(false);
        setNewCodeData({ maxUses: 1, expiresIn: 24 });
      }
    } catch (error) {
      console.error('Failed to create invite code:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    if (!confirm('确定要删除这个邀请码吗？')) {
      return;
    }

    try {
      const result = await deleteInviteCode(codeId);
      if (result.success) {
        setCodes(codes.filter((c) => c._id !== codeId));
      }
    } catch (error) {
      console.error('Failed to delete invite code:', error);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  if (!can('invitecode:view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">您没有权限查看邀请码管理</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">邀请码管理</h1>
          <p className="text-gray-600">创建和管理管理员注册邀请码</p>
        </div>

        {can('invitecode:create') && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
                <Plus className="w-4 h-4 mr-2" />
                生成邀请码
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>生成新邀请码</DialogTitle>
                <DialogDescription>
                  创建一个新的管理员注册邀请码
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="maxUses">最大使用次数</Label>
                  <Input
                    id="maxUses"
                    type="number"
                    min="1"
                    value={newCodeData.maxUses}
                    onChange={(e) =>
                      setNewCodeData({ ...newCodeData, maxUses: parseInt(e.target.value) || 1 })
                    }
                  />
                  <p className="text-xs text-gray-500">邀请码可以被使用的最大次数</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiresIn">有效期（小时）</Label>
                  <Input
                    id="expiresIn"
                    type="number"
                    min="1"
                    value={newCodeData.expiresIn}
                    onChange={(e) =>
                      setNewCodeData({ ...newCodeData, expiresIn: parseInt(e.target.value) || 24 })
                    }
                  />
                  <p className="text-xs text-gray-500">邀请码的有效期，单位为小时</p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isCreating}
                >
                  取消
                </Button>
                <Button
                  onClick={handleCreateCode}
                  disabled={isCreating}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    '生成邀请码'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总邀请码数</CardDescription>
            <CardTitle className="text-3xl">{codes.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>有效邀请码</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {codes.filter((c) => c.isValid).length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已使用次数</CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              {codes.reduce((sum, c) => sum + c.usedCount, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Invite Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle>邀请码列表</CardTitle>
          <CardDescription>所有创建的管理员注册邀请码</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : codes.length === 0 ? (
            <div className="text-center py-8">
              <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">还没有邀请码</p>
              <p className="text-sm text-gray-400">点击上方按钮生成第一个邀请码</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>邀请码</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>使用情况</TableHead>
                    <TableHead>创建者</TableHead>
                    <TableHead>过期时间</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codes.map((code) => (
                    <TableRow key={code._id}>
                      <TableCell className="font-mono font-medium">
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-100 px-2 py-1 rounded">
                            {code.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(code.code)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>

                      <TableCell>
                        {code.isValid ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm">有效</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-red-600">
                            <XCircle className="w-4 h-4" />
                            <span className="text-sm">无效</span>
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          {code.usedCount} / {code.maxUses}
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div
                              className={`h-1.5 rounded-full ${
                                (code.usedCount / code.maxUses) * 100 >= 100
                                  ? 'bg-red-500'
                                  : 'bg-orange-500'
                              }`}
                              style={{
                                width: `${Math.min((code.usedCount / code.maxUses) * 100, 100)}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-sm">
                        <div>{code.createdBy.name}</div>
                        <div className="text-gray-500 text-xs">{code.createdBy.email}</div>
                      </TableCell>

                      <TableCell className="text-sm">
                        {code.expiresAt
                          ? new Date(code.expiresAt).toLocaleString('zh-CN')
                          : '永久'}
                      </TableCell>

                      <TableCell className="text-sm">
                        {new Date(code.createdAt).toLocaleString('zh-CN')}
                      </TableCell>

                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => copyToClipboard(code.code)}
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              复制邀请码
                            </DropdownMenuItem>
                            {can('invitecode:delete') && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteCode(code._id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
