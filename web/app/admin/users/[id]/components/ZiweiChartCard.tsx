'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Star, Moon, Sun, Calendar, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import PalaceDetailModal, { PalaceDetail } from './PalaceDetailModal'

// Ziwei Chart Data Types
export interface ZiweiChartData {
  success: boolean
  chart?: {
    solarDate: string
    lunarDate: string
    chineseDate: string
    zodiac: string
    sign: string
    // Support both string (new format) and object (old format) for soul/body
    soul: string | { name?: string; type?: string; brightness?: string }
    body: string | { name?: string; type?: string; brightness?: string }
    fiveElementsClass: string
    palaces: Array<{
      name: string
      heavenlyStem: string
      earthlyBranch: string
      majorStars: Array<{ name: string; brightness: string }>
      minorStars: Array<{ name: string; brightness?: string }>
      adjectiveStars?: Array<{ name: string }>  // 辅星/杂曜
    }>
    horoscope?: {
      lunarDate?: string
      decadal?: {
        index?: number
        name?: string
        range?: [number, number]
        heavenlyStem?: string
        earthlyBranch?: string
        palaceNames?: string[]
        mutagen?: string[]
      }
      yearly?: {
        index?: number
        name?: string
        heavenlyStem?: string
        earthlyBranch?: string
        palaceNames?: string[]
        mutagen?: string[]
      }
      monthly?: {
        index?: number
        name?: string
        heavenlyStem?: string
        earthlyBranch?: string
      }
      daily?: {
        index?: number
        name?: string
        heavenlyStem?: string
        earthlyBranch?: string
      }
    } | null
  }
  error?: string
}

// Helper to extract soul/body value (handles both string and object formats)
const getStarName = (value: string | { name?: string } | undefined): string => {
  if (!value) return '未知'
  if (typeof value === 'string') return value
  return value.name || '未知'
}

interface ZiweiChartCardProps {
  userId: string
  profileCompletion?: {
    isComplete: boolean
    missingFields: string[]
  }
}

const PALACE_NAMES: Record<string, string> = {
  '命宫': '命宫',
  '兄弟': '兄弟宫',
  '夫妻': '夫妻宫',
  '子女': '子女宫',
  '财帛': '财帛宫',
  '疾厄': '疾厄宫',
  '迁移': '迁移宫',
  '仆役': '仆役宫',
  '官禄': '官禄宫',
  '田宅': '田宅宫',
  '福德': '福德宫',
  '父母': '父母宫'
}

export function ZiweiChartCard({ userId, profileCompletion }: ZiweiChartCardProps) {
  const [data, setData] = useState<ZiweiChartData | null>(null)
  const [isLoading, setIsLoading] = useState(true)  // Changed: start with true
  const [error, setError] = useState<string | null>(null)
  const [selectedPalace, setSelectedPalace] = useState<PalaceDetail | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)  // Track if fetch was attempted

  useEffect(() => {
    if (profileCompletion?.isComplete && !hasFetched) {
      setHasFetched(true)
      fetchZiweiChart()
    } else if (!profileCompletion?.isComplete) {
      setIsLoading(false)  // Not loading if profile incomplete
    }
  }, [userId, profileCompletion, hasFetched])

  const fetchZiweiChart = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/admin/users/${userId}/ziwei-chart`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      })
      const result: ZiweiChartData = await response.json()
      setData(result)
      if (!result.success) {
        setError(result.error || '加载紫微斗数命盘失败')
      }
    } catch (err) {
      setError('网络错误，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  // Profile incomplete warning
  if (!profileCompletion?.isComplete) {
    const missingFields = profileCompletion?.missingFields || ['出生日期', '出生时辰', '性别']
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-amber-900">紫微斗数命盘</CardTitle>
              <CardDescription className="text-amber-700">需要完善个人档案才能查看命理</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-100/50 border border-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 mb-1">信息不完整</p>
              <p className="text-amber-700">
                需要完善以下信息：{missingFields.join('、')}
              </p>
              <p className="text-amber-600 mt-2">
                请用户在个人资料中完善出生日期、出生时辰和性别信息
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>紫微斗数命盘</CardTitle>
              <CardDescription>正在加载命理数据...</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error && !data?.chart) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>紫微斗数命盘</CardTitle>
              <CardDescription className="text-red-600">加载失败</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 text-sm">{error}</p>
        </CardContent>
      </Card>
    )
  }

  const chart = data?.chart
  if (!chart) {
    // Show a message instead of returning null
    return (
      <Card className="border-gray-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>紫微斗数命盘</CardTitle>
              <CardDescription>命理数据加载中...</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const handlePalaceClick = (palace: typeof chart.palaces[0]) => {
    setSelectedPalace({
      name: palace.name,
      displayName: PALACE_NAMES[palace.name] || palace.name,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      majorStars: palace.majorStars,
      minorStars: palace.minorStars,
      adjectiveStars: palace.adjectiveStars || []
    })
    setIsModalOpen(true)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>紫微斗数命盘</CardTitle>
              <CardDescription>命理分析与运势解读</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
        {/* Basic Info Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700 mb-2">
              <Star className="w-4 h-4" />
              <span className="text-xs font-medium">生肖</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{chart.zodiac || '未知'}</p>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700 mb-2">
              <Moon className="w-4 h-4" />
              <span className="text-xs font-medium">星座</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{chart.sign || '未知'}</p>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700 mb-2">
              <Sun className="w-4 h-4" />
              <span className="text-xs font-medium">命主/身主</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {getStarName(chart.soul)} / {getStarName(chart.body)}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700 mb-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-medium">五行局</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{chart.fiveElementsClass || '未知'}</p>
          </div>
        </div>

        {/* Date Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
            <Calendar className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-xs text-gray-500">农历日期</p>
              <p className="font-medium text-gray-900">{chart.lunarDate || '未知'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
            <Sun className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-xs text-gray-500">阳历日期</p>
              <p className="font-medium text-gray-900">{chart.solarDate || '未知'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200 md:col-span-2">
            <Star className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-xs text-gray-500">干支纪年</p>
              <p className="font-medium text-gray-900">{chart.chineseDate || '未知'}</p>
            </div>
          </div>
        </div>

        {/* Horoscope Section */}
        <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 border border-amber-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            运限
            <span className="text-xs text-gray-500 font-normal ml-2">
              ({new Date().toLocaleDateString('zh-CN')})
            </span>
          </h3>
          {chart.horoscope ? (
            <div className="space-y-4">
              {/* 大限和流年 - 主要信息 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-white/50 border border-amber-100">
                  <p className="text-xs text-gray-500 mb-2 font-medium">大限 (十年运)</p>
                  {chart.horoscope.decadal && (chart.horoscope.decadal.index ?? -1) >= 0 ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {chart.horoscope.decadal.range && (
                          <Badge className="bg-amber-500 text-white">
                            {chart.horoscope.decadal.range[0]} - {chart.horoscope.decadal.range[1]} 岁
                          </Badge>
                        )}
                        <span className="text-lg font-bold text-gray-800">
                          {chart.horoscope.decadal.heavenlyStem}{chart.horoscope.decadal.earthlyBranch}
                        </span>
                      </div>
                      {chart.horoscope.decadal.palaceNames && chart.horoscope.decadal.index !== undefined && (
                        <p className="text-xs text-gray-500">
                          宫位: {chart.horoscope.decadal.palaceNames[chart.horoscope.decadal.index] || '未知'}
                        </p>
                      )}
                      {chart.horoscope.decadal.mutagen && chart.horoscope.decadal.mutagen.length > 0 && (
                        <p className="text-xs text-gray-500">
                          四化: {chart.horoscope.decadal.mutagen.join('、')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">超出大限范围</span>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-white/50 border border-orange-100">
                  <p className="text-xs text-gray-500 mb-2 font-medium">流年 (年运)</p>
                  {chart.horoscope.yearly ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-orange-500 text-white">
                          {new Date().getFullYear()}年
                        </Badge>
                        <span className="text-lg font-bold text-gray-800">
                          {chart.horoscope.yearly.heavenlyStem}{chart.horoscope.yearly.earthlyBranch}
                        </span>
                      </div>
                      {chart.horoscope.yearly.palaceNames && chart.horoscope.yearly.index !== undefined && (
                        <p className="text-xs text-gray-500">
                          宫位: {chart.horoscope.yearly.palaceNames[chart.horoscope.yearly.index] || '未知'}
                        </p>
                      )}
                      {chart.horoscope.yearly.mutagen && chart.horoscope.yearly.mutagen.length > 0 && (
                        <p className="text-xs text-gray-500">
                          四化: {chart.horoscope.yearly.mutagen.join('、')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">暂无数据</span>
                  )}
                </div>
              </div>

              {/* 流月和流日 - 次要信息 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-2 rounded bg-white/30 border border-gray-100">
                  <p className="text-[10px] text-gray-400 mb-1">流月</p>
                  {chart.horoscope.monthly ? (
                    <span className="text-sm font-medium text-gray-700">
                      {chart.horoscope.monthly.heavenlyStem}{chart.horoscope.monthly.earthlyBranch}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </div>
                <div className="p-2 rounded bg-white/30 border border-gray-100">
                  <p className="text-[10px] text-gray-400 mb-1">流日</p>
                  {chart.horoscope.daily ? (
                    <span className="text-sm font-medium text-gray-700">
                      {chart.horoscope.daily.heavenlyStem}{chart.horoscope.daily.earthlyBranch}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </div>
                <div className="p-2 rounded bg-white/30 border border-gray-100 col-span-2">
                  <p className="text-[10px] text-gray-400 mb-1">农历</p>
                  {chart.horoscope.lunarDate ? (
                    <span className="text-sm font-medium text-gray-700">
                      {chart.horoscope.lunarDate}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">运限数据暂未计算</p>
          )}
        </div>

        {/* Palaces Grid */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            十二宫位
            <span className="text-xs text-gray-500 font-normal ml-2">点击查看详情</span>
          </h3>
          {chart.palaces && chart.palaces.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {chart.palaces.map((palace, index) => (
                <div
                  key={index}
                  className="p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-md"
                  onClick={() => handlePalaceClick(palace)}
                >
                  {/* 宫位标题 */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900 text-sm">
                      {PALACE_NAMES[palace.name] || palace.name}
                    </span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {palace.heavenlyStem}{palace.earthlyBranch}
                    </Badge>
                  </div>

                  {/* 主星列表 - 显示全部 */}
                  {palace.majorStars && palace.majorStars.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {palace.majorStars.map((star, starIndex) => (
                        <span
                          key={starIndex}
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded',
                            star.brightness === '庙' ? 'bg-amber-100 text-amber-700' :
                            star.brightness === '旺' ? 'bg-orange-100 text-orange-700' :
                            star.brightness === '得' ? 'bg-yellow-100 text-yellow-700' :
                            star.brightness === '平' ? 'bg-gray-100 text-gray-600' :
                            star.brightness === '陷' ? 'bg-slate-100 text-slate-500' :
                            'bg-gray-50 text-gray-600'
                          )}
                        >
                          {star.name}
                          <span className="text-[10px] ml-0.5 opacity-70">{star.brightness}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 辅星列表 - 显示前4个 */}
                  {palace.minorStars && palace.minorStars.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mb-1">
                      {palace.minorStars.slice(0, 4).map((star, starIndex) => (
                        <span key={starIndex} className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded">
                          {star.name}
                        </span>
                      ))}
                      {palace.minorStars.length > 4 && (
                        <span className="text-[10px] text-gray-400">+{palace.minorStars.length - 4}</span>
                      )}
                    </div>
                  )}

                  {/* 杂曜列表 - 显示前3个 */}
                  {palace.adjectiveStars && palace.adjectiveStars.length > 0 && (
                    <div className="flex flex-wrap gap-0.5">
                      {palace.adjectiveStars.slice(0, 3).map((star, starIndex) => (
                        <span key={starIndex} className="text-[10px] text-purple-600 bg-purple-50 px-1 rounded">
                          {star.name}
                        </span>
                      ))}
                      {palace.adjectiveStars.length > 3 && (
                        <span className="text-[10px] text-gray-400">+{palace.adjectiveStars.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* 无星曜提示 */}
                  {(!palace.majorStars || palace.majorStars.length === 0) &&
                   (!palace.minorStars || palace.minorStars.length === 0) &&
                   (!palace.adjectiveStars || palace.adjectiveStars.length === 0) && (
                    <span className="text-xs text-gray-400">无星曜</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">宫位数据暂无</p>
          )}
        </div>
      </CardContent>
    </Card>

      {/* Palace Detail Modal */}
      <PalaceDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        palace={selectedPalace}
      />
    </>
  )
}
