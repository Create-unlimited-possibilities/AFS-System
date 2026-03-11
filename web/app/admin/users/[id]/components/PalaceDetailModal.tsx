'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Star, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PalaceStar {
  name: string
  brightness: string
}

export interface PalaceMinorStar {
  name: string
  brightness?: string
}

export interface PalaceDetail {
  name: string
  displayName: string
  heavenlyStem: string
  earthlyBranch: string
  majorStars: PalaceStar[]
  minorStars: PalaceMinorStar[]
  adjectiveStars?: PalaceMinorStar[]  // 辅星/杂曜
}

interface PalaceDetailModalProps {
  isOpen: boolean
  onClose: () => void
  palace: PalaceDetail | null
}

// Palace names from iztro are in Chinese (e.g., '命宫', '兄弟', '夫妻')
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

const BRIGHTNESS_COLORS: Record<string, string> = {
  '庙': 'text-amber-600 bg-amber-100 border-amber-300',
  '旺': 'text-orange-600 bg-orange-100 border-orange-300',
  '得': 'text-yellow-600 bg-yellow-100 border-yellow-300',
  '利': 'text-lime-600 bg-lime-100 border-lime-300',
  '平': 'text-gray-600 bg-gray-100 border-gray-300',
  '陷': 'text-slate-500 bg-slate-100 border-slate-300'
}

const BRIGHTNESS_ORDER = ['庙', '旺', '得', '利', '平', '陷']

export function PalaceDetailModal({ isOpen, onClose, palace }: PalaceDetailModalProps) {
  if (!palace) return null

  // Sort stars by brightness (庙 > 旺 > 得 > 利 > 平 > 陷)
  const sortedMajorStars = [...palace.majorStars].sort((a, b) => {
    const aIndex = BRIGHTNESS_ORDER.indexOf(a.brightness as string)
    const bIndex = BRIGHTNESS_ORDER.indexOf(b.brightness as string)
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex)
  })

  const sortedMinorStars = [...palace.minorStars].sort((a, b) => {
    const aBrightness = a.brightness || '平'
    const bBrightness = b.brightness || '平'
    const aIndex = BRIGHTNESS_ORDER.indexOf(aBrightness)
    const bIndex = BRIGHTNESS_ORDER.indexOf(bBrightness)
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex)
  })

  // Sort adjective stars (辅星/杂曜)
  const sortedAdjectiveStars = [...(palace.adjectiveStars || [])].sort((a, b) => {
    const aBrightness = a.brightness || '平'
    const bBrightness = b.brightness || '平'
    const aIndex = BRIGHTNESS_ORDER.indexOf(aBrightness)
    const bIndex = BRIGHTNESS_ORDER.indexOf(bBrightness)
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex)
  })

  const displayName = PALACE_NAMES[palace.name] || palace.displayName

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                <Star className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl">{displayName}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    {palace.heavenlyStem}
                  </Badge>
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    {palace.earthlyBranch}
                  </Badge>
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Major Stars Section */}
          {sortedMajorStars.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                主星 (十四主星)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortedMajorStars.map((star, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border-2',
                      BRIGHTNESS_COLORS[star.brightness as string] || 'bg-gray-50 border-gray-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span className="font-medium">{star.name}</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-xs px-2 py-1',
                        BRIGHTNESS_COLORS[star.brightness as string] || 'bg-gray-200 text-gray-700'
                      )}
                    >
                      {star.brightness}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Minor Stars Section */}
          {sortedMinorStars.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-orange-500" />
                辅星 (六吉六煞)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sortedMinorStars.map((star, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg border',
                      star.brightness ? (BRIGHTNESS_COLORS[star.brightness as string] || 'bg-gray-50 border-gray-200') : 'bg-gray-50 border-gray-200'
                    )}
                  >
                    <span className="text-sm">{star.name}</span>
                    {star.brightness && (
                      <span className={cn(
                        'text-xs font-medium px-1.5 py-0.5 rounded',
                        BRIGHTNESS_COLORS[star.brightness as string] || 'bg-gray-200 text-gray-700'
                      )}>
                        {star.brightness}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adjective Stars Section (杂曜) */}
          {sortedAdjectiveStars.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                杂曜 (其他星曜)
              </h3>
              <div className="flex flex-wrap gap-2">
                {sortedAdjectiveStars.map((star, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="text-sm px-3 py-1 bg-gray-50"
                  >
                    {star.name}
                    {star.brightness && (
                      <span className="ml-1 text-xs text-gray-500">({star.brightness})</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {sortedMajorStars.length === 0 && sortedMinorStars.length === 0 && sortedAdjectiveStars.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Star className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>此宫位暂无星曜信息</p>
            </div>
          )}
        </div>

        {/* Brightness Legend */}
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-gray-500 mb-2">星曜亮度说明：</p>
          <div className="flex flex-wrap gap-2">
            {BRIGHTNESS_ORDER.map((brightness) => (
              <Badge
                key={brightness}
                variant="outline"
                className={cn(
                  'text-xs',
                  BRIGHTNESS_COLORS[brightness] || 'bg-gray-100'
                )}
              >
                {brightness}
              </Badge>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PalaceDetailModal
