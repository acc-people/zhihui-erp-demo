/* =========================================================
 * 智汇 ERP · 数据层
 * 负责种子数据、localStorage 持久化与通用格式化工具
 * 全局命名空间：ERPData / ERPUtil
 * ======================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'zhihui_erp_db_v1';
  var SEED_VERSION = 1;

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
  var DEPARTMENTS = ['运营部', '销售部', '采购部', '仓储部', '财务部', '技术部'];
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

  function buildSeedEmployees() {
    return [
      { id: 'ZH001', name: '王敏', dept: '运营部', title: '运营主管', joinedAt: '2019-03-18', status: '在职', phone: '13800138012', email: 'wangmin@zhihui-erp.cn' },
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
      { id: 'ZH015', name: '许诺', dept: '仓储部', title: '物流专员', joinedAt: '2022-10-17', status: '休假', phone: '13800138156', email: 'xunuo@zhihui-erp.cn' }
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
        category: '制度',
        title: '11 月绩效考核与提成核算节点调整通知',
        date: offsetDate(2),
        pinned: true,
        content: '为配合 Q4 冲刺节奏，11 月绩效确认截止时间调整为 11 月 28 日 18:00。各业务单元负责人请在此之前完成目标复盘与提成数据确认；财务部将于次月 3 日前完成复核。如有跨部门协作项目，请在系统中补充项目归属说明。'
      },
      {
        id: 'A-002',
        category: '业务',
        title: 'Q4 大客户激励政策正式发布',
        date: offsetDate(4),
        pinned: true,
        content: 'Q4 大客户激励政策已发布至销售资料库。新签年度框架协议且首付款到账的客户，可享受专项交付资源与阶梯返点。政策有效期至 12 月 31 日，具体以合同评审结果为准。'
      },
      {
        id: 'A-003',
        category: '行政',
        title: '2026 年度员工体检预约开启',
        date: offsetDate(6),
        pinned: false,
        content: '2026 年度员工体检预约通道已开启，请于 11 月 20 日前在行政服务台完成预约。深圳地区体检时间为 11 月 24 日至 11 月 28 日，异地同事可选择当地合作机构。'
      },
      {
        id: 'A-004',
        category: '系统',
        title: '本周六 22:00 进行 ERP 例行维护',
        date: offsetDate(9),
        pinned: false,
        content: '为提升系统稳定性，本周六 22:00—23:30 将进行数据库例行维护。维护期间订单查询与库存同步可能短暂不可用，请提前安排相关工作。'
      }
    ];
  }

  function buildSeedTodos() {
    return [
      { id: 'T-01', title: '确认启明智能 Q4 续约定制报价', dept: '销售部', due: '今天 15:00', priority: 'high', done: false },
      { id: 'T-02', title: '审核 3 份采购入库单及随货凭证', dept: '仓储部', due: '今天 17:00', priority: 'medium', done: false },
      { id: 'T-03', title: '回复星轨物联网关技术选型方案', dept: '技术部', due: '明天 10:00', priority: 'high', done: false },
      { id: 'T-04', title: '核对 10 月渠道返点对账单', dept: '财务部', due: '11-08', priority: 'medium', done: true },
      { id: 'T-05', title: '更新官网产品资料至 2.3 版本', dept: '运营部', due: '11-10', priority: 'low', done: true }
    ];
  }

  function buildSeedDatabase() {
    var employees = buildSeedEmployees();
    var customers = buildSeedCustomers();
    var products = buildSeedProducts();
    var orders = buildSeedOrders(products, customers);
    return {
      seedVersion: SEED_VERSION,
      seededAt: new Date().toISOString(),
      company: {
        name: '深圳智汇科技有限公司',
        shortName: '智汇科技',
        creditCode: '91440300MA5F8Z2H7X',
        industry: '智能硬件 / 物联网',
        scale: '100-199 人',
        contact: '王敏',
        phone: '0755-8654 2200',
        email: 'ops@zhihui-erp.cn',
        website: 'www.zhihui-erp.cn',
        address: '深圳市南山区科技园科苑路 15 号智汇大厦 12F',
        intro: '专注智能硬件与物联网解决方案的分销与技术服务，为智慧城市、工业物联与智能家居客户提供从模组、网关到系统交付的一站式支持。'
      },
      employees: employees,
      customers: customers,
      products: products,
      orders: orders,
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
      typeof db.company === 'object';
  }

  function save(db) {
    return writeLocal(STORAGE_KEY, JSON.stringify(db));
  }

  function init() {
    var raw = readLocal(STORAGE_KEY);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (isValidDatabase(parsed)) {
          // 兼容旧版本缺失的字段
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
