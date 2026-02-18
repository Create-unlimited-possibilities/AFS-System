'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'

interface Province {
  code: string
  name: string
  type: string
}

interface City {
  code: string
  name: string
}

interface ProvinceCitySelectorProps {
  value?: { provinceCode: string; provinceName: string; cityCode: string; cityName: string }
  onChange: (value: { provinceCode: string; provinceName: string; cityCode: string; cityName: string }) => void
  disabled?: boolean
  required?: boolean
}

export default function ProvinceCitySelector({
  value,
  onChange,
  disabled = false,
  required = false
}: ProvinceCitySelectorProps) {
  const [provinces, setProvinces] = useState<Province[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [loadingProvinces, setLoadingProvinces] = useState(false)
  const [loadingCities, setLoadingCities] = useState(false)

  // 加载省份列表
  useEffect(() => {
    const fetchProvinces = async () => {
      setLoadingProvinces(true)
      try {
        const res = await api.get<Province[]>('/regions/provinces')
        if (res.success && res.data) {
          setProvinces(res.data)
        }
      } catch (error) {
        console.error('获取省份列表失败:', error)
      } finally {
        setLoadingProvinces(false)
      }
    }
    fetchProvinces()
  }, [])

  // 当选择省份时，加载对应城市
  const handleProvinceChange = async (provinceCode: string) => {
    const province = provinces.find(p => p.code === provinceCode)
    if (!province) return

    // 清空城市选择
    onChange({
      provinceCode,
      provinceName: province.name,
      cityCode: '',
      cityName: ''
    })

    // 加载城市
    setLoadingCities(true)
    try {
      const res = await api.get<City[]>(`/regions/cities/${provinceCode}`)
      if (res.success && res.data) {
        setCities(res.data)
      }
    } catch (error) {
      console.error('获取城市列表失败:', error)
      setCities([])
    } finally {
      setLoadingCities(false)
    }
  }

  // 当选择城市时
  const handleCityChange = (cityCode: string) => {
    const city = cities.find(c => c.code === cityCode)
    if (!city || !value) return

    onChange({
      ...value,
      cityCode,
      cityName: city.name
    })
  }

  // 如果有初始值，加载对应省份的城市
  useEffect(() => {
    if (value?.provinceCode && provinces.length > 0 && cities.length === 0) {
      const fetchCities = async () => {
        setLoadingCities(true)
        try {
          const res = await api.get<City[]>(`/regions/cities/${value.provinceCode}`)
          if (res.success && res.data) {
            setCities(res.data)
          }
        } catch (error) {
          console.error('获取城市列表失败:', error)
        } finally {
          setLoadingCities(false)
        }
      }
      fetchCities()
    }
  }, [value?.provinceCode, provinces.length])

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="province">
          省份/直辖市/自治区
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <Select
          value={value?.provinceCode || ''}
          onValueChange={handleProvinceChange}
          disabled={disabled || loadingProvinces}
        >
          <SelectTrigger id="province">
            <SelectValue placeholder={loadingProvinces ? '加载中...' : '请选择省份'} />
          </SelectTrigger>
          <SelectContent>
            {provinces.map(province => (
              <SelectItem key={province.code} value={province.code}>
                {province.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="city">
          城市/区
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <Select
          value={value?.cityCode || ''}
          onValueChange={handleCityChange}
          disabled={disabled || loadingCities || !value?.provinceCode}
        >
          <SelectTrigger id="city">
            <SelectValue placeholder={
              !value?.provinceCode
                ? '请先选择省份'
                : loadingCities
                  ? '加载中...'
                  : '请选择城市'
            } />
          </SelectTrigger>
          <SelectContent>
            {cities.map(city => (
              <SelectItem key={city.code} value={city.code}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
