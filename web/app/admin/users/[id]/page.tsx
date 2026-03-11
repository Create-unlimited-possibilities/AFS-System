'use client'

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { usePermissionStore } from '@/stores/permission';
import { getUser, updateUser, toggleUserStatus, resetUserPassword, type AdminUser, type UserProfile } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Mail,
  User,
  Shield,
  Calendar,
  Activity,
  Ban,
  CheckCircle,
  Eye,
  EyeOff,
  MapPin,
  Briefcase,
  Heart,
  Users,
  Settings,
  ChevronDown,
  ChevronUp,
  Key,
  Lock,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import RoleCardViewerV2 from '@/app/rolecard/components/RoleCardViewerV2';
import { ZiweiChartCard } from './components/ZiweiChartCard';

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { can } = usePermissionStore();

  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRoleCardExpanded, setIsRoleCardExpanded] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    isActive: true,
  });

  // Reset password state
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    action: '' as 'toggle' | 'delete',
    targetStatus: false,
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadUser();
  }, [params.id]);

  const loadUser = async () => {
    setIsLoading(true);
    try {
      const result = await getUser(params.id as string);
      if (result.success && result.user) {
        setUser(result.user);
        setEditData({
          name: result.user.name,
          email: result.user.email,
          isActive: result.user.isActive,
        });
      } else {
        setError('加载用户信息失败');
      }
    } catch (err) {
      setError('加载用户信息失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await updateUser(params.id as string, {
        name: editData.name,
        email: editData.email,
      });

      if (result.success && result.user) {
        setUser(result.user);
        setIsEditing(false);
        setSuccess('用户信息已更新');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error || '更新失败');
      }
    } catch (err) {
      setError('更新失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = !user?.isActive;
    try {
      const result = await toggleUserStatus(params.id as string, newStatus);
      if (result.success && result.user) {
        setUser(result.user);
        setSuccess(`用户已${newStatus ? '启用' : '禁用'}`);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error || '操作失败');
      }
    } catch (err) {
      setError('操作失败');
    }
  };

  const openToggleDialog = () => {
    setConfirmDialog({
      isOpen: true,
      action: 'toggle',
      targetStatus: !user?.isActive,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">用户不存在</p>
      </div>
    );
  }

  const profile = user.profile;
  const profileCompletion = user.profileCompletion;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/admin/users')}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">用户详情</h1>
          <p className="text-gray-600">查看和管理用户信息</p>
        </div>
        {can('user:update') && !isEditing && (
          <Button
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
            onClick={() => setIsEditing(true)}
          >
            <Edit className="w-4 h-4 mr-2" />
            编辑
          </Button>
        )}
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-2xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <CardTitle className="text-2xl">{user.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4" />
                  {user.email}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user.isActive ? (
                <Badge variant="default" className="bg-green-100 text-green-700 border-green-300">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  激活
                </Badge>
              ) : (
                <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-300">
                  <Ban className="w-3 h-3 mr-1" />
                  禁用
                </Badge>
              )}
              {user.role && (
                <Badge variant="secondary">
                  <Shield className="w-3 h-3 mr-1" />
                  {user.role.name}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                姓名
              </Label>
              {isEditing ? (
                <Input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  placeholder="用户姓名"
                />
              ) : (
                <p className="text-gray-900 font-medium">{user.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                邮箱
              </Label>
              {isEditing ? (
                <Input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  placeholder="用户邮箱"
                />
              ) : (
                <p className="text-gray-900 font-medium">{user.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>唯一码</Label>
              <code className="block bg-gray-100 px-3 py-2 rounded-lg text-sm">
                {user.uniqueCode}
              </code>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                角色
              </Label>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <Select
                    value={user.role?._id || ''}
                    onValueChange={() => {}}
                    disabled
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择角色" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">管理员</SelectItem>
                      <SelectItem value="user">普通用户</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={user.role?.name === '管理员' ? 'default' : 'secondary'}>
                    {user.role?.name || '普通用户'}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                注册时间
              </Label>
              <p className="text-gray-600">
                {new Date(user.createdAt).toLocaleString('zh-CN')}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                最后登录
              </Label>
              <p className="text-gray-600">
                {user.lastLogin
                  ? new Date(user.lastLogin).toLocaleString('zh-CN')
                  : '从未登录'}
              </p>
            </div>
          </div>

          {/* Edit Actions */}
          {isEditing && (
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    保存更改
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setEditData({
                    name: user.name,
                    email: user.email,
                    isActive: user.isActive,
                  });
                }}
                disabled={isSaving}
              >
                <X className="w-4 h-4 mr-2" />
                取消
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            账户信息
          </CardTitle>
          <CardDescription>账户登录和身份验证信息</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                账号
              </Label>
              <p className="text-gray-900 font-medium">{user.email}</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                密码
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 px-3 py-2 rounded-lg text-sm">
                  {user.hasPassword === false ? (
                    <span className="text-gray-500">未设置密码</span>
                  ) : (
                    <span className="text-green-600 flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      已设置密码
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="flex items-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  重置密码
                </Button>
              </div>
              {showResetPassword && (
                <div className="mt-3 p-4 bg-orange-50 rounded-lg border border-orange-200 space-y-3">
                  <p className="text-sm text-orange-700 font-medium">设置新密码</p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="输入新密码（至少6位）"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={async () => {
                        if (newPassword.length < 6) {
                          setError('密码长度必须至少6位');
                          return;
                        }
                        setIsResettingPassword(true);
                        try {
                          const result = await resetUserPassword(user._id, newPassword);
                          if (result.success) {
                            setSuccess('密码已重置');
                            setNewPassword('');
                            setShowResetPassword(false);
                            setTimeout(() => setSuccess(''), 3000);
                          } else {
                            setError(result.error || '重置失败');
                          }
                        } catch (err) {
                          setError('重置密码失败');
                        } finally {
                          setIsResettingPassword(false);
                        }
                      }}
                      disabled={isResettingPassword || newPassword.length < 6}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      {isResettingPassword ? '重置中...' : '确认重置'}
                    </Button>
                  </div>
                  <p className="text-xs text-orange-600">新密码将立即生效，用户需使用新密码登录</p>
                </div>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>唯一码</Label>
              <code className="block bg-gray-100 px-3 py-2 rounded-lg text-sm">
                {user.uniqueCode}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-purple-600" />
            个人资料
          </CardTitle>
          <CardDescription>用户个人信息和资料完成状态</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Completion Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">资料完成状态</p>
                {profileCompletion?.missingFields && profileCompletion.missingFields.length > 0 && (
                  <p className="text-sm text-gray-500">
                    缺失字段: {profileCompletion.missingFields.join(', ')}
                  </p>
                )}
              </div>
            </div>
            {profileCompletion ? (
              profileCompletion.isComplete ? (
                <Badge className="bg-green-100 text-green-700 border-green-300">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  已填写
                </Badge>
              ) : (
                <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
                  未填写
                </Badge>
              )
            ) : (
              <Badge variant="secondary">未知</Badge>
            )}
          </div>

          {/* Profile Details */}
          {profile && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                详细信息
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Gender & Birth Date */}
                {profile.gender && (
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-500">性别</Label>
                    <p className="text-gray-900">{profile.gender}</p>
                  </div>
                )}
                {profile.birthDate && (
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-500">出生日期</Label>
                    <p className="text-gray-900">
                      {profile.birthDate}
                      {profile.birthHour && ` ${profile.birthHour}`}
                      {profile.birthCalendar && ` (${profile.birthCalendar})`}
                    </p>
                  </div>
                )}

                {/* Birth Place */}
                {profile.birthPlace && (profile.birthPlace.provinceName || profile.birthPlace.cityName) && (
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      出生地
                    </Label>
                    <p className="text-gray-900">
                      {[profile.birthPlace.provinceName, profile.birthPlace.cityName].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}

                {/* Residence */}
                {profile.residence && (profile.residence.provinceName || profile.residence.cityName) && (
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      现居地
                    </Label>
                    <p className="text-gray-900">
                      {[profile.residence.provinceName, profile.residence.cityName].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}

                {/* Nationality & Ethnicity */}
                {profile.nationality && (
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-500">国籍</Label>
                    <p className="text-gray-900">{profile.nationality}</p>
                  </div>
                )}
                {profile.ethnicity && (
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-500">民族</Label>
                    <p className="text-gray-900">{profile.ethnicity}</p>
                  </div>
                )}

                {/* Occupation & Education */}
                {profile.occupation && (
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-500 flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      职业
                    </Label>
                    <p className="text-gray-900">{profile.occupation}</p>
                  </div>
                )}
                {profile.education && (
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-500">学历</Label>
                    <p className="text-gray-900">{profile.education}</p>
                  </div>
                )}

                {/* Marital Status */}
                {profile.maritalStatus && (
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-500 flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      婚姻状况
                    </Label>
                    <p className="text-gray-900">{profile.maritalStatus}</p>
                  </div>
                )}

                {/* Children */}
                {profile.children && (profile.children.sons || profile.children.daughters) && (
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-500 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      子女
                    </Label>
                    <p className="text-gray-900">
                      {profile.children.sons || 0}子 {profile.children.daughters || 0}女
                    </p>
                  </div>
                )}

                {/* Height */}
                {profile.height && (
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-500">身高</Label>
                    <p className="text-gray-900">{profile.height}</p>
                  </div>
                )}

                {/* Appearance Features */}
                {profile.appearanceFeatures && (
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-sm text-gray-500">外貌特征</Label>
                    <p className="text-gray-900">{profile.appearanceFeatures}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!profile && (
            <div className="text-center py-8 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>暂无个人资料信息</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Card Section */}
      {(user.companionChat?.roleCard || (user as any).roleCard) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-600" />
                  角色卡
                </CardTitle>
                <CardDescription>用户生成的AI角色配置</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRoleCardExpanded(!isRoleCardExpanded)}
                className="flex items-center gap-2"
              >
                {isRoleCardExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    收起
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    展开
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isRoleCardExpanded ? (
              <RoleCardViewerV2 roleCard={user.companionChat?.roleCard || (user as any).roleCard} />
            ) : (
              <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg">
                <div className="p-3 bg-green-100 rounded-full">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-green-900">角色卡已生成</p>
                  <p className="text-sm text-green-700">
                    版本: {(user.companionChat?.roleCard || (user as any).roleCard)?.version || 'V2.0'}
                  </p>
                </div>
                <Badge className="bg-green-100 text-green-700 border-green-300">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  已生成
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ziwei Chart Section */}
      <ZiweiChartCard userId={user._id} profileCompletion={profileCompletion} />

      {/* User Stats Card */}
      {(user.chatBeta?.memoryTokenCount || user.companionChat?.roleCard || (user as any).roleCard) && (
        <Card>
          <CardHeader>
            <CardTitle>用户数据统计</CardTitle>
            <CardDescription>用户的活动数据概览</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {user.chatBeta?.memoryTokenCount !== undefined && (
                <div>
                  <p className="text-sm text-gray-500">记忆Token数量</p>
                  <p className="text-2xl font-bold">{user.chatBeta.memoryTokenCount}</p>
                </div>
              )}
              {(user.companionChat?.roleCard || (user as any).roleCard) && (
                <div>
                  <p className="text-sm text-gray-500">角色卡状态</p>
                  <Badge variant="default">已生成</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions Card */}
      {can('user:update') && !isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>账户操作</CardTitle>
            <CardDescription>管理此用户的账户状态</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant={user.isActive ? 'destructive' : 'default'}
              onClick={openToggleDialog}
              className="w-full sm:w-auto"
            >
              {user.isActive ? (
                <>
                  <Ban className="w-4 h-4 mr-2" />
                  禁用用户
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  启用用户
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={handleToggleStatus}
        title={confirmDialog.targetStatus ? '启用用户' : '禁用用户'}
        description={`确定要${confirmDialog.targetStatus ? '启用' : '禁用'}用户 "${user.name}" 吗？`}
        confirmText={confirmDialog.targetStatus ? '启用' : '禁用'}
        variant="warning"
      />
    </div>
  );
}
