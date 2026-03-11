'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { User as UserIcon, Loader2, Save, ArrowLeft, CheckCircle } from 'lucide-react'
import CloudPattern from '@/components/decorations/CloudPattern'
import ProvinceCitySelector from '@/components/ProvinceCitySelector'

// Shichen (时辰) names display mapping
// Maps birth hour (0-23) to the corresponding 时辰 name
const SHICHEN_NAMES: Record<number, string> = {
  0: '早子时 (00:00-01:00)',
  1: '丑时 (01:00-03:00)',
  2: '丑时 (01:00-03:00)',
  3: '寅时 (03:00-05:00)',
  4: '寅时 (03:00-05:00)',
  5: '卯时 (05:00-07:00)',
  6: '卯时 (05:00-07:00)',
  7: '辰时 (07:00-09:00)',
  8: '辰时 (07:00-09:00)',
  9: '巳时 (09:00-11:00)',
  10: '巳时 (09:00-11:00)',
  11: '午时 (11:00-13:00)',
  12: '午时 (11:00-13:00)',
  13: '未时 (13:00-15:00)',
  14: '未时 (13:00-15:00)',
  15: '申时 (15:00-17:00)',
  16: '申时 (15:00-17:00)',
  17: '酉时 (17:00-19:00)',
  18: '酉时 (17:00-19:00)',
  19: '戌时 (19:00-21:00)',
  20: '戌时 (19:00-21:00)',
  21: '亥时 (21:00-23:00)',
  22: '亥时 (21:00-23:00)',
  23: '晚子时 (23:00-00:00)',
}

interface ProfileData {
  gender?: string
  birthDate?: string
  birthHour?: number
  birthCalendar?: 'solar' | 'lunar'
  birthPlace?: {
    provinceCode: string
    provinceName: string
    cityCode: string
    cityName: string
  }
  residence?: {
    provinceCode: string
    provinceName: string
    cityCode: string
    cityName: string
  }
  nationality?: string
  ethnicity?: string
  occupation?: string
  education?: string
  maritalStatus?: string
  children?: {
    sons: number
    daughters: number
  }
  height?: number
  appearanceFeatures?: string
}

export default function ProfilePage() {
  const { user, hasHydrated } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profile, setProfile] = useState<ProfileData>({})
  const [isLocked, setIsLocked] = useState(false)  // 是否锁定（已保存）
  const [isEditing, setIsEditing] = useState(true)  // 是否在编辑模式
  const [hasChanges, setHasChanges] = useState(false)  // 是否有修改
  const [originalProfile, setOriginalProfile] = useState<ProfileData>({})  // 原始数据

  useEffect(() => {
    console.log('[Profile] useEffect 触发:', { hasHydrated, user: user?.email })
    // 等待水合完成后才加载数据
    if (hasHydrated) {
      fetchProfile()
    }
  }, [hasHydrated])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      console.log('[Profile] 开始获取个人档案...')
      const res = await api.get<{ profile?: ProfileData; name: string; email: string }>('/users/profile')
      console.log('[Profile] API 响应:', JSON.stringify(res, null, 2))

      // API 直接返回后端响应，所以是 res.profile 而不是 res.data.profile
      if (res.success && (res as any).profile?.profile) {
        const profileData = (res as any).profile.profile
        console.log('[Profile] 提取的档案数据:', profileData)
        setProfile({
          ...profileData,
          birthDate: profileData.birthDate ? new Date(profileData.birthDate).toISOString().split('T')[0] : undefined
        })
        setOriginalProfile({
          ...profileData,
          birthDate: profileData.birthDate ? new Date(profileData.birthDate).toISOString().split('T')[0] : undefined
        })

        // 如果有必填字段已填写，认为是已保存状态
        if (profileData.gender && profileData.birthDate && profileData.birthPlace?.cityCode) {
          setIsLocked(true)
          setIsEditing(false)
        }
      } else {
        console.log('[Profile] 条件不满足:', { success: res.success, profile: (res as any).profile })
      }
    } catch (error) {
      console.error('获取个人档案失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    // 验证必填字段
    if (!profile.gender) {
      alert('请选择性别')
      return
    }
    if (!profile.birthDate) {
      alert('请选择出生日期')
      return
    }
    if (!profile.birthPlace?.provinceCode || !profile.birthPlace?.cityCode) {
      alert('请选择出生地')
      return
    }
    if (!profile.residence?.provinceCode || !profile.residence?.cityCode) {
      alert('请选择常住地')
      return
    }

    try {
      setSaving(true)
      const res = await api.put<{ success: boolean; message: string }>('/users/profile', profile)
      if (res.success) {
        setSaved(true)
        setIsLocked(true)
        setIsEditing(false)
        setOriginalProfile({...profile})  // 保存原始数据
        setHasChanges(false)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (error) {
      console.error('保存个人档案失败:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const updateProfile = (field: keyof ProfileData, value: any) => {
    setProfile(prev => {
      const newProfile = { ...prev, [field]: value }
      // 检测是否有修改
      setHasChanges(JSON.stringify(newProfile) !== JSON.stringify(originalProfile))
      return newProfile
    })
  }

  const handleEdit = () => {
    setIsEditing(true)
    setHasChanges(false)
  }

  const handleCancelEdit = () => {
    setProfile({...originalProfile})  // 恢复原始数据
    setIsEditing(false)
    setHasChanges(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 text-orange-600 animate-spin" />
            <p className="text-gray-600 mt-4">加载中...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen gradient-bg">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto relative">
          {/* 背景装饰 */}
          <div className="absolute top-10 right-10 opacity-10 animate-float pointer-events-none">
            <CloudPattern className="w-32 h-16 text-orange-500" />
          </div>

          <div className="space-y-6 animate-fade-in">
            {/* 页面头部 */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                  <UserIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">个人档案设置</h1>
                  <p className="text-gray-600 mt-1">完善您的个人信息，用于生成更精准的角色卡</p>
                </div>
              </div>
              <Link href="/rolecard">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  返回角色卡
                </Button>
              </Link>
            </div>

            {/* 基本信息 */}
            <Card className="hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
                <CardDescription>您的账户基本信息</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>姓名</Label>
                    <Input value={user?.name || ''} disabled className="bg-gray-50" />
                    <p className="text-xs text-gray-500">姓名在账户设置中修改</p>
                  </div>
                  <div className="space-y-2">
                    <Label>邮箱</Label>
                    <Input value={user?.email || ''} disabled className="bg-gray-50" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 必填信息 */}
            <Card className="hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle>人口统计信息 <span className="text-red-500">*</span></CardTitle>
                <CardDescription>这些信息将用于生成角色卡的核心层</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 性别和出生日期 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="gender">性别 <span className="text-red-500">*</span></Label>
                    <Select
                      value={profile.gender || ''}
                      onValueChange={(value) => updateProfile('gender', value)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger id="gender" className={!isEditing ? 'bg-gray-50 text-gray-500' : ''}>
                        <SelectValue placeholder="请选择性别" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="男">男</SelectItem>
                        <SelectItem value="女">女</SelectItem>
                        <SelectItem value="其他">其他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthCalendar">历法类型</Label>
                    <Select
                      value={profile.birthCalendar || 'solar'}
                      onValueChange={(value: 'solar' | 'lunar') => updateProfile('birthCalendar', value)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger id="birthCalendar" className={!isEditing ? 'bg-gray-50 text-gray-500' : ''}>
                        <SelectValue placeholder="请选择历法" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solar">阳历</SelectItem>
                        <SelectItem value="lunar">农历</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthDate">出生日期 <span className="text-red-500">*</span></Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={profile.birthDate || ''}
                      onChange={(e) => updateProfile('birthDate', e.target.value)}
                      disabled={!isEditing}
                      className={!isEditing ? 'bg-gray-50 text-gray-500' : ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthHour">出生时辰</Label>
                    <Select
                      value={profile.birthHour?.toString() || ''}
                      onValueChange={(value) => updateProfile('birthHour', value ? parseInt(value) : undefined)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger id="birthHour" className={!isEditing ? 'bg-gray-50 text-gray-500' : ''}>
                        <SelectValue placeholder={profile.birthHour !== undefined ? SHICHEN_NAMES[profile.birthHour] || `${profile.birthHour}:00` : "请选择时辰（选填）"} />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i.toString().padStart(2, '0')}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {profile.birthHour !== undefined && (
                      <p className="text-xs text-purple-600">
                        {SHICHEN_NAMES[profile.birthHour] || `${profile.birthHour}:00`}
                      </p>
                    )}
                  </div>
                </div>

                {/* 出生地 */}
                <div className="space-y-2">
                  <Label>出生地 <span className="text-red-500">*</span></Label>
                  <ProvinceCitySelector
                    value={profile.birthPlace}
                    onChange={(value) => updateProfile('birthPlace', value)}
                    required
                    disabled={!isEditing}
                  />
                </div>

                {/* 常住地 */}
                <div className="space-y-2">
                  <Label>常住地 <span className="text-red-500">*</span></Label>
                  <ProvinceCitySelector
                    value={profile.residence}
                    onChange={(value) => updateProfile('residence', value)}
                    required
                    disabled={!isEditing}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 选填信息 */}
            <Card className="hover:shadow-xl transition-all duration-300">
              <CardHeader>
                <CardTitle>补充信息</CardTitle>
                <CardDescription>选填信息，可帮助生成更个性化的角色卡</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 国籍、民族、职业、学历 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="nationality">国籍</Label>
                    <Input
                      id="nationality"
                      value={profile.nationality || ''}
                      onChange={(e) => updateProfile('nationality', e.target.value)}
                      placeholder="例如：中国"
                      disabled={!isEditing}
                      className={!isEditing ? 'bg-gray-50 text-gray-500' : ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ethnicity">民族</Label>
                    <Input
                      id="ethnicity"
                      value={profile.ethnicity || ''}
                      onChange={(e) => updateProfile('ethnicity', e.target.value)}
                      placeholder="例如：汉族"
                      disabled={!isEditing}
                      className={!isEditing ? 'bg-gray-50 text-gray-500' : ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="occupation">职业</Label>
                    <Input
                      id="occupation"
                      value={profile.occupation || ''}
                      onChange={(e) => updateProfile('occupation', e.target.value)}
                      placeholder="例如：退休教师"
                      disabled={!isEditing}
                      className={!isEditing ? 'bg-gray-50 text-gray-500' : ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="education">教育程度</Label>
                    <Input
                      id="education"
                      value={profile.education || ''}
                      onChange={(e) => updateProfile('education', e.target.value)}
                      placeholder="小学、初中、高中、大专、大学..."
                      disabled={!isEditing}
                      className={!isEditing ? 'bg-gray-50 text-gray-500' : ''}
                    />
                  </div>
                </div>

                {/* 婚姻状况和子女 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="maritalStatus">婚姻状况</Label>
                    <Select
                      value={profile.maritalStatus || ''}
                      onValueChange={(value) => updateProfile('maritalStatus', value)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger id="maritalStatus" className={!isEditing ? 'bg-gray-50 text-gray-500' : ''}>
                        <SelectValue placeholder="请选择婚姻状况" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="未婚">未婚</SelectItem>
                        <SelectItem value="已婚">已婚</SelectItem>
                        <SelectItem value="离异">离异</SelectItem>
                        <SelectItem value="丧偶">丧偶</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sons">儿子数量</Label>
                    <Input
                      id="sons"
                      type="number"
                      min="0"
                      value={profile.children?.sons ?? ''}
                      onChange={(e) => updateProfile('children', {
                        ...profile.children,
                        sons: parseInt(e.target.value) || 0,
                        daughters: profile.children?.daughters ?? 0
                      })}
                      placeholder="0"
                      disabled={!isEditing}
                      className={!isEditing ? 'bg-gray-50 text-gray-500' : ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="daughters">女儿数量</Label>
                    <Input
                      id="daughters"
                      type="number"
                      min="0"
                      value={profile.children?.daughters ?? ''}
                      onChange={(e) => updateProfile('children', {
                        ...profile.children,
                        daughters: parseInt(e.target.value) || 0,
                        sons: profile.children?.sons ?? 0
                      })}
                      placeholder="0"
                      disabled={!isEditing}
                      className={!isEditing ? 'bg-gray-50 text-gray-500' : ''}
                    />
                  </div>
                </div>

                {/* 身高 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="height">身高 (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      min="50"
                      max="250"
                      value={profile.height ?? ''}
                      onChange={(e) => updateProfile('height', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="例如：170"
                      disabled={!isEditing}
                      className={!isEditing ? 'bg-gray-50 text-gray-500' : ''}
                    />
                  </div>
                </div>

                {/* 外貌特征 */}
                <div className="space-y-2">
                  <Label htmlFor="appearanceFeatures">外貌特征描述</Label>
                  <Textarea
                    id="appearanceFeatures"
                    value={profile.appearanceFeatures || ''}
                    onChange={(e) => updateProfile('appearanceFeatures', e.target.value)}
                    placeholder="例如：身材中等，头发花白，戴眼镜，面容和蔼..."
                    rows={3}
                    disabled={!isEditing}
                    className={!isEditing ? 'bg-gray-50 text-gray-500' : ''}
                  />
                  <p className="text-xs text-gray-500">描述您的外貌特征、体型、穿着风格等</p>
                </div>
              </CardContent>
            </Card>

            {/* 保存按钮 */}
            <div className="flex justify-end gap-4">
              {/* 修改档案按钮 - 只有锁定后才可用 */}
              {isLocked && (
                <Button
                  variant="outline"
                  onClick={isEditing ? handleCancelEdit : handleEdit}
                  className="gap-2"
                >
                  {isEditing ? '取消修改' : '修改档案'}
                </Button>
              )}

              {/* 保存档案按钮 */}
              <Button
                onClick={handleSave}
                disabled={saving || (isLocked && !hasChanges)}
                className="gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? '保存中...' : saved ? '已保存' : '保存档案'}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
