// 中国行政区划模块导出
import router from './route.js';
import { provinces, cities } from './data.js';

export { router as regionsRouter, provinces, cities };
export { getProvinces, getCitiesByProvince, getRegionsTree } from './controller.js';

export default {
  router,
  provinces,
  cities
};
