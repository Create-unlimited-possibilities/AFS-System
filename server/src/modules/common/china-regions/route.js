// 中国行政区划 API 路由
import express from 'express';
import { getProvinces, getCitiesByProvince, getRegionsTree } from './controller.js';

const router = express.Router();

/**
 * @route GET /api/regions/provinces
 * @desc 获取所有省级行政区
 * @access Public
 */
router.get('/provinces', getProvinces);

/**
 * @route GET /api/regions/cities/:provinceCode
 * @desc 获取指定省份的城市/区
 * @access Public
 */
router.get('/cities/:provinceCode', getCitiesByProvince);

/**
 * @route GET /api/regions/tree
 * @desc 获取完整的省市树形结构
 * @access Public
 */
router.get('/tree', getRegionsTree);

export default router;
