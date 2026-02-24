'use client'

import { useEffect, useState } from 'react';
import { usePermissionStore } from '@/stores/permission';
import {
  getRoles,
  getAllPermissions,
  createRole,
  updateRole,
  deleteRole,
  type RoleWithPermissions,
  type Permission,
} from '@/lib/admin-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Shield, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { PermissionEditor } from './components/PermissionEditor';

export default function RolesPage() {
  const { can } = usePermissionStore();

  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showDialog, setShowDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithPermissions | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissionIds: [] as string[],
  });
  const [isSaving, setIsSaving] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    roleId: string;
    roleName: string;
  }>({ isOpen: false, roleId: '', roleName: '' });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!can('role:view')) return;
    loadData();
  }, [can]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rolesResult, permissionsResult] = await Promise.all([
        getRoles(),
        getAllPermissions(),
      ]);
      if (rolesResult.success && rolesResult.roles) {
        setRoles(rolesResult.roles);
      }
      if (permissionsResult.success && permissionsResult.permissions) {
        setPermissions(permissionsResult.permissions);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRole(null);
    setFormData({ name: '', description: '', permissionIds: [] });
    setShowDialog(true);
  };

  const handleEdit = (role: RoleWithPermissions) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      permissionIds: role.permissions.map((p) => p._id),
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = editingRole
        ? await updateRole(editingRole._id, formData)
        : await createRole(formData);

      if (result.success) {
        showMessage('success', editingRole ? '角色已更新' : '角色已创建');
        setShowDialog(false);
        await loadData();
      } else {
        showMessage('error', result.error || '保存失败');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (role: RoleWithPermissions) => {
    setConfirmDialog({
      isOpen: true,
      roleId: role._id,
      roleName: role.name,
    });
  };

  const handleConfirmDelete = async () => {
    const result = await deleteRole(confirmDialog.roleId);
    if (result.success) {
      showMessage('success', '角色已删除');
      await loadData();
    } else {
      showMessage('error', result.error || '删除失败');
    }
    setConfirmDialog({ isOpen: false, roleId: '', roleName: '' });
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  if (!can('role:view')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">您没有权限查看角色管理</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">角色管理</h1>
          <p className="text-gray-600">管理系统角色和权限</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          {can('role:create') && (
            <Button
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              onClick={handleCreate}
            >
              <Plus className="w-4 h-4 mr-2" />
              添加角色
            </Button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`px-4 py-3 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>总角色数</CardDescription>
            <CardTitle className="text-3xl">{roles.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>系统角色</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {roles.filter((r) => r.isSystem).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>自定义角色</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {roles.filter((r) => !r.isSystem).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Roles List */}
      <Card>
        <CardHeader>
          <CardTitle>角色列表</CardTitle>
          <CardDescription>系统中的所有角色</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {roles.map((role) => (
                <Card key={role._id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-100">
                          <Shield className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {role.name}
                            {role.isSystem && (
                              <Badge variant="secondary" className="text-xs">
                                系统角色
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>{role.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {can('role:update') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(role)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {can('role:delete') && !role.isSystem && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(role)}
                            className="text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 5).map((permission) => (
                        <Badge key={permission._id} variant="outline" className="text-xs">
                          {permission.name}
                        </Badge>
                      ))}
                      {role.permissions.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{role.permissions.length - 5}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      共 {role.permissions.length} 个权限
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto]">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? '编辑角色' : '创建角色'}
            </DialogTitle>
            <DialogDescription>
              {editingRole ? '修改角色信息和权限' : '创建新角色并分配权限'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">角色名称</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如: 内容审核员"
                disabled={editingRole?.isSystem}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="描述这个角色的职责..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>权限</Label>
              <PermissionEditor
                permissions={permissions}
                selectedPermissionIds={formData.permissionIds}
                onSelectionChange={(ids) => setFormData({ ...formData, permissionIds: ids })}
                disabled={editingRole?.isSystem}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.name.trim()}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            >
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={handleConfirmDelete}
        title="删除角色"
        description={`确定要删除角色 "${confirmDialog.roleName}" 吗？此操作不可撤销。`}
        confirmText="删除"
        variant="danger"
      />
    </div>
  );
}
