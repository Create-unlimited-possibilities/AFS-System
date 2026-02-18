// 中国省级行政区划数据
// 数据来源：中华人民共和国国家统计局 GB/T 2260 行政区划代码
// 更新时间：2024年

export const provinces = [
  // 直辖市 (4个)
  { code: '11', name: '北京市', type: 'municipality' },
  { code: '12', name: '天津市', type: 'municipality' },
  { code: '31', name: '上海市', type: 'municipality' },
  { code: '50', name: '重庆市', type: 'municipality' },

  // 省 (23个)
  { code: '13', name: '河北省', type: 'province' },
  { code: '14', name: '山西省', type: 'province' },
  { code: '21', name: '辽宁省', type: 'province' },
  { code: '22', name: '吉林省', type: 'province' },
  { code: '23', name: '黑龙江省', type: 'province' },
  { code: '32', name: '江苏省', type: 'province' },
  { code: '33', name: '浙江省', type: 'province' },
  { code: '34', name: '安徽省', type: 'province' },
  { code: '35', name: '福建省', type: 'province' },
  { code: '36', name: '江西省', type: 'province' },
  { code: '37', name: '山东省', type: 'province' },
  { code: '41', name: '河南省', type: 'province' },
  { code: '42', name: '湖北省', type: 'province' },
  { code: '43', name: '湖南省', type: 'province' },
  { code: '44', name: '广东省', type: 'province' },
  { code: '45', name: '广西壮族自治区', type: 'autonomous_region' },
  { code: '46', name: '海南省', type: 'province' },
  { code: '51', name: '四川省', type: 'province' },
  { code: '52', name: '贵州省', type: 'province' },
  { code: '53', name: '云南省', type: 'province' },
  { code: '61', name: '陕西省', type: 'province' },
  { code: '62', name: '甘肃省', type: 'province' },
  { code: '63', name: '青海省', type: 'province' },
  { code: '64', name: '宁夏回族自治区', type: 'autonomous_region' },
  { code: '65', name: '新疆维吾尔自治区', type: 'autonomous_region' },

  // 自治区 (额外)
  { code: '15', name: '内蒙古自治区', type: 'autonomous_region' },
  { code: '54', name: '西藏自治区', type: 'autonomous_region' },

  // 特别行政区 (2个)
  { code: '71', name: '台湾省', type: 'province' },
  { code: '81', name: '香港特别行政区', type: 'special_administrative_region' },
  { code: '82', name: '澳门特别行政区', type: 'special_administrative_region' }
];

// 各省市数据（地级市）
export const cities = {
  // 北京市 - 直辖市，无地级市，使用区
  '11': [
    { code: '1101', name: '东城区' },
    { code: '1102', name: '西城区' },
    { code: '1105', name: '朝阳区' },
    { code: '1106', name: '丰台区' },
    { code: '1107', name: '石景山区' },
    { code: '1108', name: '海淀区' },
    { code: '1109', name: '门头沟区' },
    { code: '1111', name: '房山区' },
    { code: '1112', name: '通州区' },
    { code: '1113', name: '顺义区' },
    { code: '1114', name: '昌平区' },
    { code: '1115', name: '大兴区' },
    { code: '1116', name: '怀柔区' },
    { code: '1117', name: '平谷区' },
    { code: '1118', name: '密云区' },
    { code: '1119', name: '延庆区' }
  ],

  // 天津市
  '12': [
    { code: '1201', name: '和平区' },
    { code: '1202', name: '河东区' },
    { code: '1203', name: '河西区' },
    { code: '1204', name: '南开区' },
    { code: '1205', name: '河北区' },
    { code: '1206', name: '红桥区' },
    { code: '1210', name: '东丽区' },
    { code: '1211', name: '西青区' },
    { code: '1212', name: '津南区' },
    { code: '1213', name: '北辰区' },
    { code: '1214', name: '武清区' },
    { code: '1215', name: '宝坻区' },
    { code: '1216', name: '滨海新区' },
    { code: '1217', name: '宁河区' },
    { code: '1218', name: '静海区' },
    { code: '1219', name: '蓟州区' }
  ],

  // 河北省
  '13': [
    { code: '1301', name: '石家庄市' },
    { code: '1302', name: '唐山市' },
    { code: '1303', name: '秦皇岛市' },
    { code: '1304', name: '邯郸市' },
    { code: '1305', name: '邢台市' },
    { code: '1306', name: '保定市' },
    { code: '1307', name: '张家口市' },
    { code: '1308', name: '承德市' },
    { code: '1309', name: '沧州市' },
    { code: '1310', name: '廊坊市' },
    { code: '1311', name: '衡水市' }
  ],

  // 山西省
  '14': [
    { code: '1401', name: '太原市' },
    { code: '1402', name: '大同市' },
    { code: '1403', name: '阳泉市' },
    { code: '1404', name: '长治市' },
    { code: '1405', name: '晋城市' },
    { code: '1406', name: '朔州市' },
    { code: '1407', name: '晋中市' },
    { code: '1408', name: '运城市' },
    { code: '1409', name: '忻州市' },
    { code: '1410', name: '临汾市' },
    { code: '1411', name: '吕梁市' }
  ],

  // 内蒙古自治区
  '15': [
    { code: '1501', name: '呼和浩特市' },
    { code: '1502', name: '包头市' },
    { code: '1503', name: '乌海市' },
    { code: '1504', name: '赤峰市' },
    { code: '1505', name: '通辽市' },
    { code: '1506', name: '鄂尔多斯市' },
    { code: '1507', name: '呼伦贝尔市' },
    { code: '1508', name: '巴彦淖尔市' },
    { code: '1509', name: '乌兰察布市' },
    { code: '1522', name: '兴安盟' },
    { code: '1525', name: '锡林郭勒盟' },
    { code: '1529', name: '阿拉善盟' }
  ],

  // 辽宁省
  '21': [
    { code: '2101', name: '沈阳市' },
    { code: '2102', name: '大连市' },
    { code: '2103', name: '鞍山市' },
    { code: '2104', name: '抚顺市' },
    { code: '2105', name: '本溪市' },
    { code: '2106', name: '丹东市' },
    { code: '2107', name: '锦州市' },
    { code: '2108', name: '营口市' },
    { code: '2109', name: '阜新市' },
    { code: '2110', name: '辽阳市' },
    { code: '2111', name: '盘锦市' },
    { code: '2112', name: '铁岭市' },
    { code: '2113', name: '朝阳市' },
    { code: '2114', name: '葫芦岛市' }
  ],

  // 吉林省
  '22': [
    { code: '2201', name: '长春市' },
    { code: '2202', name: '吉林市' },
    { code: '2203', name: '四平市' },
    { code: '2204', name: '辽源市' },
    { code: '2205', name: '通化市' },
    { code: '2206', name: '白山市' },
    { code: '2207', name: '松原市' },
    { code: '2208', name: '白城市' },
    { code: '2224', name: '延边朝鲜族自治州' }
  ],

  // 黑龙江省
  '23': [
    { code: '2301', name: '哈尔滨市' },
    { code: '2302', name: '齐齐哈尔市' },
    { code: '2303', name: '鸡西市' },
    { code: '2304', name: '鹤岗市' },
    { code: '2305', name: '双鸭山市' },
    { code: '2306', name: '大庆市' },
    { code: '2307', name: '伊春市' },
    { code: '2308', name: '佳木斯市' },
    { code: '2309', name: '七台河市' },
    { code: '2310', name: '牡丹江市' },
    { code: '2311', name: '黑河市' },
    { code: '2312', name: '绥化市' },
    { code: '2327', name: '大兴安岭地区' }
  ],

  // 上海市
  '31': [
    { code: '3101', name: '黄浦区' },
    { code: '3104', name: '徐汇区' },
    { code: '3105', name: '长宁区' },
    { code: '3106', name: '静安区' },
    { code: '3107', name: '普陀区' },
    { code: '3109', name: '虹口区' },
    { code: '3110', name: '杨浦区' },
    { code: '3112', name: '闵行区' },
    { code: '3113', name: '宝山区' },
    { code: '3114', name: '嘉定区' },
    { code: '3115', name: '浦东新区' },
    { code: '3116', name: '金山区' },
    { code: '3117', name: '松江区' },
    { code: '3118', name: '青浦区' },
    { code: '3120', name: '奉贤区' },
    { code: '3130', name: '崇明区' }
  ],

  // 江苏省
  '32': [
    { code: '3201', name: '南京市' },
    { code: '3202', name: '无锡市' },
    { code: '3203', name: '徐州市' },
    { code: '3204', name: '常州市' },
    { code: '3205', name: '苏州市' },
    { code: '3206', name: '南通市' },
    { code: '3207', name: '连云港市' },
    { code: '3208', name: '淮安市' },
    { code: '3209', name: '盐城市' },
    { code: '3210', name: '扬州市' },
    { code: '3211', name: '镇江市' },
    { code: '3212', name: '泰州市' },
    { code: '3213', name: '宿迁市' }
  ],

  // 浙江省
  '33': [
    { code: '3301', name: '杭州市' },
    { code: '3302', name: '宁波市' },
    { code: '3303', name: '温州市' },
    { code: '3304', name: '嘉兴市' },
    { code: '3305', name: '湖州市' },
    { code: '3306', name: '绍兴市' },
    { code: '3307', name: '金华市' },
    { code: '3308', name: '衢州市' },
    { code: '3309', name: '舟山市' },
    { code: '3310', name: '台州市' },
    { code: '3311', name: '丽水市' }
  ],

  // 安徽省
  '34': [
    { code: '3401', name: '合肥市' },
    { code: '3402', name: '芜湖市' },
    { code: '3403', name: '蚌埠市' },
    { code: '3404', name: '淮南市' },
    { code: '3405', name: '马鞍山市' },
    { code: '3406', name: '淮北市' },
    { code: '3407', name: '铜陵市' },
    { code: '3408', name: '安庆市' },
    { code: '3410', name: '黄山市' },
    { code: '3411', name: '滁州市' },
    { code: '3412', name: '阜阳市' },
    { code: '3413', name: '宿州市' },
    { code: '3415', name: '六安市' },
    { code: '3416', name: '亳州市' },
    { code: '3417', name: '池州市' },
    { code: '3418', name: '宣城市' }
  ],

  // 福建省
  '35': [
    { code: '3501', name: '福州市' },
    { code: '3502', name: '厦门市' },
    { code: '3503', name: '莆田市' },
    { code: '3504', name: '三明市' },
    { code: '3505', name: '泉州市' },
    { code: '3506', name: '漳州市' },
    { code: '3507', name: '南平市' },
    { code: '3508', name: '龙岩市' },
    { code: '3509', name: '宁德市' }
  ],

  // 江西省
  '36': [
    { code: '3601', name: '南昌市' },
    { code: '3602', name: '景德镇市' },
    { code: '3603', name: '萍乡市' },
    { code: '3604', name: '九江市' },
    { code: '3605', name: '新余市' },
    { code: '3606', name: '鹰潭市' },
    { code: '3607', name: '赣州市' },
    { code: '3608', name: '吉安市' },
    { code: '3609', name: '宜春市' },
    { code: '3610', name: '抚州市' },
    { code: '3611', name: '上饶市' }
  ],

  // 山东省
  '37': [
    { code: '3701', name: '济南市' },
    { code: '3702', name: '青岛市' },
    { code: '3703', name: '淄博市' },
    { code: '3704', name: '枣庄市' },
    { code: '3705', name: '东营市' },
    { code: '3706', name: '烟台市' },
    { code: '3707', name: '潍坊市' },
    { code: '3708', name: '济宁市' },
    { code: '3709', name: '泰安市' },
    { code: '3710', name: '威海市' },
    { code: '3711', name: '日照市' },
    { code: '3713', name: '临沂市' },
    { code: '3714', name: '德州市' },
    { code: '3715', name: '聊城市' },
    { code: '3716', name: '滨州市' },
    { code: '3717', name: '菏泽市' }
  ],

  // 河南省
  '41': [
    { code: '4101', name: '郑州市' },
    { code: '4102', name: '开封市' },
    { code: '4103', name: '洛阳市' },
    { code: '4104', name: '平顶山市' },
    { code: '4105', name: '安阳市' },
    { code: '4106', name: '鹤壁市' },
    { code: '4107', name: '新乡市' },
    { code: '4108', name: '焦作市' },
    { code: '4109', name: '濮阳市' },
    { code: '4110', name: '许昌市' },
    { code: '4111', name: '漯河市' },
    { code: '4112', name: '三门峡市' },
    { code: '4113', name: '南阳市' },
    { code: '4114', name: '商丘市' },
    { code: '4115', name: '信阳市' },
    { code: '4116', name: '周口市' },
    { code: '4117', name: '驻马店市' },
    { code: '4190', name: '济源市' }
  ],

  // 湖北省
  '42': [
    { code: '4201', name: '武汉市' },
    { code: '4202', name: '黄石市' },
    { code: '4203', name: '十堰市' },
    { code: '4205', name: '宜昌市' },
    { code: '4206', name: '襄阳市' },
    { code: '4207', name: '鄂州市' },
    { code: '4208', name: '荆门市' },
    { code: '4209', name: '孝感市' },
    { code: '4210', name: '荆州市' },
    { code: '4211', name: '黄冈市' },
    { code: '4212', name: '咸宁市' },
    { code: '4213', name: '随州市' },
    { code: '4228', name: '恩施土家族苗族自治州' },
    { code: '4290', name: '仙桃市' },
    { code: '4291', name: '潜江市' },
    { code: '4292', name: '天门市' },
    { code: '4295', name: '神农架林区' }
  ],

  // 湖南省
  '43': [
    { code: '4301', name: '长沙市' },
    { code: '4302', name: '株洲市' },
    { code: '4303', name: '湘潭市' },
    { code: '4304', name: '衡阳市' },
    { code: '4305', name: '邵阳市' },
    { code: '4306', name: '岳阳市' },
    { code: '4307', name: '常德市' },
    { code: '4308', name: '张家界市' },
    { code: '4309', name: '益阳市' },
    { code: '4310', name: '郴州市' },
    { code: '4311', name: '永州市' },
    { code: '4312', name: '怀化市' },
    { code: '4313', name: '娄底市' },
    { code: '4331', name: '湘西土家族苗族自治州' }
  ],

  // 广东省
  '44': [
    { code: '4401', name: '广州市' },
    { code: '4402', name: '韶关市' },
    { code: '4403', name: '深圳市' },
    { code: '4404', name: '珠海市' },
    { code: '4405', name: '汕头市' },
    { code: '4406', name: '佛山市' },
    { code: '4407', name: '江门市' },
    { code: '4408', name: '湛江市' },
    { code: '4409', name: '茂名市' },
    { code: '4412', name: '肇庆市' },
    { code: '4413', name: '惠州市' },
    { code: '4414', name: '梅州市' },
    { code: '4415', name: '汕尾市' },
    { code: '4416', name: '河源市' },
    { code: '4417', name: '阳江市' },
    { code: '4418', name: '清远市' },
    { code: '4419', name: '东莞市' },
    { code: '4420', name: '中山市' },
    { code: '4451', name: '潮州市' },
    { code: '4452', name: '揭阳市' },
    { code: '4453', name: '云浮市' }
  ],

  // 广西壮族自治区
  '45': [
    { code: '4501', name: '南宁市' },
    { code: '4502', name: '柳州市' },
    { code: '4503', name: '桂林市' },
    { code: '4504', name: '梧州市' },
    { code: '4505', name: '北海市' },
    { code: '4506', name: '防城港市' },
    { code: '4507', name: '钦州市' },
    { code: '4508', name: '贵港市' },
    { code: '4509', name: '玉林市' },
    { code: '4510', name: '百色市' },
    { code: '4511', name: '贺州市' },
    { code: '4512', name: '河池市' },
    { code: '4513', name: '来宾市' },
    { code: '4514', name: '崇左市' }
  ],

  // 海南省
  '46': [
    { code: '4601', name: '海口市' },
    { code: '4602', name: '三亚市' },
    { code: '4603', name: '三沙市' },
    { code: '4604', name: '儋州市' },
    { code: '4690', name: '省直辖县级行政区划' }
  ],

  // 重庆市
  '50': [
    { code: '5001', name: '万州区' },
    { code: '5002', name: '涪陵区' },
    { code: '5003', name: '渝中区' },
    { code: '5004', name: '大渡口区' },
    { code: '5005', name: '江北区' },
    { code: '5006', name: '沙坪坝区' },
    { code: '5007', name: '九龙坡区' },
    { code: '5008', name: '南岸区' },
    { code: '5009', name: '北碚区' },
    { code: '5010', name: '綦江区' },
    { code: '5011', name: '大足区' },
    { code: '5012', name: '渝北区' },
    { code: '5013', name: '巴南区' },
    { code: '5014', name: '黔江区' },
    { code: '5015', name: '长寿区' },
    { code: '5016', name: '江津区' },
    { code: '5017', name: '合川区' },
    { code: '5018', name: '永川区' },
    { code: '5019', name: '南川区' },
    { code: '5020', name: '璧山区' },
    { code: '5021', name: '铜梁区' },
    { code: '5022', name: '潼南区' },
    { code: '5023', name: '荣昌区' },
    { code: '5024', name: '开州区' },
    { code: '5025', name: '梁平区' },
    { code: '5026', name: '武隆区' },
    { code: '5027', name: '城口县' },
    { code: '5028', name: '丰都县' },
    { code: '5029', name: '垫江县' },
    { code: '5030', name: '忠县' },
    { code: '5031', name: '云阳县' },
    { code: '5032', name: '奉节县' },
    { code: '5033', name: '巫山县' },
    { code: '5034', name: '巫溪县' },
    { code: '5035', name: '石柱土家族自治县' },
    { code: '5036', name: '秀山土家族苗族自治县' },
    { code: '5037', name: '酉阳土家族苗族自治县' },
    { code: '5038', name: '彭水苗族土家族自治县' }
  ],

  // 四川省
  '51': [
    { code: '5101', name: '成都市' },
    { code: '5103', name: '自贡市' },
    { code: '5104', name: '攀枝花市' },
    { code: '5105', name: '泸州市' },
    { code: '5106', name: '德阳市' },
    { code: '5107', name: '绵阳市' },
    { code: '5108', name: '广元市' },
    { code: '5109', name: '遂宁市' },
    { code: '5110', name: '内江市' },
    { code: '5111', name: '乐山市' },
    { code: '5113', name: '南充市' },
    { code: '5114', name: '眉山市' },
    { code: '5115', name: '宜宾市' },
    { code: '5116', name: '广安市' },
    { code: '5117', name: '达州市' },
    { code: '5118', name: '雅安市' },
    { code: '5119', name: '巴中市' },
    { code: '5120', name: '资阳市' },
    { code: '5132', name: '阿坝藏族羌族自治州' },
    { code: '5133', name: '甘孜藏族自治州' },
    { code: '5134', name: '凉山彝族自治州' }
  ],

  // 贵州省
  '52': [
    { code: '5201', name: '贵阳市' },
    { code: '5202', name: '六盘水市' },
    { code: '5203', name: '遵义市' },
    { code: '5204', name: '安顺市' },
    { code: '5205', name: '毕节市' },
    { code: '5206', name: '铜仁市' },
    { code: '5223', name: '黔西南布依族苗族自治州' },
    { code: '5226', name: '黔东南苗族侗族自治州' },
    { code: '5227', name: '黔南布依族苗族自治州' }
  ],

  // 云南省
  '53': [
    { code: '5301', name: '昆明市' },
    { code: '5303', name: '曲靖市' },
    { code: '5304', name: '玉溪市' },
    { code: '5305', name: '保山市' },
    { code: '5306', name: '昭通市' },
    { code: '5307', name: '丽江市' },
    { code: '5308', name: '普洱市' },
    { code: '5309', name: '临沧市' },
    { code: '5323', name: '楚雄彝族自治州' },
    { code: '5325', name: '红河哈尼族彝族自治州' },
    { code: '5326', name: '文山壮族苗族自治州' },
    { code: '5328', name: '西双版纳傣族自治州' },
    { code: '5329', name: '大理白族自治州' },
    { code: '5331', name: '德宏傣族景颇族自治州' },
    { code: '5333', name: '怒江傈僳族自治州' },
    { code: '5334', name: '迪庆藏族自治州' }
  ],

  // 西藏自治区
  '54': [
    { code: '5401', name: '拉萨市' },
    { code: '5402', name: '日喀则市' },
    { code: '5403', name: '昌都市' },
    { code: '5404', name: '林芝市' },
    { code: '5405', name: '山南市' },
    { code: '5406', name: '那曲市' },
    { code: '5425', name: '阿里地区' }
  ],

  // 陕西省
  '61': [
    { code: '6101', name: '西安市' },
    { code: '6102', name: '铜川市' },
    { code: '6103', name: '宝鸡市' },
    { code: '6104', name: '咸阳市' },
    { code: '6105', name: '渭南市' },
    { code: '6106', name: '延安市' },
    { code: '6107', name: '汉中市' },
    { code: '6108', name: '榆林市' },
    { code: '6109', name: '安康市' },
    { code: '6110', name: '商洛市' }
  ],

  // 甘肃省
  '62': [
    { code: '6201', name: '兰州市' },
    { code: '6202', name: '嘉峪关市' },
    { code: '6203', name: '金昌市' },
    { code: '6204', name: '白银市' },
    { code: '6205', name: '天水市' },
    { code: '6206', name: '武威市' },
    { code: '6207', name: '张掖市' },
    { code: '6208', name: '平凉市' },
    { code: '6209', name: '酒泉市' },
    { code: '6210', name: '庆阳市' },
    { code: '6211', name: '定西市' },
    { code: '6212', name: '陇南市' },
    { code: '6229', name: '临夏回族自治州' },
    { code: '6230', name: '甘南藏族自治州' }
  ],

  // 青海省
  '63': [
    { code: '6301', name: '西宁市' },
    { code: '6302', name: '海东市' },
    { code: '6322', name: '海北藏族自治州' },
    { code: '6323', name: '黄南藏族自治州' },
    { code: '6325', name: '海南藏族自治州' },
    { code: '6326', name: '果洛藏族自治州' },
    { code: '6327', name: '玉树藏族自治州' },
    { code: '6328', name: '海西蒙古族藏族自治州' }
  ],

  // 宁夏回族自治区
  '64': [
    { code: '6401', name: '银川市' },
    { code: '6402', name: '石嘴山市' },
    { code: '6403', name: '吴忠市' },
    { code: '6404', name: '固原市' },
    { code: '6405', name: '中卫市' }
  ],

  // 新疆维吾尔自治区
  '65': [
    { code: '6501', name: '乌鲁木齐市' },
    { code: '6502', name: '克拉玛依市' },
    { code: '6504', name: '吐鲁番市' },
    { code: '6505', name: '哈密市' },
    { code: '6523', name: '昌吉回族自治州' },
    { code: '6527', name: '博尔塔拉蒙古自治州' },
    { code: '6528', name: '巴音郭楞蒙古自治州' },
    { code: '6529', name: '阿克苏地区' },
    { code: '6530', name: '克孜勒苏柯尔克孜自治州' },
    { code: '6531', name: '喀什地区' },
    { code: '6532', name: '和田地区' },
    { code: '6540', name: '伊犁哈萨克自治州' },
    { code: '6542', name: '塔城地区' },
    { code: '6543', name: '阿勒泰地区' },
    { code: '6590', name: '自治区直辖县级行政区划' }
  ],

  // 台湾省（简化）
  '71': [
    { code: '7101', name: '台北市' },
    { code: '7102', name: '新北市' },
    { code: '7103', name: '桃园市' },
    { code: '7104', name: '台中市' },
    { code: '7105', name: '台南市' },
    { code: '7106', name: '高雄市' },
    { code: '7107', name: '基隆市' },
    { code: '7108', name: '新竹市' },
    { code: '7109', name: '嘉义市' },
    { code: '7111', name: '新竹县' },
    { code: '7112', name: '苗栗县' },
    { code: '7113', name: '彰化县' },
    { code: '7114', name: '南投县' },
    { code: '7115', name: '云林县' },
    { code: '7116', name: '嘉义县' },
    { code: '7117', name: '屏东县' },
    { code: '7118', name: '宜兰县' },
    { code: '7119', name: '花莲县' },
    { code: '7120', name: '台东县' },
    { code: '7121', name: '澎湖县' },
    { code: '7122', name: '金门县' },
    { code: '7123', name: '连江县' }
  ],

  // 香港特别行政区（简化）
  '81': [
    { code: '8101', name: '中西区' },
    { code: '8102', name: '湾仔区' },
    { code: '8103', name: '东区' },
    { code: '8104', name: '南区' },
    { code: '8105', name: '油尖旺区' },
    { code: '8106', name: '深水埗区' },
    { code: '8107', name: '九龙城区' },
    { code: '8108', name: '黄大仙区' },
    { code: '8109', name: '观塘区' },
    { code: '8110', name: '荃湾区' },
    { code: '8111', name: '屯门区' },
    { code: '8112', name: '元朗区' },
    { code: '8113', name: '北区' },
    { code: '8114', name: '大埔区' },
    { code: '8115', name: '西贡区' },
    { code: '8116', name: '沙田区' },
    { code: '8117', name: '葵青区' },
    { code: '8118', name: '离岛区' }
  ],

  // 澳门特别行政区（简化）
  '82': [
    { code: '8201', name: '花地玛堂区' },
    { code: '8202', name: '花王堂区' },
    { code: '8203', name: '望德堂区' },
    { code: '8204', name: '大堂区' },
    { code: '8205', name: '风顺堂区' },
    { code: '8206', name: '嘉模堂区' },
    { code: '8207', name: '路凼填海区' },
    { code: '8208', name: '圣方济各堂区' }
  ]
};

export default {
  provinces,
  cities
};
