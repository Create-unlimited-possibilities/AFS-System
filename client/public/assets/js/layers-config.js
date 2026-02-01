// client/public/assets/js/layers-config.js - 层面配置文件（全局变量方式）
// 未来添加新层面只需修改这个文件，无需改动其他代码

window.LAYERS_CONFIG = {
  basic: {
    id: 'basic',
    name: '基础层面',
    shortName: '基础',
    color: 'primary',
    borderColor: '#0d6efd',
    description: '记录基本信息和童年经历',
    icon: 'bi-person'
  },
  emotional: {
    id: 'emotional',
    name: '情感及行为层面',
    shortName: '情感',
    color: 'info',
    borderColor: '#0dcaf0',
    description: '记录情感和行为习惯',
    icon: 'bi-heart'
  }
  // 未来添加新层面示例：
  // ethics: {
  //   id: 'ethics',
  //   name: '道德层面',
  //   shortName: '道德',
  //   color: 'warning',
  //   borderColor: '#ffc107',
  //   description: '记录道德观念和价值取向',
  //   icon: 'bi-shield-check'
  // }
};

function getLayerConfig(layerId) {
  return window.LAYERS_CONFIG?.[layerId] || null;
}

function getLayerName(layerId) {
  const config = getLayerConfig(layerId);
  return config ? config.name : layerId;
}

function getLayerColor(layerId) {
  const config = getLayerConfig(layerId);
  return config ? config.color : 'secondary';
}