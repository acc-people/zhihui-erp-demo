/* =========================================================
 * 智汇 ERP · 数据层
 * 负责种子数据、localStorage 持久化与通用格式化工具
 * 全局命名空间：ERPData / ERPUtil
 * ======================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'zhihui_erp_db_v1';
  var SEED_VERSION = 2;

  /* ---------- localStorage 安全封装（file:// 下也不报错） ---------- */
  function readLocal(key) {
    try {
      return global.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function writeLocal(key, value) {
    try {
      global.localStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function removeLocal(key) {
    try {
      global.localStorage.removeItem(key);
    } catch (err) {
      /* ignore */
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function dateToISO(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function parseDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    var parts = String(value || '').split('-');
    if (parts.length !== 3) return new Date(value);
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function addMonths(date, offset) {
    var base = new Date(date.getFullYear(), date.getMonth() + offset, 1);
    var maxDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    base.setDate(Math.min(date.getDate(), maxDay));
    return base;
  }

  function formatDate(value) {
    if (!value) return '—';
    var d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
      ? parseDate(value.slice(0, 10))
      : new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function formatDateTime(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value || '—');
    return formatDate(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function monthKey(value) {
    var d = value ? (typeof value === 'string' ? parseDate(value) : new Date(value)) : new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  function fullMonthLabel(key) {
    var parts = String(key).split('-');
    return parts[0] + '年' + Number(parts[1]) + '月';
  }

  function monthLabel(key) {
    return Number(String(key).split('-')[1]) + '月';
  }

  /** 返回最近 n 个月，按旧 → 新排列，供折线图使用 */
  function recentMonths(n, endDate) {
    var end = endDate ? new Date(endDate) : new Date();
    var list = [];
    for (var i = n - 1; i >= 0; i -= 1) {
      var d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      list.push({
        key: monthKey(d),
        label: monthLabel(monthKey(d)),
        fullLabel: fullMonthLabel(monthKey(d)),
        shortYear: String(d.getFullYear()).slice(2)
      });
    }
    return list;
  }

  function formatMoney(value, digits) {
    var n = Number(value) || 0;
    var fractionDigits = typeof digits === 'number' ? digits : 0;
    return '¥' + n.toLocaleString('zh-CN', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    });
  }

  function formatNumber(value, digits) {
    return (Number(value) || 0).toLocaleString('zh-CN', {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits || 0
    });
  }

  function formatCompactMoney(value) {
    var n = Number(value) || 0;
    if (Math.abs(n) >= 100000000) return (n / 100000000).toFixed(2).replace(/\.00$/, '') + '亿';
    if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
    return formatNumber(n);
  }

  function formatPercent(value, digits) {
    var n = Number(value) || 0;
    return n.toFixed(typeof digits === 'number' ? digits : 1) + '%';
  }

  function initials(name) {
    var text = String(name || '').trim();
    if (!text) return '?';
    return text.slice(0, 1).toUpperCase();
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  var ERPUtil = {
    pad: pad,
    dateToISO: dateToISO,
    parseDate: parseDate,
    addMonths: addMonths,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    monthKey: monthKey,
    monthLabel: monthLabel,
    fullMonthLabel: fullMonthLabel,
    recentMonths: recentMonths,
    formatMoney: formatMoney,
    formatNumber: formatNumber,
    formatCompactMoney: formatCompactMoney,
    formatPercent: formatPercent,
    initials: initials,
    escapeHTML: escapeHTML,
    round2: round2
  };

  /* ---------- 种子数据 ---------- */
  var DEPARTMENTS = ['运营部', '销售部', '生产部', '设备部', '品质部', '采购部', '仓储部', '财务部', '技术部'];
  var SALES_UNITS = ['销售一部', '销售二部', '电商事业部', '渠道拓展部'];
  var REPORT_TARGETS = {
    '销售一部': 520000,
    '销售二部': 360000,
    '电商事业部': 210000,
    '渠道拓展部': 160000
  };
  var UNIT_OWNERS = {
    '销售一部': '李哲',
    '销售二部': '陈晓',
    '电商事业部': '周雨',
    '渠道拓展部': '唐宁'
  };

  /** 自有产线：SMT 贴片 / 整机组装 / 测试包装 */
  var PRODUCTION_LINES = [
    { id: 'L1', code: 'SMT-01', name: 'SMT 贴片线', type: 'SMT 贴片', dailyCapacity: 1200, owner: '刘志强' },
    { id: 'L2', code: 'ASM-01', name: '整机组装线', type: '整机组装', dailyCapacity: 900, owner: '周成' },
    { id: 'L3', code: 'TST-01', name: '测试包装线', type: '测试 / 包装', dailyCapacity: 800, owner: '陈雅' }
  ];

  function buildSeedEmployees() {
    return [
      { id: 'ZH001', name: '王敏', dept: '运营部', title: '运营总监', joinedAt: '2019-03-18', status: '在职', phone: '13800138012', email: 'wangmin@zhihui-erp.cn' },
      { id: 'ZH002', name: '李哲', dept: '销售部', title: '销售经理', joinedAt: '2020-07-01', status: '在职', phone: '13800138023', email: 'lizhe@zhihui-erp.cn' },
      { id: 'ZH003', name: '陈晓', dept: '销售部', title: '大客户经理', joinedAt: '2021-05-12', status: '在职', phone: '13800138034', email: 'chenxiao@zhihui-erp.cn' },
      { id: 'ZH004', name: '周雨', dept: '销售部', title: '销售代表', joinedAt: '2023-09-04', status: '试用期', phone: '13800138045', email: 'zhouyu@zhihui-erp.cn' },
      { id: 'ZH005', name: '林嘉', dept: '采购部', title: '采购主管', joinedAt: '2018-11-23', status: '在职', phone: '13800138056', email: 'linjia@zhihui-erp.cn' },
      { id: 'ZH006', name: '赵航', dept: '采购部', title: '采购专员', joinedAt: '2022-02-14', status: '在职', phone: '13800138067', email: 'zhaohang@zhihui-erp.cn' },
      { id: 'ZH007', name: '孙悦', dept: '仓储部', title: '仓储主管', joinedAt: '2020-06-30', status: '在职', phone: '13800138078', email: 'sunyue@zhihui-erp.cn' },
      { id: 'ZH008', name: '吴磊', dept: '仓储部', title: '库管员', joinedAt: '2024-01-08', status: '在职', phone: '13800138089', email: 'wulei@zhihui-erp.cn' },
      { id: 'ZH009', name: '郑楠', dept: '财务部', title: '财务经理', joinedAt: '2017-09-15', status: '在职', phone: '13800138090', email: 'zhengnan@zhihui-erp.cn' },
      { id: 'ZH010', name: '冯琪', dept: '财务部', title: '会计', joinedAt: '2021-12-06', status: '在职', phone: '13800138101', email: 'fengqi@zhihui-erp.cn' },
      { id: 'ZH011', name: '何睿', dept: '技术部', title: '技术总监', joinedAt: '2016-04-19', status: '在职', phone: '13800138112', email: 'herui@zhihui-erp.cn' },
      { id: 'ZH012', name: '高宁', dept: '技术部', title: '售后工程师', joinedAt: '2023-03-27', status: '在职', phone: '13800138123', email: 'gaoning@zhihui-erp.cn' },
      { id: 'ZH013', name: '徐可', dept: '运营部', title: '新媒体运营', joinedAt: '2024-08-12', status: '在职', phone: '13800138134', email: 'xuke@zhihui-erp.cn' },
      { id: 'ZH014', name: '唐宁', dept: '销售部', title: '销售助理', joinedAt: '2025-02-10', status: '试用期', phone: '13800138145', email: 'tangning@zhihui-erp.cn' },
      { id: 'ZH015', name: '许诺', dept: '仓储部', title: '物流专员', joinedAt: '2022-10-17', status: '休假', phone: '13800138156', email: 'xunuo@zhihui-erp.cn' },
      { id: 'ZH016', name: '刘志强', dept: '生产部', title: '生产经理', joinedAt: '2018-05-14', status: '在职', phone: '13800138167', email: 'liuzhiqiang@zhihui-erp.cn' },
      { id: 'ZH017', name: '陈超', dept: '生产部', title: 'SMT 主管', joinedAt: '2019-08-26', status: '在职', phone: '13800138178', email: 'chenchao@zhihui-erp.cn' },
      { id: 'ZH018', name: '周成', dept: '生产部', title: '组装线长', joinedAt: '2020-03-11', status: '在职', phone: '13800138189', email: 'zhoucheng@zhihui-erp.cn' },
      { id: 'ZH019', name: '王芳', dept: '生产部', title: '生产计划员', joinedAt: '2022-07-05', status: '在职', phone: '13800138190', email: 'wangfang@zhihui-erp.cn' },
      { id: 'ZH020', name: '张伟', dept: '设备部', title: '设备主管', joinedAt: '2017-12-01', status: '在职', phone: '13800138201', email: 'zhangwei@zhihui-erp.cn' },
      { id: 'ZH021', name: '吴昊', dept: '设备部', title: '维修技师', joinedAt: '2021-09-16', status: '在职', phone: '13800138212', email: 'wuhao@zhihui-erp.cn' },
      { id: 'ZH022', name: '何俊', dept: '设备部', title: '点检员', joinedAt: '2023-04-10', status: '在职', phone: '13800138223', email: 'hejun@zhihui-erp.cn' },
      { id: 'ZH023', name: '陈雅', dept: '品质部', title: '品质主管', joinedAt: '2018-10-22', status: '在职', phone: '13800138234', email: 'chenya@zhihui-erp.cn' },
      { id: 'ZH024', name: '李楠', dept: '品质部', title: '品质工程师', joinedAt: '2021-06-18', status: '在职', phone: '13800138245', email: 'linan@zhihui-erp.cn' },
      { id: 'ZH025', name: '赵磊', dept: '品质部', title: 'IQC 检验员', joinedAt: '2024-02-26', status: '试用期', phone: '13800138256', email: 'zhaolei@zhihui-erp.cn' }
    ];
  }

  function buildSeedCustomers() {
    var customers = [
      ['深圳市启明智能科技有限公司', 'A', '智能硬件', '张启明', '0755-86921001', 'zhang@qiming-iot.cn', '华南 · 深圳', '深圳市南山区科技园科苑路 18 号', 3860000, 28, '合作中'],
      ['杭州云栖数字科技有限公司', 'A', '物联网平台', '沈云舟', '0571-88122002', 'shen@yunqi-digital.cn', '华东 · 杭州', '杭州市余杭区文一西路 969 号', 2540000, 19, '合作中'],
      ['上海集成电路设计有限公司', 'A', '芯片设计', '顾明远', '021-66882003', 'gu@sh-ic.cn', '华东 · 上海', '上海市浦东新区张江高科技园区', 1980000, 16, '合作中'],
      ['北京星轨物联科技有限公司', 'A', '智慧城市', '韩晨', '010-86222004', 'han@starlink-iot.cn', '华北 · 北京', '北京市海淀区中关村软件园 23 号', 1620000, 11, '合作中'],
      ['成都西岭电子股份有限公司', 'B', '电子制造', '罗雪', '028-88222005', 'luoxue@xiling-elec.cn', '西南 · 成都', '成都市高新区天府大道中段 666 号', 1280000, 9, '合作中'],
      ['苏州锐驰自动化有限公司', 'B', '工业自动化', '邵峰', '0512-66882006', 'shaofeng@ruichi-auto.cn', '华东 · 苏州', '苏州市工业园区星湖街 328 号', 960000, 7, '合作中'],
      ['广州万联商贸有限公司', 'B', '渠道分销', '梁嘉', '020-38222007', 'liangjia@wanlian.cn', '华南 · 广州', '广州市天河区珠江新城华夏路 8 号', 720000, 6, '合作中'],
      ['武汉光谷智造有限公司', 'B', '智能制造', '方启', '027-86222008', 'fangqi@ggzz.cn', '华中 · 武汉', '武汉市东湖高新区光谷大道 77 号', 540000, 4, '待跟进'],
      ['南京联创电子科技有限公司', 'B', '电子制造', '许文', '025-88222009', 'xuwen@nj-lianchuang.cn', '华东 · 南京', '南京市江宁区将军大道 100 号', 380000, 3, '合作中'],
      ['东莞精工制造有限公司', 'C', '精密制造', '廖军', '0769-88222010', 'liaojun@dg-jinggong.cn', '华南 · 东莞', '东莞市松山湖高新技术开发区', 260000, 2, '待跟进'],
      ['厦门海丝智能科技有限公司', 'C', '智能家居', '蔡琳', '0592-88222011', 'cailin@haishi-smart.cn', '华南 · 厦门', '厦门市思明区软件园二期', 180000, 2, '暂停合作'],
      ['青岛海创未来电子有限公司', 'C', '消费电子', '宋涛', '0532-88222012', 'songtao@haichuang.cn', '华北 · 青岛', '青岛市崂山区海尔路 182 号', 96000, 1, '合作中']
    ];
    return customers.map(function (row, index) {
      return {
        id: 'C-' + (1001 + index),
        name: row[0],
        level: row[1],
        industry: row[2],
        contact: row[3],
        phone: row[4],
        email: row[5],
        region: row[6],
        address: row[7],
        totalSpend: row[8],
        ordersCount: row[9],
        status: row[10],
        joinedAt: ['2022-03-16', '2022-08-09', '2021-11-22', '2023-01-18', '2023-04-02', '2023-07-19', '2023-09-06', '2024-01-15', '2024-03-21', '2024-06-11', '2024-10-08', '2025-03-26'][index]
      };
    });
  }

  function buildSeedProducts() {
    var rows = [
      ['ZG-GW-2000', '智核 IoT 网关 Pro', '网关设备', 86, 40, 2680, '台', '深圳 A 仓', '智核自研'],
      ['ZG-EC-X3', '边缘计算主机 X3', '边缘计算', 32, 35, 4980, '台', '深圳 A 仓', '智核自研'],
      ['ZG-M4-4G', '工业级 4G 模组 M4', '核心模组', 420, 150, 168, '片', '深圳 B 仓', '芯联科技'],
      ['ZG-TH-10', '温湿度传感器 TH-10', '传感器', 68, 100, 129, '只', '深圳 B 仓', '森感科技'],
      ['ZG-BP-20', '高精度气压传感器 BP-20', '传感器', 240, 80, 356, '只', '深圳 B 仓', '森感科技'],
      ['ZG-SW-8P', '工业交换机 8 口 SW-8P', '网络设备', 18, 20, 1280, '台', '深圳 A 仓', '华联网络'],
      ['ZG-EC-100', '智能电表采集器 EC-100', '采集设备', 156, 60, 468, '台', '深圳 A 仓', '智核自研'],
      ['ZG-BLE-5', '蓝牙信标 BLE-5', '传感器', 610, 200, 59, '只', '深圳 B 仓', '蓝桥微电'],
      ['ZG-ANT-4G', '4G 全向天线 ANT-4G', '配件耗材', 95, 50, 86, '根', '深圳 B 仓', '华联网络'],
      ['ZG-PSU-12', '工业电源适配器 12V/5A', '配件耗材', 380, 120, 45, '个', '深圳 B 仓', '恒力电源'],
      ['ZG-BOX-68', '防水接线盒 IP68', '配件耗材', 45, 60, 32, '个', '深圳 B 仓', '恒力电源'],
      ['ZG-CBL-2M', '工业级数据线束 2m', '配件耗材', 720, 200, 28, '套', '深圳 B 仓', '恒力电源']
    ];
    return rows.map(function (row, index) {
      return {
        id: 'P-' + pad(index + 1),
        sku: row[0],
        name: row[1],
        category: row[2],
        stock: row[3],
        safetyStock: row[4],
        price: row[5],
        unit: row[6],
        warehouse: row[7],
        supplier: row[8],
        updatedAt: dateToISO(new Date(Date.now() - (index + 1) * 86400000))
      };
    });
  }

  /* =========================================================
   * 制造端：BOM / 工艺路线 / 设备 / 工单 / 报工
   * ======================================================= */

  /** 今日相对日期（本地时区），用于种子数据保持“最近 N 天”的新鲜度 */
  function dateOffsetDate(days) {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  }

  function dateDaysAgo(days) {
    return dateToISO(dateOffsetDate(-days));
  }

  function dateOffsetISO(days, hour, minute) {
    var now = new Date();
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour || 9, minute || 0, 0);
    return d.toISOString();
  }

  /** 5 个自制产品 BOM：网关 / 边缘计算主机 / 4G 模组 / 采集器 / 蓝牙信标 */
  var BOM_SEEDS = [
    {
      productId: 'P-01', version: 'V2.3', owner: '何睿', effectiveAt: '2026-08-01',
      components: [
        { sku: 'ZG-M4-4G', name: '工业级 4G 模组 M4', qty: 1, unit: '片', type: '外购' },
        { sku: 'ZG-TH-10', name: '温湿度传感器 TH-10', qty: 2, unit: '只', type: '外购' },
        { sku: 'ZG-BP-20', name: '高精度气压传感器 BP-20', qty: 1, unit: '只', type: '外购' },
        { sku: 'ZG-ANT-4G', name: '4G 全向天线 ANT-4G', qty: 2, unit: '根', type: '外购' },
        { sku: 'ZG-PSU-12', name: '工业电源适配器 12V/5A', qty: 1, unit: '个', type: '外购' },
        { sku: 'ZG-BOX-68', name: '防水接线盒 IP68', qty: 1, unit: '个', type: '外购' },
        { sku: 'PCBA-GW-2000', name: '网关主控 PCBA', qty: 1, unit: '块', type: '自制' }
      ]
    },
    {
      productId: 'P-02', version: 'V1.6', owner: '何睿', effectiveAt: '2026-09-12',
      components: [
        { sku: 'ZG-M4-4G', name: '工业级 4G 模组 M4', qty: 2, unit: '片', type: '外购' },
        { sku: 'ZG-PSU-12', name: '工业电源适配器 12V/5A', qty: 1, unit: '个', type: '外购' },
        { sku: 'ZG-CBL-2M', name: '工业级数据线束 2m', qty: 2, unit: '套', type: '外购' },
        { sku: 'PCBA-EC-X3', name: '边缘计算主控 PCBA', qty: 1, unit: '块', type: '自制' }
      ]
    },
    {
      productId: 'P-03', version: 'V1.2', owner: '何睿', effectiveAt: '2026-06-20',
      components: [
        { sku: 'MAT-RF-FE', name: '射频前端模组', qty: 1, unit: '片', type: '外购' },
        { sku: 'MAT-BB-X55', name: '基带芯片 X55', qty: 1, unit: '颗', type: '外购' },
        { sku: 'MAT-SHLD', name: '屏蔽罩 18×18mm', qty: 1, unit: '个', type: '外购' },
        { sku: 'MAT-PCB-6L', name: '6 层 PCB 板', qty: 1, unit: '片', type: '外购' },
        { sku: 'MAT-SMT-KIT', name: '贴片阻容套件', qty: 1, unit: '套', type: '外购' }
      ]
    },
    {
      productId: 'P-07', version: 'V1.4', owner: '何睿', effectiveAt: '2026-07-08',
      components: [
        { sku: 'ZG-M4-4G', name: '工业级 4G 模组 M4', qty: 1, unit: '片', type: '外购' },
        { sku: 'ZG-TH-10', name: '温湿度传感器 TH-10', qty: 1, unit: '只', type: '外购' },
        { sku: 'ZG-PSU-12', name: '工业电源适配器 12V/5A', qty: 1, unit: '个', type: '外购' },
        { sku: 'ZG-CBL-2M', name: '工业级数据线束 2m', qty: 1, unit: '套', type: '外购' },
        { sku: 'PCBA-EC-100', name: '采集器主控 PCBA', qty: 1, unit: '块', type: '自制' }
      ]
    },
    {
      productId: 'P-08', version: 'V1.1', owner: '何睿', effectiveAt: '2026-05-16',
      components: [
        { sku: 'PCBA-BLE-5', name: '蓝牙信标 PCBA', qty: 1, unit: '块', type: '自制' },
        { sku: 'MAT-CR2032', name: '锂锰电池 CR2032', qty: 1, unit: '颗', type: '外购' },
        { sku: 'MAT-SHELL-BLE', name: 'PC/ABS 外壳', qty: 1, unit: '套', type: '外购' }
      ]
    }
  ];

  /** 各产品的工艺路线：3–5 道工序，每道工序归属一条产线 */
  var PRODUCT_ROUTINGS = {
    'P-01': [
      { code: 'OP10', name: 'SMT 贴片', lineId: 'L1', stdMinutes: 42 },
      { code: 'OP20', name: '板级功能测试', lineId: 'L1', stdMinutes: 26 },
      { code: 'OP30', name: '整机组装', lineId: 'L2', stdMinutes: 34 },
      { code: 'OP40', name: '老化与射频测试', lineId: 'L2', stdMinutes: 68 },
      { code: 'OP50', name: '包装入库', lineId: 'L3', stdMinutes: 16 }
    ],
    'P-02': [
      { code: 'OP10', name: 'SMT 贴片', lineId: 'L1', stdMinutes: 55 },
      { code: 'OP20', name: '整机组装', lineId: 'L2', stdMinutes: 48 },
      { code: 'OP30', name: '烧录与功能测试', lineId: 'L3', stdMinutes: 72 },
      { code: 'OP40', name: '包装入库', lineId: 'L3', stdMinutes: 18 }
    ],
    'P-03': [
      { code: 'OP10', name: 'SMT 贴片', lineId: 'L1', stdMinutes: 12 },
      { code: 'OP20', name: '回流焊与分板', lineId: 'L1', stdMinutes: 9 },
      { code: 'OP30', name: '模组测试包装', lineId: 'L3', stdMinutes: 7 }
    ],
    'P-07': [
      { code: 'OP10', name: 'SMT 贴片', lineId: 'L1', stdMinutes: 24 },
      { code: 'OP20', name: '整机组装', lineId: 'L2', stdMinutes: 31 },
      { code: 'OP30', name: '计量校准测试', lineId: 'L3', stdMinutes: 45 },
      { code: 'OP40', name: '包装入库', lineId: 'L3', stdMinutes: 14 }
    ],
    'P-08': [
      { code: 'OP10', name: 'SMT 贴片', lineId: 'L1', stdMinutes: 8 },
      { code: 'OP20', name: '烧录与测试', lineId: 'L3', stdMinutes: 11 },
      { code: 'OP30', name: '包装入库', lineId: 'L3', stdMinutes: 6 }
    ]
  };

  function buildSeedBoms(products) {
    return BOM_SEEDS.map(function (seed, index) {
      var product = products.find(function (item) { return item.id === seed.productId; }) || { name: '—', sku: '—' };
      return {
        id: 'BOM-' + pad(index + 1),
        productId: seed.productId,
        productName: product.name,
        sku: product.sku,
        version: seed.version,
        status: '生效',
        owner: seed.owner,
        effectiveAt: seed.effectiveAt,
        components: seed.components.map(function (component) {
          return {
            sku: component.sku,
            name: component.name,
            qty: component.qty,
            unit: component.unit,
            type: component.type
          };
        })
      };
    });
  }

  /**
   * 根据累计完成数推导工序进度：总进度按工序数均分到每道工序。
   * 种子数据与运行时报工共用同一套算法，保证工单/工序/看板一致。
   */
  function buildOperations(productId, completedQty, planQty) {
    var routing = PRODUCT_ROUTINGS[productId] || [];
    var total = routing.length;
    var ratio = planQty ? Math.max(0, Math.min(1, (Number(completedQty) || 0) / planQty)) : 0;
    return routing.map(function (operation, index) {
      var progress = Math.max(0, Math.min(100, Math.round((ratio * total - index) * 100)));
      return {
        code: operation.code,
        name: operation.name,
        lineId: operation.lineId,
        stdMinutes: operation.stdMinutes,
        progress: progress,
        status: progress >= 100 ? '已完成' : progress > 0 ? '进行中' : '未开始'
      };
    });
  }

  /** 13 台设备覆盖 3 条产线：SMT 6 台 / 组装 3 台 / 测试包装 4 台 */
  var DEVICE_SEEDS = [
    ['L1', 'EQ-SP-01', '全自动锡膏印刷机 SP-01', '锡膏印刷机', '刘志强', '运行', 89.2, 94.6, 96.1, 1, '2022-05-18', '印刷精度 ±25μm，SPI 在线闭环'],
    ['L1', 'EQ-SM-01', '高速贴片机 SM-01', '贴片机', '刘志强', '运行', 91.4, 95.2, 97.0, 0, '2021-09-03', '6 万点/小时，支持 01005 元件'],
    ['L1', 'EQ-SM-02', '多功能贴片机 SM-02', '贴片机', '陈超', '运行', 86.6, 92.8, 94.9, 2, '2022-11-21', '异形元件与连接器贴装'],
    ['L1', 'EQ-RF-01', '无铅回流焊 RF-01', '回流焊', '张伟', '运行', 88.1, 93.4, 95.6, 2, '2020-12-15', '10 温区，氮气保护'],
    ['L1', 'EQ-RF-02', '热风回流焊 RF-02', '回流焊', '张伟', '故障', 63.5, 78.2, 85.1, 1, '2021-11-06', '温区 3 温控报警，等待备件'],
    ['L1', 'EQ-AOI-01', '3D AOI 检测仪 AOI-01', 'AOI 检测', '李楠', '待机', 78.2, 86.5, 92.4, 3, '2023-02-14', '光源亮度衰减，等待灯板备件'],
    ['L2', 'EQ-AL-01', '柔性组装线 AL-01', '组装线', '周成', '运行', 84.7, 91.2, 94.2, 1, '2021-04-08', '12 工位，支持混线生产'],
    ['L2', 'EQ-AS-01', '自动锁螺丝机 AS-01', '锁螺丝机', '周成', '运行', 82.9, 90.4, 93.1, 4, '2022-07-19', '双轴伺服锁付，扭矩可追溯'],
    ['L2', 'EQ-AG-01', '恒温老化柜 AG-01', '老化测试柜', '何俊', '保养中', 74.5, 88.6, 91.8, 0, '2021-07-09', '季度保养中，预计今日 16:00 恢复'],
    ['L3', 'EQ-FT-01', '射频功能测试台 FT-01', '测试台', '陈雅', '运行', 87.8, 93.0, 95.4, 2, '2022-01-20', '支持 4G/蓝牙/GPS 三模测试'],
    ['L3', 'EQ-FT-02', '综合功能测试台 FT-02', '测试台', '陈雅', '运行', 85.2, 91.8, 94.0, 5, '2023-05-11', '整机功能与功耗测试'],
    ['L3', 'EQ-PK-01', '自动包装线 PK-01', '包装机', '吴昊', '运行', 80.6, 89.5, 92.2, 6, '2021-10-27', '自动贴标 / 装盒 / 称重'],
    ['L3', 'EQ-MK-01', '激光打标机 MK-01', '打标机', '吴昊', '待机', 76.4, 85.0, 91.0, 8, '2020-08-13', '二维码追溯打标']
  ];

  function buildSeedDevices() {
    return DEVICE_SEEDS.map(function (row) {
      return {
        id: row[1],
        code: row[1],
        name: row[2],
        type: row[3],
        lineId: row[0],
        owner: row[4],
        status: row[5],
        oee: row[6],
        availability: row[7],
        performance: row[8],
        lastCheck: dateDaysAgo(row[9]),
        purchasedAt: row[10],
        note: row[11]
      };
    });
  }

  function buildSeedDeviceLogs(devices) {
    var logs = [];
    devices.forEach(function (device, index) {
      var attention = device.id === 'EQ-RF-02' || device.id === 'EQ-AOI-01';
      logs.push({
        id: 'DL-' + pad(index * 3 + 1),
        deviceId: device.id,
        type: '点检',
        title: '例行点检 · ' + (device.id === 'EQ-AOI-01' ? '光源与相机模组' : device.id === 'EQ-RF-02' ? '温控与传动系统' : '设备外观与安全防护'),
        operator: device.owner,
        at: dateOffsetISO(-(1 + (index % 7)), 8 + (index % 4), 20 + ((index * 7) % 30)),
        result: attention ? '待关注' : '正常',
        statusFrom: '',
        statusTo: '',
        note: device.id === 'EQ-RF-02'
          ? '温区 3 实测温差 +6℃，已记录并安排复测。'
          : device.id === 'EQ-AOI-01'
            ? '成像亮度较基线下降 12%，建议更换光源灯板。'
            : '点检项全部通过，设备可正常投入生产。'
      });
    });
    logs.push({
      id: 'DL-041', deviceId: 'EQ-RF-02', type: '状态',
      title: '设备故障 · 温区 3 温度报警', operator: '张伟',
      at: dateOffsetISO(-1, 14, 35), result: '异常',
      statusFrom: '运行', statusTo: '故障',
      note: '生产过程中温区 3 实测温度偏高 11℃，已停机隔离在制板并提交报修单 RO-1001。'
    });
    logs.push({
      id: 'DL-042', deviceId: 'EQ-AG-01', type: '保养',
      title: '季度保养开始 · 老化柜 AG-01', operator: '何俊',
      at: dateOffsetISO(0, 8, 40), result: '进行中',
      statusFrom: '待机', statusTo: '保养中',
      note: '清洁风道、校准温控探头、检查加热管与门封。'
    });
    logs.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    return logs;
  }

  var MAINTENANCE_PLAN_SEEDS = [
    ['EQ-SP-01', '钢网与刮刀月度保养', '每月', 4, '刘志强', '清洁钢网 / 检查刮刀压力 / 校准印刷平台'],
    ['EQ-SM-01', '贴片机月度保养', '每月', 6, '刘志强', '清洁吸嘴 / 校验 Feeder / 导轨润滑'],
    ['EQ-SM-02', '贴片机月度保养', '每月', 9, '陈超', '清洁吸嘴 / 校验视觉相机 / 检查真空泵'],
    ['EQ-RF-01', '回流焊温区季度保养', '每季度', 12, '张伟', '清理助焊剂残留 / 校准温区曲线 / 传动链条润滑'],
    ['EQ-RF-02', '回流焊温区季度保养', '每季度', 2, '张伟', '温区校准 / 传动链条润滑 / 风道清洁'],
    ['EQ-AG-01', '老化柜季度保养', '每季度', 0, '何俊', '清洁风道 / 校准温控探头 / 检查加热管'],
    ['EQ-FT-01', '测试台年度校准', '每年', 21, '陈雅', '射频通道校准 / 探针更换 / 治具校验'],
    ['EQ-PK-01', '包装机月度保养', '每月', 14, '吴昊', '清洁输送带 / 检查封口气压 / 校准称重'],
    ['EQ-MK-01', '激光打标机季度保养', '每季度', 25, '吴昊', '镜片清洁 / 光路校准 / 冷却系统检查']
  ];

  function buildSeedMaintenancePlans() {
    return MAINTENANCE_PLAN_SEEDS.map(function (row, index) {
      return {
        id: 'MP-' + pad(index + 1),
        deviceId: row[0],
        name: row[1],
        cycle: row[2],
        nextDate: dateToISO(dateOffsetDate(row[3])),
        owner: row[4],
        items: row[5],
        status: row[0] === 'EQ-AG-01' ? '进行中' : '待执行'
      };
    });
  }

  function buildSeedMaintenanceRecords() {
    var rows = [
      ['EQ-RF-01', '回流焊温区季度保养', '保养', -38, '张伟', '正常', '清理 3 个温区助焊剂残留，温控曲线复测通过。'],
      ['EQ-SM-01', '贴片机月度保养', '保养', -21, '刘志强', '正常', '更换 2 号吸嘴，Feeder 校验通过。'],
      ['EQ-AG-01', '老化柜季度保养', '保养', -9, '何俊', '正常', '清洁风道，校准温控探头，门封完好。'],
      ['EQ-FT-02', '测试台年度校准', '校准', -15, '陈雅', '正常', '射频通道校准完成，偏差 < 0.5dB。']
    ];
    return rows.map(function (row, index) {
      return {
        id: 'MR-' + pad(index + 1),
        deviceId: row[0],
        name: row[1],
        type: row[2],
        date: dateDaysAgo(-row[3]),
        operator: row[4],
        result: row[5],
        note: row[6]
      };
    });
  }

  function buildSeedRepairOrders() {
    var rows = [
      ['EQ-RF-02', '回流焊温区 3 温度异常', '生产过程中温区 3 报警，实测温差 +11℃，已停机隔离在制板。', '维修中', '高', '张伟', '张伟', -1, -1, 0, ''],
      ['EQ-AOI-01', 'AOI 光源亮度衰减', '检测图像偏暗，误判率上升，需更换灯板。', '待派工', '中', '李楠', '', -2, 0, 0, ''],
      ['EQ-SM-02', '吸嘴真空压力不足', '贴装抛料率升高，真空压力低于阈值。', '已完成', '低', '陈超', '吴昊', -33, -32, -31, '清洁真空过滤棉并更换 2 号吸嘴，压力恢复正常。'],
      ['EQ-PK-01', '封口温度波动', '封口温度上下浮动 ±8℃，需校准温控模块。', '已完成', '中', '吴昊', '吴昊', -19, -18, -18, '重新标定温控模块，连续 30 分钟温度波动 < ±2℃。']
    ];
    return rows.map(function (row, index) {
      return {
        id: 'RO-' + (1001 + index),
        deviceId: row[0],
        title: row[1],
        description: row[2],
        status: row[3],
        priority: row[4],
        reporter: row[5],
        assignee: row[6] || '待派工',
        reportedAt: dateOffsetISO(row[7], 10, 0),
        startedAt: row[8] ? dateOffsetISO(row[8], 10, 30) : null,
        finishedAt: row[9] ? dateOffsetISO(row[9], 16, 50) : null,
        solution: row[10] || ''
      };
    });
  }

  /** 10 张生产工单：3 生产中 / 2 待产 / 3 已完工 / 2 已暂停（其中 1 张受设备故障影响） */
  var WORK_ORDER_SEEDS = [
    { productId: 'P-01', planQty: 480, ratio: 0.85, lineId: 'L1', deviceIds: ['EQ-SM-01', 'EQ-RF-01', 'EQ-FT-01'], status: '生产中', startOffset: -6, dueOffset: 6, owner: '刘志强', priority: '高' },
    { productId: 'P-02', planQty: 240, ratio: 0.79, lineId: 'L2', deviceIds: ['EQ-AL-01', 'EQ-AG-01', 'EQ-FT-02'], status: '生产中', startOffset: -4, dueOffset: 9, owner: '周成', priority: '中' },
    { productId: 'P-03', planQty: 1200, ratio: 0.84, lineId: 'L1', deviceIds: ['EQ-SM-02', 'EQ-RF-02'], status: '生产中', startOffset: -5, dueOffset: 3, owner: '陈超', priority: '高' },
    { productId: 'P-07', planQty: 600, ratio: 0, lineId: 'L2', deviceIds: ['EQ-AL-01'], status: '待产', startOffset: 1, dueOffset: 12, owner: '周成', priority: '中' },
    { productId: 'P-08', planQty: 900, ratio: 0, lineId: 'L3', deviceIds: ['EQ-FT-01', 'EQ-PK-01'], status: '待产', startOffset: 2, dueOffset: 14, owner: '陈雅', priority: '低' },
    { productId: 'P-01', planQty: 320, ratio: 1, lineId: 'L1', deviceIds: ['EQ-SM-01', 'EQ-RF-01'], status: '已完工', startOffset: -18, dueOffset: -6, owner: '刘志强', priority: '中' },
    { productId: 'P-02', planQty: 180, ratio: 1, lineId: 'L2', deviceIds: ['EQ-AL-01', 'EQ-AG-01'], status: '已完工', startOffset: -22, dueOffset: -9, owner: '周成', priority: '中' },
    { productId: 'P-07', planQty: 500, ratio: 0.52, lineId: 'L3', deviceIds: ['EQ-FT-02', 'EQ-PK-01'], status: '已暂停', startOffset: -9, dueOffset: -1, owner: '陈雅', priority: '高', pauseReason: '4G 模组 M4 来料检验不合格，等待补料后恢复' },
    { productId: 'P-03', planQty: 800, ratio: 0.55, lineId: 'L1', deviceIds: ['EQ-SM-02', 'EQ-RF-02'], status: '已暂停', startOffset: -4, dueOffset: 4, owner: '陈超', priority: '中', pauseReason: 'SMT 二线回流焊 RF-02 故障，等待设备部抢修' },
    { productId: 'P-08', planQty: 400, ratio: 1, lineId: 'L3', deviceIds: ['EQ-PK-01', 'EQ-MK-01'], status: '已完工', startOffset: -24, dueOffset: -12, owner: '陈雅', priority: '低' }
  ];

  function buildSeedWorkOrders(products, boms) {
    var reports = [];
    var workOrders = WORK_ORDER_SEEDS.map(function (seed, index) {
      var product = products.find(function (item) { return item.id === seed.productId; }) || { name: '—', sku: '—' };
      var bom = boms.find(function (item) { return item.productId === seed.productId; }) || { id: 'BOM-00', version: 'V1.0' };
      var createdOffset = seed.status === '待产' ? -1 : seed.startOffset - 1;
      var createdAt = dateOffsetISO(createdOffset, 8, 30);
      var monthPart = createdAt.slice(0, 7).replace('-', '');
      var id = 'WO-' + monthPart + '-' + pad(index + 1);
      var completed = seed.status === '已完工' ? seed.planQty : Math.round(seed.planQty * seed.ratio);
      var defect = 0;
      var window = seed.status === '生产中' ? { start: seed.startOffset, end: 0 }
        : seed.status === '已暂停' ? { start: seed.startOffset, end: -(1 + (index % 2)) }
          : seed.status === '已完工' ? { start: seed.startOffset, end: seed.dueOffset }
            : null;
      if (window && completed > 0) {
        var chunks = 3 + (index % 3);
        defect = Math.round(completed * (0.013 + (index % 4) * 0.005));
        var qtyBase = Math.floor(completed / chunks);
        var qtyRest = completed - qtyBase * chunks;
        var defBase = Math.floor(defect / chunks);
        var defRest = defect - defBase * chunks;
        var routing = PRODUCT_ROUTINGS[seed.productId] || [];
        var span = Math.max(1, window.end - window.start);
        for (var c = 0; c < chunks; c += 1) {
          var day = window.end - Math.round((chunks - 1 - c) * span / Math.max(1, chunks - 1));
          var operation = routing[Math.min(routing.length - 1, Math.floor((c / chunks) * routing.length))];
          reports.push({
            id: 'PR-' + String(index * 10 + c + 101),
            workOrderId: id,
            // 最后一次报工（通常是今天）归属主设备，保证设备详情能看到当日产量
            deviceId: seed.deviceIds[c === chunks - 1 ? 0 : c % seed.deviceIds.length],
            operationCode: operation ? operation.code : 'OP10',
            qty: qtyBase + (c < qtyRest ? 1 : 0),
            defectQty: defBase + (c < defRest ? 1 : 0),
            operator: seed.owner,
            at: dateOffsetISO(day, 9 + (c % 8), 10 + (c * 7) % 40),
            note: '工序报工 · ' + product.name
          });
        }
      }
      return {
        id: id,
        productId: seed.productId,
        productName: product.name,
        productSku: product.sku,
        bomId: bom.id,
        bomVersion: bom.version,
        planQty: seed.planQty,
        completedQty: completed,
        defectQty: defect,
        lineId: seed.lineId,
        deviceIds: seed.deviceIds.slice(),
        status: seed.status,
        priority: seed.priority,
        owner: seed.owner,
        startDate: dateToISO(dateOffsetDate(seed.startOffset)),
        dueDate: dateToISO(dateOffsetDate(seed.dueOffset)),
        createdAt: createdAt,
        updatedAt: createdAt,
        operations: buildOperations(seed.productId, completed, seed.planQty),
        pauseReason: seed.pauseReason || ''
      };
    });
    reports.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    workOrders.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    return { workOrders: workOrders, productionReports: reports };
  }

  /** 根据订单金额拆出商品明细，保证明细小计等于订单金额 */
  function buildOrderItems(amount, seedIndex, products) {
    var first = products[seedIndex % products.length];
    var second = products[(seedIndex + 3) % products.length];
    var firstQty = 6 + (seedIndex % 4) * 3;
    var secondQty = 3 + (seedIndex % 3) * 2;
    var firstSubtotal = Math.round(amount * 0.58 * 100) / 100;
    var secondSubtotal = Math.round(amount * 0.24 * 100) / 100;
    var firstUnit = round2(firstSubtotal / firstQty);
    var secondUnit = round2(secondSubtotal / secondQty);
    firstSubtotal = round2(firstUnit * firstQty);
    secondSubtotal = round2(secondUnit * secondQty);
    var serviceSubtotal = round2(amount - firstSubtotal - secondSubtotal);
    return [
      {
        productId: first.id,
        sku: first.sku,
        name: first.name,
        spec: '工业级 / 标准质保 2 年',
        qty: firstQty,
        unit: first.unit,
        unitPrice: firstUnit,
        subtotal: firstSubtotal
      },
      {
        productId: second.id,
        sku: second.sku,
        name: second.name,
        spec: '标准规格 / 批次 ' + (2600 + seedIndex),
        qty: secondQty,
        unit: second.unit,
        unitPrice: secondUnit,
        subtotal: secondSubtotal
      },
      {
        productId: 'SVC-INSTALL',
        sku: 'SVC-INSTALL',
        name: '系统集成与部署服务',
        spec: '现场实施 · 联调 · 交付培训',
        qty: 1,
        unit: '项',
        unitPrice: serviceSubtotal,
        subtotal: serviceSubtotal,
        service: true
      }
    ];
  }

  function buildSeedOrders(products, customers) {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var currentDay = now.getDate();
    var rows = [
      // 客户, 金额, 状态, 相对月份, 日期, 销售单元
      ['C-1001', 328600, '已完成', 0, Math.max(1, currentDay), '销售一部'],
      ['C-1002', 256800, '待发货', 0, Math.max(1, currentDay - 1), '销售二部'],
      ['C-1003', 198000, '待付款', 0, Math.max(1, currentDay - 2), '电商事业部'],
      ['C-1004', 156400, '已完成', 0, Math.max(1, currentDay - 2), '销售一部'],
      ['C-1005', 128000, '待发货', 0, Math.max(1, currentDay - 3), '销售二部'],
      ['C-1006', 98600, '已完成', 0, Math.max(1, currentDay - 4), '渠道拓展部'],
      ['C-1007', 72000, '待付款', 0, Math.max(1, currentDay - 5), '销售一部'],
      ['C-1008', 48000, '已完成', 0, Math.max(1, currentDay - 6), '渠道拓展部'],
      ['C-1009', 486000, '已完成', -1, 24, '销售一部'],
      ['C-1010', 326500, '待发货', -1, 19, '渠道拓展部'],
      ['C-1011', 198000, '已完成', -1, 15, '电商事业部'],
      ['C-1012', 122000, '已取消', -1, 11, '销售二部'],
      ['C-1001', 568000, '已完成', -2, 22, '销售一部'],
      ['C-1004', 398800, '待付款', -2, 16, '销售二部'],
      ['C-1007', 238000, '已完成', -2, 9, '渠道拓展部'],
      ['C-1006', 586000, '已完成', -3, 21, '销售一部'],
      ['C-1002', 400000, '已取消', -3, 12, '电商事业部'],
      ['C-1005', 642400, '待发货', -4, 18, '销售二部'],
      ['C-1003', 440000, '已取消', -4, 7, '销售一部'],
      ['C-1009', 894600, '已完成', -5, 20, '销售一部']
    ];

    return rows.map(function (row, index) {
      var date = new Date(year, month + row[3], Math.min(row[4], new Date(year, month + row[3] + 1, 0).getDate()));
      var key = date.getFullYear() + pad(date.getMonth() + 1);
      var customer = customers.find(function (c) { return c.id === row[0]; }) || customers[0];
      var status = row[2];
      var orderId = 'SO-' + key + '-' + String(2060 - index).padStart(4, '0');
      var createdAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9 + (index % 8), 12 + (index % 40), 0).toISOString();
      var paymentTerm = ['账期 30 天', '预付 30%', '款到发货'][index % 3];
      var salesReps = { '销售一部': '李哲', '销售二部': '陈晓', '电商事业部': '周雨', '渠道拓展部': '唐宁' };
      return {
        id: orderId,
        customerId: customer.id,
        customerName: customer.name,
        amount: row[1],
        status: status,
        date: dateToISO(date),
        monthKey: monthKey(date),
        dept: row[5],
        salesRep: salesReps[row[5]],
        paymentTerm: paymentTerm,
        contact: customer.contact,
        phone: customer.phone,
        address: customer.address,
        items: buildOrderItems(row[1], index, products),
        note: status === '已取消'
          ? '客户项目预算调整，双方协商后取消，已释放库存。'
          : ['优先安排顺丰陆运，签收后回传验收单。', '客户要求分两批交付，首批已确认。', '按月结账，需在发货前完成信用复核。'][index % 3],
        createdAt: createdAt,
        updatedAt: createdAt
      };
    }).sort(function (a, b) {
      return new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id);
    });
  }

  function buildSeedAnnouncements() {
    var now = new Date();
    function offsetDate(days) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
      return dateToISO(d);
    }
    return [
      {
        id: 'A-001',
        category: '生产',
        title: 'SMT 二线回流焊 RF-02 故障抢修与排程调整',
        date: offsetDate(1),
        pinned: true,
        content: 'SMT 贴片线回流焊 RF-02 于昨日 14:35 出现温区 3 温控报警，设备部已停机抢修并提交备件申请。受影响工单 WO 已在 MES 标记为「受影响」，生产计划员需在今日 17:00 前完成改线或顺延排程，品质部同步复检在制板。'
      },
      {
        id: 'A-002',
        category: '制度',
        title: '11 月生产排程与绩效核算节点调整通知',
        date: offsetDate(2),
        pinned: true,
        content: '为配合 Q4 交付冲刺，11 月生产排程锁定时间调整为每周一 10:00，生产部、设备部与采购部需同步确认产能、设备可动率与物料齐套情况。绩效核算中新增「工单准交率」与「设备 OEE」两项指标，具体口径见品质部发布的月度经营口径说明。'
      },
      {
        id: 'A-003',
        category: '品质',
        title: 'Q4 良率提升专项启动：目标直通率 98%',
        date: offsetDate(4),
        pinned: false,
        content: '品质部启动 Q4 良率提升专项，围绕 SMT 首件确认、AOI 误判率与测试台校准三条主线推进。目标：整机直通率由 97.6% 提升至 98.2%，客诉批次归零。各产线每日 9:30 同步前一日不良 Top3 与改善动作。'
      },
      {
        id: 'A-004',
        category: '系统',
        title: '生产管理与设备管理模块上线试运行',
        date: offsetDate(6),
        pinned: false,
        content: 'ERP 制造模块（MES）正式上线试运行，覆盖生产工单、工序报工、设备台账、点检保养与维修工单。试运行期间工单与设备数据仍以本机演示数据为准，生产部与设备部需在每日下班前完成报工与点检录入。'
      },
      {
        id: 'A-005',
        category: '行政',
        title: '2026 年度员工体检预约开启',
        date: offsetDate(9),
        pinned: false,
        content: '2026 年度员工体检预约通道已开启，请于 11 月 20 日前在行政服务台完成预约。深圳地区体检时间为 11 月 24 日至 11 月 28 日，异地同事可选择当地合作机构；产线班组请错峰预约，避免影响排程。'
      }
    ];
  }

  function buildSeedTodos() {
    return [
      { id: 'T-01', title: '确认回流焊 RF-02 抢修备件到货与派工', dept: '设备部', due: '今天 15:00', priority: 'high', done: false },
      { id: 'T-02', title: '审核 SMT 一线受影响工单的改线排程', dept: '生产部', due: '今天 17:00', priority: 'high', done: false },
      { id: 'T-03', title: '跟进 4G 模组 M4 齐套到料进度', dept: '采购部', due: '明天 10:00', priority: 'medium', done: false },
      { id: 'T-04', title: '复核 10 月良率与设备 OEE 月报', dept: '品质部', due: '11-08', priority: 'medium', done: true },
      { id: 'T-05', title: '更新设备点检表并同步至 MES', dept: '设备部', due: '11-10', priority: 'low', done: true }
    ];
  }

  function buildSeedDatabase() {
    var employees = buildSeedEmployees();
    var customers = buildSeedCustomers();
    var products = buildSeedProducts();
    var orders = buildSeedOrders(products, customers);
    var boms = buildSeedBoms(products);
    var devices = buildSeedDevices();
    var production = buildSeedWorkOrders(products, boms);
    return {
      seedVersion: SEED_VERSION,
      seededAt: new Date().toISOString(),
      company: {
        name: '深圳智汇智能制造有限公司',
        shortName: '智汇智造',
        creditCode: '91440300MA5F8Z2H7X',
        industry: '智能硬件制造 / 物联网',
        scale: '100-199 人',
        contact: '王敏',
        phone: '0755-8654 2200',
        email: 'ops@zhihui-erp.cn',
        website: 'www.zhihui-erp.cn',
        address: '深圳市宝安区智造产业园 3 栋（SMT 车间 / 组装车间 / 测试中心）',
        intro: '专注 IoT 网关、边缘计算设备与工业传感器的研发与自有产线制造，拥有 SMT 贴片、整机组装、测试包装 3 条产线，为智慧城市、工业物联客户提供从 PCBA 到整机交付的一站式制造服务。'
      },
      employees: employees,
      customers: customers,
      products: products,
      orders: orders,
      boms: boms,
      workOrders: production.workOrders,
      productionReports: production.productionReports,
      devices: devices,
      deviceLogs: buildSeedDeviceLogs(devices),
      maintenancePlans: buildSeedMaintenancePlans(),
      maintenanceRecords: buildSeedMaintenanceRecords(),
      repairOrders: buildSeedRepairOrders(),
      todos: buildSeedTodos(),
      announcements: buildSeedAnnouncements(),
      stockLogs: [
        { id: 'SL-001', productId: 'P-04', sku: 'ZG-TH-10', type: 'out', qty: 24, before: 92, after: 68, note: '订单 SO-2060 发货出库', operator: '吴磊', at: new Date(Date.now() - 2 * 3600000).toISOString() },
        { id: 'SL-002', productId: 'P-08', sku: 'ZG-BLE-5', type: 'in', qty: 200, before: 410, after: 610, note: '蓝桥微电采购批次入库', operator: '孙悦', at: new Date(Date.now() - 26 * 3600000).toISOString() }
      ]
    };
  }

  /* ---------- 数据层 API ---------- */
  function isValidDatabase(db) {
    return Boolean(db) && typeof db === 'object' &&
      Array.isArray(db.employees) && Array.isArray(db.customers) &&
      Array.isArray(db.orders) && Array.isArray(db.products) &&
      Array.isArray(db.workOrders) && Array.isArray(db.devices) &&
      Array.isArray(db.boms) && typeof db.company === 'object';
  }

  function save(db) {
    return writeLocal(STORAGE_KEY, JSON.stringify(db));
  }

  function init() {
    var raw = readLocal(STORAGE_KEY);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        // 制造版（seed v2）初次打开时，旧版 seed v1 的本地数据缺少工单/设备等集合，
        // 直接升级为完整种子数据，避免新页面读取空集合。
        var isCurrent = isValidDatabase(parsed) &&
          parsed.seedVersion === SEED_VERSION &&
          Array.isArray(parsed.productionReports) &&
          Array.isArray(parsed.deviceLogs) &&
          Array.isArray(parsed.maintenancePlans) &&
          Array.isArray(parsed.maintenanceRecords) &&
          Array.isArray(parsed.repairOrders);
        if (isCurrent) {
          // 兼容后续新增的可选集合
          if (!parsed.todos) parsed.todos = buildSeedTodos();
          if (!parsed.announcements) parsed.announcements = buildSeedAnnouncements();
          if (!parsed.stockLogs) parsed.stockLogs = [];
          if (!parsed.company) parsed.company = buildSeedDatabase().company;
          return parsed;
        }
      } catch (err) {
        /* 数据损坏时重建演示数据 */
      }
    }
    var seeded = buildSeedDatabase();
    save(seeded);
    return seeded;
  }

  function reset() {
    var seeded = buildSeedDatabase();
    save(seeded);
    return seeded;
  }

  global.ERPData = {
    STORAGE_KEY: STORAGE_KEY,
    SEED_VERSION: SEED_VERSION,
    DEPARTMENTS: DEPARTMENTS,
    SALES_UNITS: SALES_UNITS,
    REPORT_TARGETS: REPORT_TARGETS,
    UNIT_OWNERS: UNIT_OWNERS,
    PRODUCTION_LINES: PRODUCTION_LINES,
    PRODUCT_ROUTINGS: PRODUCT_ROUTINGS,
    buildOperations: buildOperations,
    init: init,
    save: save,
    reset: reset,
    buildSeedDatabase: buildSeedDatabase,
    readLocal: readLocal,
    writeLocal: writeLocal,
    removeLocal: removeLocal,
    storage: { read: readLocal, write: writeLocal, remove: removeLocal },
    clone: clone
  };

  global.ERPUtil = ERPUtil;
})(window);
