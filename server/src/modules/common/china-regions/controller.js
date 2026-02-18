// 中国行政区划 API 控制器
import { provinces, cities } from './data.js';

/**
 * 获取所有省份
 * GET /api/regions/provinces
 */
export async function getProvinces(req, res) {
  try {
    res.json({
      success: true,
      data: provinces.map(p => ({
        code: p.code,
        name: p.name,
        type: p.type
      }))
    });
  } catch (error) {
    console.error('[RegionsController] 获取省份失败:', error);
    res.status(500).json({
      success: false,
      error: '获取省份数据失败'
    });
  }
}

/**
 * 获取指定省份的城市/区
 * GET /api/regions/cities/:provinceCode
 */
export async function getCitiesByProvince(req, res) {
  try {
    const { provinceCode } = req.params;

    if (!provinceCode) {
      return res.status(400).json({
        success: false,
        error: '缺少省份代码'
      });
    }

    const provinceCities = cities[provinceCode];

    if (!provinceCities) {
      return res.status(404).json({
        success: false,
        error: '未找到该省份的城市数据'
      });
    }

    res.json({
      success: true,
      data: provinceCities
    });
  } catch (error) {
    console.error('[RegionsController] 获取城市失败:', error);
    res.status(500).json({
      success: false,
      error: '获取城市数据失败'
    });
  }
}

/**
 * 获取完整的省市树形结构
 * GET /api/regions/tree
 */
export async function getRegionsTree(req, res) {
  try {
    const tree = provinces.map(province => ({
      code: province.code,
      name: province.name,
      type: province.type,
      cities: (cities[province.code] || []).map(city => ({
        code: city.code,
        name: city.name
      }))
    }));

    res.json({
      success: true,
      data: tree
    });
  } catch (error) {
    console.error('[RegionsController] 获取树形结构失败:', error);
    res.status(500).json({
      success: false,
      error: '获取行政区划树失败'
    });
  }
}

export default {
  getProvinces,
  getCitiesByProvince,
  getRegionsTree
};
