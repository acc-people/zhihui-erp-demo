/* =========================================================
 * 智汇 ERP · 应用层
 * 结构：状态与路由 → 视图渲染 → 图表 → 交互 / 表单 → 初始化
 * 数据层见 data.js，图表引擎见 chart.js
 * ======================================================= */
(function () {
  'use strict';

  var Data = window.ERPData;
  var U = window.ERPUtil;
  var Charts = window.ERPCharts;
  if (!Data || !U || !Charts) return;

  var SESSION_KEY = 'zhihui_erp_session_v1';
  var THEME_KEY = 'zhihui_erp_theme_v1';
  var NOTICE_KEY = 'zhihui_erp_notif_read_v1';
  var PAGE_SIZE = 8;

  var PAGE_META = {
    dashboard: { label: '工作台', eyebrow: 'OVERVIEW / 01', icon: 'grid', desc: '经营概览' },
    production: { label: '生产管理', eyebrow: 'MANUFACTURING / 02', icon: 'factory', desc: '生产工单与报工' },
    devices: { label: '设备管理', eyebrow: 'EQUIPMENT / 03', icon: 'chip', desc: '设备台账与运维' },
    employees: { label: '员工管理', eyebrow: 'ORGANIZATION / 04', icon: 'users', desc: '组织与人员' },
    customers: { label: '客户管理', eyebrow: 'CUSTOMERS / 05', icon: 'building', desc: '客户资产' },
    orders: { label: '订单管理', eyebrow: 'SALES ORDERS / 06', icon: 'receipt', desc: '订单履约' },
    inventory: { label: '库存管理', eyebrow: 'INVENTORY / 07', icon: 'box', desc: '库存与预警' },
    reports: { label: '报表中心', eyebrow: 'BUSINESS INTELLIGENCE / 08', icon: 'chart', desc: '经营分析' },
    settings: { label: '系统设置', eyebrow: 'WORKSPACE / 09', icon: 'settings', desc: '工作空间设置' }
  };

  var NAV_ITEMS = [
    { view: 'dashboard', label: '工作台', desc: '经营总览与关键指标', icon: 'grid', keywords: 'dashboard 首页 概览 数据 看板' },
    { view: 'production', label: '生产管理', desc: '生产工单、工序报工与产量趋势', icon: 'factory', keywords: '生产 工单 报工 工序 bom 产线 产量 良率' },
    { view: 'devices', label: '设备管理', desc: '设备台账、点检保养与维修工单', icon: 'chip', keywords: '设备 点检 保养 维修 oee 稼动率 产线' },
    { view: 'employees', label: '员工管理', desc: '组织架构、员工档案与状态', icon: 'users', keywords: '员工 人员 组织 工号 部门' },
    { view: 'customers', label: '客户管理', desc: '客户等级、联系人与交易记录', icon: 'building', keywords: '客户 公司 联系人 等级' },
    { view: 'orders', label: '订单管理', desc: '筛选订单、查看明细与履约状态', icon: 'receipt', keywords: '订单 销售 发货 付款 明细' },
    { view: 'inventory', label: '库存管理', desc: '商品库存、安全线与出入库', icon: 'box', keywords: '库存 sku 商品 入库 出库 预警' },
    { view: 'reports', label: '报表中心', desc: '按月与部门分析经营达成', icon: 'chart', keywords: '报表 分析 业绩 目标 月份' },
    { view: 'settings', label: '系统设置', desc: '公司资料、主题与数据管理', icon: 'settings', keywords: '设置 公司 主题 深色 浅色 数据' }
  ];

  var ORDER_STATUSES = ['待付款', '待发货', '已完成', '已取消'];
  var ORDER_TABS = ['全部'].concat(ORDER_STATUSES);
  var ORDER_STATUS_META = {
    '待付款': { badge: 'warning', color: '#e7a13d' },
    '待发货': { badge: 'info', color: '#4c7ff0' },
    '已完成': { badge: 'success', color: '#16b58b' },
    '已取消': { badge: 'danger', color: '#d97777' }
  };
  var EMPLOYEE_STATUS = { '在职': 'success', '试用期': 'warning', '休假': 'neutral' };
  var CUSTOMER_STATUS = { '合作中': 'success', '待跟进': 'warning', '暂停合作': 'neutral' };
  var WORK_ORDER_STATUSES = ['待产', '生产中', '已暂停', '已完工'];
  var WORK_ORDER_TABS = ['全部'].concat(WORK_ORDER_STATUSES);
  var WORK_ORDER_STATUS_META = {
    '待产': { badge: 'neutral', color: '#94a2b4', rank: 2 },
    '生产中': { badge: 'info', color: '#4c7ff0', rank: 1 },
    '已暂停': { badge: 'warning', color: '#e7a13d', rank: 3 },
    '已完工': { badge: 'success', color: '#16b58b', rank: 4 }
  };
  var DEVICE_STATUSES = ['运行', '待机', '故障', '保养中'];
  var DEVICE_STATUS_META = {
    '运行': { badge: 'success', color: '#16b58b', cls: 'running' },
    '待机': { badge: 'neutral', color: '#94a2b4', cls: 'idle' },
    '故障': { badge: 'danger', color: '#d94e4e', cls: 'fault' },
    '保养中': { badge: 'warning', color: '#e7a13d', cls: 'maintenance' }
  };
  var REPAIR_STATUS_META = {
    '待派工': { badge: 'warning', color: '#e7a13d' },
    '维修中': { badge: 'info', color: '#4c7ff0' },
    '已完成': { badge: 'success', color: '#16b58b' }
  };
  var TONES = ['tone-blue', 'tone-teal', 'tone-amber', 'tone-violet', 'tone-rose', 'tone-slate'];
  var PRIORITIES = {
    high: { label: '高优先级', cls: 'high' },
    medium: { label: '中优先级', cls: 'medium' },
    low: { label: '低优先级', cls: 'low' }
  };

  var db = null;
  var session = null;
  var lastModalFocus = null;
  var commandIndex = 0;
  var resizeTimer = null;
  var searchCache = [];

  var state = {
    view: 'dashboard',
    employeeQuery: '',
    employeeDept: '',
    employeePage: 1,
    customerQuery: '',
    customerLevel: '',
    orderQuery: '',
    orderStatus: '全部',
    expandedOrder: null,
    inventoryQuery: '',
    inventoryCategory: '',
    productionQuery: '',
    productionStatus: '全部',
    productionLine: '',
    productionPage: 1,
    deviceQuery: '',
    deviceStatus: '全部',
    deviceLine: '',
    devicePage: 1,
    reportMonth: U.monthKey(new Date()),
    reportUnit: '全部部门',
    notificationsRead: Data.readLocal(NOTICE_KEY) === '1'
  };

  /* =========================================================
   * 基础工具
   * ======================================================= */
  function $(id) {
    return document.getElementById(id);
  }

  function e(value) {
    return U.escapeHTML(value);
  }

  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function toneFor(seed) {
    var text = String(seed || '');
    var hash = 0;
    for (var i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return TONES[hash % TONES.length];
  }

  function avatar(name, seed, extra) {
    return '<span class="avatar ' + toneFor(seed || name) + (extra ? ' ' + extra : '') + '" aria-hidden="true">' +
      e(U.initials(name)) + '</span>';
  }

  function statusBadge(status) {
    var type = EMPLOYEE_STATUS[status] || CUSTOMER_STATUS[status] ||
      (ORDER_STATUS_META[status] && ORDER_STATUS_META[status].badge) || 'neutral';
    return '<span class="badge badge--' + type + '">' + e(status) + '</span>';
  }

  function orderBadge(status) {
    var meta = ORDER_STATUS_META[status] || { badge: 'neutral' };
    return '<span class="badge badge--' + meta.badge + '">' + e(status) + '</span>';
  }

  function levelBadge(level) {
    var value = String(level || 'C').toUpperCase();
    return '<span class="level-badge level-' + value.toLowerCase() + '"><b>' + e(value) + '</b>级</span>';
  }

  function optionTags(items, selected) {
    return items.map(function (item) {
      var value = typeof item === 'string' ? item : item.value;
      var label = typeof item === 'string' ? item : item.label;
      return '<option value="' + e(value) + '"' + (String(value) === String(selected) ? ' selected' : '') + '>' +
        e(label) + '</option>';
    }).join('');
  }

  function greeting() {
    var hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 11) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 19) return '下午好';
    return '晚上好';
  }

  function chineseDate() {
    var now = new Date();
    var weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + weekdays[now.getDay()];
  }

  function englishDate() {
    var months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    var now = new Date();
    return months[now.getMonth()] + ' ' + U.pad(now.getDate()) + ' · ' + now.getFullYear();
  }

  function currentMonth() {
    return U.monthKey(new Date());
  }

  function sumBy(list, selector) {
    return list.reduce(function (sum, item) {
      return sum + (Number(selector(item)) || 0);
    }, 0);
  }

  function activeOrders() {
    return db.orders.filter(function (order) { return order.status !== '已取消'; });
  }

  function salesForMonth(key) {
    return sumBy(activeOrders().filter(function (order) { return order.monthKey === key; }), function (o) { return o.amount; });
  }

  function lowStockProducts() {
    return db.products.filter(function (product) { return product.stock < product.safetyStock; });
  }

  function pendingShipments() {
    return db.orders.filter(function (order) { return order.status === '待发货'; });
  }

  function pendingPayments() {
    return db.orders.filter(function (order) { return order.status === '待付款'; });
  }

  function employeeNextId() {
    var max = 0;
    db.employees.forEach(function (item) {
      var number = Number(String(item.id).replace(/\D/g, ''));
      if (number > max) max = number;
    });
    return 'ZH' + String(max + 1).padStart(3, '0');
  }

  function customerNextId() {
    var max = 1000;
    db.customers.forEach(function (item) {
      var number = Number(String(item.id).replace(/\D/g, ''));
      if (number > max) max = number;
    });
    return 'C-' + String(max + 1);
  }

  /* =========================================================
   * 制造端基础工具（生产 + 设备共用同一份数据源）
   * ======================================================= */
  var LINES = Data.PRODUCTION_LINES || [];

  function lineById(id) {
    return LINES.find(function (line) { return line.id === id; }) || null;
  }

  function lineName(id) {
    var line = lineById(id);
    return line ? line.name : '—';
  }

  function lineCode(id) {
    var line = lineById(id);
    return line ? line.code : '—';
  }

  function workOrderById(id) {
    return (db.workOrders || []).find(function (item) { return item.id === id; }) || null;
  }

  function deviceById(id) {
    return (db.devices || []).find(function (item) { return item.id === id; }) || null;
  }

  function productById(id) {
    return (db.products || []).find(function (item) { return item.id === id; }) || null;
  }

  function bomForProduct(productId) {
    return (db.boms || []).find(function (item) { return item.productId === productId; }) || null;
  }

  function monthOf(value) {
    return U.monthKey(U.formatDate(value));
  }

  function todayKey() {
    return U.formatDate(new Date());
  }

  function workOrderProgress(order) {
    if (!order || !order.planQty) return 0;
    return Math.max(0, Math.min(100, (Number(order.completedQty) || 0) / order.planQty * 100));
  }

  function workOrderYield(order) {
    if (!order) return null;
    var total = (Number(order.completedQty) || 0) + (Number(order.defectQty) || 0);
    return total ? (Number(order.completedQty) || 0) / total * 100 : null;
  }

  function workOrderStatusBadge(status) {
    var meta = WORK_ORDER_STATUS_META[status] || { badge: 'neutral' };
    return '<span class="badge badge--' + meta.badge + '">' + e(status) + '</span>';
  }

  function deviceStatusBadge(status) {
    var meta = DEVICE_STATUS_META[status] || { badge: 'neutral' };
    return '<span class="badge badge--' + meta.badge + '">' + e(status) + '</span>';
  }

  function deviceStatusChip(id, extraClass) {
    var device = deviceById(id);
    if (!device) return '';
    var meta = DEVICE_STATUS_META[device.status] || DEVICE_STATUS_META['待机'];
    return '<span class="device-chip device-chip--' + meta.cls + (extraClass ? ' ' + extraClass : '') +
      '" title="' + e(device.name + ' · ' + device.status + ' · ' + lineName(device.lineId)) + '">' + e(device.code) + '</span>';
  }

  /** 设备故障时，绑定该设备且处于“生产中”的工单视为受影响工单 */
  function workOrderAffected(order) {
    if (!order || order.status !== '生产中') return false;
    var faultIds = (db.devices || []).filter(function (device) { return device.status === '故障'; })
      .map(function (device) { return device.id; });
    return (order.deviceIds || []).some(function (id) { return faultIds.indexOf(id) !== -1; });
  }

  function affectedWorkOrders() {
    return (db.workOrders || []).filter(workOrderAffected);
  }

  function deviceStatusCounts() {
    var counts = { '运行': 0, '待机': 0, '故障': 0, '保养中': 0 };
    (db.devices || []).forEach(function (device) {
      if (counts[device.status] != null) counts[device.status] += 1;
    });
    return counts;
  }

  function deviceStats() {
    var devices = db.devices || [];
    var counts = deviceStatusCounts();
    var oeeValues = devices.map(function (device) { return Number(device.oee) || 0; });
    return {
      total: devices.length,
      running: counts['运行'],
      idle: counts['待机'],
      fault: counts['故障'],
      maintenance: counts['保养中'],
      avgOee: oeeValues.length ? oeeValues.reduce(function (sum, value) { return sum + value; }, 0) / oeeValues.length : 0,
      counts: counts
    };
  }

  /** 某台设备今日 / 累计产量 = 直接报工到该设备上的良品数 */
  function deviceOutput(deviceId) {
    var today = todayKey();
    var result = { today: 0, total: 0 };
    (db.productionReports || []).forEach(function (report) {
      if (report.deviceId !== deviceId) return;
      var qty = Number(report.qty) || 0;
      result.total += qty;
      if (U.formatDate(report.at) === today) result.today += qty;
    });
    return result;
  }

  function relatedWorkOrders(deviceId) {
    var rank = { '生产中': 0, '已暂停': 1, '待产': 2, '已完工': 3 };
    return (db.workOrders || []).filter(function (order) {
      return (order.deviceIds || []).indexOf(deviceId) !== -1;
    }).sort(function (a, b) {
      var rankA = rank[a.status] == null ? 9 : rank[a.status];
      var rankB = rank[b.status] == null ? 9 : rank[b.status];
      return rankA - rankB || workOrderProgress(b) - workOrderProgress(a);
    });
  }

  function workOrderNextId() {
    var now = new Date();
    var prefix = 'WO-' + now.getFullYear() + U.pad(now.getMonth() + 1) + '-';
    var max = 0;
    (db.workOrders || []).forEach(function (order) {
      if (String(order.id).indexOf(prefix) !== 0) return;
      var number = Number(String(order.id).slice(prefix.length));
      if (number > max) max = number;
    });
    return prefix + U.pad(max + 1);
  }

  /** 近 n 天日产量（良品 / 不良），用于生产趋势图 */
  function dailyOutput(days) {
    var list = [];
    var i;
    for (i = days - 1; i >= 0; i -= 1) {
      var date = new Date();
      date.setDate(date.getDate() - i);
      var key = U.formatDate(date);
      var good = 0;
      var defect = 0;
      (db.productionReports || []).forEach(function (report) {
        if (U.formatDate(report.at) !== key) return;
        good += Number(report.qty) || 0;
        defect += Number(report.defectQty) || 0;
      });
      list.push({ key: key, label: String(date.getDate()), good: good, defect: defect });
    }
    return list;
  }

  /** 生产 KPI：在产工单 / 本月计划达成率 / 良率 / 今日产量 */
  function productionStats() {
    var month = currentMonth();
    var orders = db.workOrders || [];
    var monthOrders = orders.filter(function (order) { return monthOf(order.createdAt) === month; });
    var started = monthOrders.filter(function (order) { return order.status !== '待产'; });
    var planTotal = sumBy(started, function (order) { return order.planQty; });
    var doneTotal = sumBy(started, function (order) { return Math.min(order.completedQty || 0, order.planQty); });
    var reports = db.productionReports || [];
    var monthReports = reports.filter(function (report) { return monthOf(report.at) === month; });
    var good = sumBy(monthReports, function (report) { return report.qty; });
    var defect = sumBy(monthReports, function (report) { return report.defectQty; });
    var todayReports = reports.filter(function (report) { return U.formatDate(report.at) === todayKey(); });
    var capacity = sumBy(LINES, function (line) { return line.dailyCapacity; });
    return {
      active: orders.filter(function (order) { return order.status === '生产中'; }).length,
      producingList: orders.filter(function (order) { return order.status === '生产中'; }),
      pending: orders.filter(function (order) { return order.status === '待产'; }).length,
      completed: orders.filter(function (order) { return order.status === '已完工'; }).length,
      paused: orders.filter(function (order) { return order.status === '已暂停'; }).length,
      monthOrders: monthOrders.length,
      attainment: planTotal ? doneTotal / planTotal * 100 : 0,
      planTotal: planTotal,
      doneTotal: doneTotal,
      yieldRate: good + defect ? good / (good + defect) * 100 : 0,
      monthGood: good,
      monthDefect: defect,
      todayOutput: sumBy(todayReports, function (report) { return report.qty; }),
      todayDefect: sumBy(todayReports, function (report) { return report.defectQty; }),
      capacity: capacity,
      utilization: capacity ? sumBy(todayReports, function (report) { return report.qty; }) / capacity * 100 : 0,
      affected: affectedWorkOrders().length
    };
  }

  function workOrderSort(a, b) {
    var aAffected = workOrderAffected(a) ? 0 : 1;
    var bAffected = workOrderAffected(b) ? 0 : 1;
    if (aAffected !== bAffected) return aAffected - bAffected;
    var rankDiff = (WORK_ORDER_STATUS_META[a.status] || { rank: 9 }).rank - (WORK_ORDER_STATUS_META[b.status] || { rank: 9 }).rank;
    if (rankDiff) return rankDiff;
    return String(a.dueDate).localeCompare(String(b.dueDate));
  }

  function deviceSort(a, b) {
    var rank = { '故障': 0, '保养中': 1, '运行': 2, '待机': 3 };
    var rankA = rank[a.status] == null ? 9 : rank[a.status];
    var rankB = rank[b.status] == null ? 9 : rank[b.status];
    return rankA - rankB || String(a.id).localeCompare(String(b.id));
  }

  function searchField(value, placeholder, key, clearAction) {
    return '<div class="search-field' + (value ? ' has-value' : '') + '">' +
      icon('search') +
      '<input type="text" value="' + e(value) + '" placeholder="' + e(placeholder) + '" data-search="' + key + '" aria-label="' + e(placeholder) + '" autocomplete="off">' +
      '<button class="search-field__clear" type="button" data-action="' + clearAction + '" aria-label="清空搜索">' + icon('close') + '</button>' +
      '</div>';
  }

  function filterSelect(filter, current, allLabel, items, ariaLabel) {
    return '<span class="select-wrap">' +
      '<select class="select filter-select" data-filter="' + filter + '" aria-label="' + e(ariaLabel) + '">' +
      '<option value="">' + e(allLabel) + '</option>' +
      optionTags(items, current) +
      '</select></span>';
  }

  function sparkline(values, color) {
    var width = 100;
    var height = 30;
    var padding = 3;
    var max = Math.max.apply(null, values.concat([1]));
    var min = Math.min.apply(null, values.concat([0]));
    var range = max - min || 1;
    var points = values.map(function (value, index) {
      var x = values.length === 1 ? width / 2 : (width / (values.length - 1)) * index;
      var y = height - padding - ((value - min) / range) * (height - padding * 2);
      return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
    });
    var line = points.map(function (point, index) {
      return (index === 0 ? 'M' : 'L') + point[0] + ' ' + point[1];
    }).join(' ');
    var area = line + ' L' + points[points.length - 1][0] + ' ' + height + ' L' + points[0][0] + ' ' + height + ' Z';
    return '<svg class="kpi-spark" style="--kpi-spark:' + color + '" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">' +
      '<path class="spark-area" d="' + area + '"></path><path d="' + line + '"></path></svg>';
  }

  function pageHead(eyebrow, title, sub, actions) {
    return '<section class="page-head">' +
      '<div class="page-head__left">' +
      '<div class="eyebrow"><span class="eyebrow__dot"></span><span>' + e(eyebrow) + '</span><span class="eyebrow__line"></span><span>' + englishDate() + '</span></div>' +
      '<h1>' + title + '</h1>' +
      '<div class="page-head__sub">' + sub + '</div>' +
      '</div>' +
      (actions ? '<div class="page-actions">' + actions + '</div>' : '') +
      '</section>';
  }

  function tableEmpty(colspan, title, description, actionMarkup) {
    return '<tr><td colspan="' + colspan + '">' +
      '<div class="empty-state">' +
      '<div class="empty-state__icon">' + icon('inbox') + '</div>' +
      '<h3>' + e(title) + '</h3>' +
      '<p>' + e(description) + '</p>' +
      (actionMarkup || '') +
      '</div></td></tr>';
  }

  function pagination(current, pages, action, total) {
    if (total === 0) {
      return '<div class="pagination"><button class="pagination__btn" type="button" disabled aria-label="上一页">' + icon('chevron-left') + '</button>' +
        '<button class="pagination__btn is-active" type="button" disabled>1</button>' +
        '<button class="pagination__btn" type="button" disabled aria-label="下一页">' + icon('chevron-right') + '</button></div>';
    }
    var pageButtons = [];
    var numbers = [];
    if (pages <= 7) {
      for (var p = 1; p <= pages; p += 1) numbers.push(p);
    } else {
      numbers = [1];
      if (current > 3) numbers.push('…');
      for (var i = Math.max(2, current - 1); i <= Math.min(pages - 1, current + 1); i += 1) numbers.push(i);
      if (current < pages - 2) numbers.push('…');
      numbers.push(pages);
    }
    pageButtons.push('<button class="pagination__btn" type="button" data-action="' + action + '" data-page="' + (current - 1) + '"' +
      (current <= 1 ? ' disabled' : '') + ' aria-label="上一页">' + icon('chevron-left') + '</button>');
    numbers.forEach(function (num) {
      if (num === '…') {
        pageButtons.push('<span class="pagination__ellipsis">…</span>');
      } else {
        pageButtons.push('<button class="pagination__btn' + (num === current ? ' is-active' : '') + '" type="button" data-action="' + action + '" data-page="' + num + '"' +
          (num === current ? ' aria-current="page"' : '') + '>' + num + '</button>');
      }
    });
    pageButtons.push('<button class="pagination__btn" type="button" data-action="' + action + '" data-page="' + (current + 1) + '"' +
      (current >= pages ? ' disabled' : '') + ' aria-label="下一页">' + icon('chevron-right') + '</button>');
    return '<div class="pagination">' + pageButtons.join('') + '</div>';
  }

  function showToast(title, message, type) {
    var stack = $('toastStack');
    if (!stack) return;
    while (stack.children.length >= 4) stack.removeChild(stack.firstElementChild);
    var kind = type || 'success';
    var iconName = kind === 'error' ? 'alert-circle' : kind === 'warning' ? 'alert-triangle' : kind === 'info' ? 'info' : 'check-circle';
    var toast = document.createElement('div');
    toast.className = 'toast toast--' + kind;
    toast.setAttribute('role', 'status');
    toast.innerHTML = '<span class="toast__icon">' + icon(iconName) + '</span>' +
      '<div class="toast__body"><div class="toast__title">' + e(title) + '</div>' +
      (message ? '<div class="toast__message">' + e(message) + '</div>' : '') + '</div>' +
      '<button class="toast__close" type="button" aria-label="关闭提示">' + icon('close') + '</button>';
    var timer;
    function remove() {
      if (!toast.parentNode) return;
      toast.classList.add('is-leaving');
      window.setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 190);
    }
    toast.querySelector('.toast__close').addEventListener('click', function () {
      window.clearTimeout(timer);
      remove();
    });
    stack.appendChild(toast);
    timer = window.setTimeout(remove, 3600);
  }

  function saveDatabase() {
    var ok = Data.save(db);
    if (!ok) {
      showToast('本地保存失败', '浏览器可能禁用了 localStorage，本次修改仅保存在内存中。', 'error');
    }
    return ok;
  }

  function syncBodyLock() {
    var modalOpen = $('modalRoot').childElementCount > 0;
    var commandOpen = !$('commandOverlay').hidden;
    document.body.classList.toggle('modal-open', modalOpen || commandOpen);
  }

  function downloadBlob(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
      link.remove();
    }, 500);
  }

  function toCSV(rows) {
    return '\ufeff' + rows.map(function (row) {
      return row.map(function (cell) {
        return '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\r\n');
  }

  function stamp() {
    return U.formatDate(new Date()).replace(/-/g, '');
  }

  /* =========================================================
   * 主题 / 登录 / 路由
   * ======================================================= */
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function syncThemeUI() {
    var theme = currentTheme();
    var toggle = $('themeToggleBtn');
    if (toggle) {
      var use = toggle.querySelector('use');
      if (use) use.setAttribute('href', theme === 'dark' ? '#i-sun' : '#i-moon');
      toggle.setAttribute('aria-label', theme === 'dark' ? '切换为浅色主题' : '切换为深色主题');
      toggle.setAttribute('title', theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
    }
    document.querySelectorAll('.theme-option').forEach(function (btn) {
      var active = btn.getAttribute('data-theme-choice') === theme;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#07111f' : '#07172b');
  }

  function setTheme(theme, persist) {
    var next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    if (persist !== false) Data.writeLocal(THEME_KEY, next);
    syncThemeUI();
    if (session) window.setTimeout(redrawCurrentCharts, 30);
  }

  function toggleTheme() {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  }

  function readSession() {
    var raw = Data.readLocal(SESSION_KEY);
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.username === 'admin') return parsed;
    } catch (err) {
      return null;
    }
    return null;
  }

  function viewFromHash() {
    var match = String(location.hash || '').match(/^#\/([a-z]+)/);
    if (match && PAGE_META[match[1]]) return match[1];
    return null;
  }

  function navigateTo(view) {
    if (!currentSessionSafe()) return;
    closePopovers();
    if (!PAGE_META[view]) return;
    closeModal();
    closeCommand();
    var target = '#/' + view;
    if (location.hash === target) {
      state.view = view;
      state.expandedOrder = null;
      renderCurrentView();
      window.scrollTo(0, 0);
    } else {
      location.hash = target;
    }
  }

  function currentSessionSafe() {
    return Boolean(session);
  }

  function renderShellChrome() {
    if (!session) return;
    var meta = PAGE_META[state.view] || PAGE_META.dashboard;
    document.title = meta.label + ' · 智汇 ERP';
    var context = $('topbarContextLabel');
    if (context) context.textContent = meta.label;
    var mobilePage = $('mobilePageName');
    if (mobilePage) mobilePage.textContent = meta.label;
    var topbarDate = $('topbarDate');
    if (topbarDate) {
      var now = new Date();
      topbarDate.textContent = now.getFullYear() + '.' + U.pad(now.getMonth() + 1) + '.' + U.pad(now.getDate());
    }
    document.querySelectorAll('.nav-item').forEach(function (item) {
      var active = item.getAttribute('data-view') === state.view;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    var companyName = db.company && db.company.name ? db.company.name : '深圳智汇智能制造有限公司';
    var sidebarCompany = $('sidebarCompanyName');
    if (sidebarCompany) sidebarCompany.textContent = companyName;
    updateBadges();
    renderNotifications();
    syncThemeUI();
  }

  function updateBadges() {
    var orderBadge = $('ordersNavBadge');
    var stockBadge = $('stockNavBadge');
    var productionBadge = $('productionNavBadge');
    var devicesBadge = $('devicesNavBadge');
    var shipCount = pendingShipments().length;
    var stockCount = lowStockProducts().length;
    var affectedCount = affectedWorkOrders().length;
    var faultCount = (db.devices || []).filter(function (device) { return device.status === '故障'; }).length;
    if (orderBadge) {
      orderBadge.textContent = String(shipCount);
      orderBadge.hidden = shipCount === 0;
    }
    if (stockBadge) {
      stockBadge.textContent = String(stockCount);
      stockBadge.hidden = stockCount === 0;
    }
    if (productionBadge) {
      productionBadge.textContent = String(affectedCount);
      productionBadge.hidden = affectedCount === 0;
      productionBadge.title = affectedCount ? affectedCount + ' 张工单受设备故障影响' : '';
    }
    if (devicesBadge) {
      devicesBadge.textContent = String(faultCount);
      devicesBadge.hidden = faultCount === 0;
      devicesBadge.title = faultCount ? faultCount + ' 台设备故障' : '';
    }
    var notifToggle = $('notificationToggle');
    if (notifToggle) notifToggle.classList.toggle('has-dot', !state.notificationsRead);
  }

  function renderViewWithoutScroll() {
    var scrollY = window.scrollY;
    renderCurrentView();
    window.scrollTo(0, scrollY);
  }

  /** 根据当前路由渲染页面，并在布局完成后绘制该页面图表 */
  function renderCurrentView() {
    if (!session) return;
    var renderer = {
      dashboard: renderDashboard,
      production: renderProduction,
      devices: renderDevices,
      employees: renderEmployees,
      customers: renderCustomers,
      orders: renderOrders,
      inventory: renderInventory,
      reports: renderReports,
      settings: renderSettings
    }[state.view] || renderDashboard;
    var root = $('viewRoot');
    if (!root) return;
    root.innerHTML = renderer();
    renderShellChrome();
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(drawCurrentCharts);
    });
  }

  function showApp() {
    $('loginScreen').hidden = true;
    $('appShell').hidden = false;
    var initialView = viewFromHash() || 'dashboard';
    if (location.hash !== '#/' + initialView) {
      history.replaceState(null, '', '#/' + initialView);
    }
    state.view = initialView;
    renderCurrentView();
    window.scrollTo(0, 0);
  }

  function showLogin() {
    $('appShell').hidden = true;
    $('loginScreen').hidden = false;
    document.title = '登录 · 智汇 ERP';
    closeCommand();
    closeModal();
    closePopovers();
    resetLoginButton();
    window.setTimeout(function () {
      var input = $('loginUser');
      if (input) input.focus();
    }, 80);
  }

  function resetLoginButton() {
    var btn = $('loginBtn');
    if (!btn) return;
    btn.disabled = false;
    var label = btn.querySelector('.login-btn-label');
    if (label) label.textContent = '进入工作台';
  }

  function loginError(message) {
    var box = $('loginError');
    var text = $('loginErrorText');
    if (!box) return;
    if (text) text.textContent = message;
    box.hidden = false;
    box.style.animation = 'none';
    // 触发一次重排，让错误提示的抖动动画可以重复播放
    void box.offsetWidth;
    box.style.animation = '';
  }

  function hideLoginError() {
    var box = $('loginError');
    if (box) box.hidden = true;
    var user = $('loginUser');
    var pass = $('loginPass');
    if (user) user.removeAttribute('aria-invalid');
    if (pass) pass.removeAttribute('aria-invalid');
  }

  function handleLogin(event) {
    event.preventDefault();
    hideLoginError();
    var user = $('loginUser').value.trim();
    var pass = $('loginPass').value;
    if (!user || !pass) {
      loginError('请输入账号与密码后再登录。');
      return;
    }
    if (user !== 'admin' || pass !== '123456') {
      loginError('账号或密码不正确。演示账号为 admin / 123456。');
      $('loginUser').setAttribute('aria-invalid', 'true');
      $('loginPass').setAttribute('aria-invalid', 'true');
      return;
    }
    var btn = $('loginBtn');
    btn.disabled = true;
    var label = btn.querySelector('.login-btn-label');
    if (label) label.textContent = '正在进入…';
    window.setTimeout(function () {
      session = {
        username: 'admin',
        name: '王敏',
        role: '运营总监',
        loginAt: new Date().toISOString()
      };
      Data.writeLocal(SESSION_KEY, JSON.stringify(session));
      showApp();
    }, 460);
  }

  function logout() {
    session = null;
    Data.removeLocal(SESSION_KEY);
    closePopovers();
    closeCommand();
    closeModal();
    history.replaceState(null, '', location.href.split('#')[0]);
    showLogin();
    showToast('已安全退出', '期待下次再见。', 'info');
  }

  function handleRoute() {
    if (!session) return;
    var view = viewFromHash();
    if (!view) {
      history.replaceState(null, '', '#/dashboard');
      view = 'dashboard';
    }
    state.view = view;
    state.expandedOrder = null;
    closePopovers();
    closeModal();
    closeCommand();
    renderCurrentView();
    window.scrollTo(0, 0);
  }

  /* =========================================================
   * 工作台
   * ======================================================= */
  function orderStatusCounts() {
    var counts = { '待付款': 0, '待发货': 0, '已完成': 0, '已取消': 0 };
    db.orders.forEach(function (order) {
      if (counts[order.status] != null) counts[order.status] += 1;
    });
    return counts;
  }

  function renderKpiCard(config) {
    return '<article class="kpi-card' + (config.featured ? ' kpi-card--featured' : '') + '"' +
      (config.rgb ? ' style="--kpi-rgb:' + config.rgb + '"' : '') + '>' +
      '<span class="kpi-index">' + config.index + '</span>' +
      '<div class="kpi-head"><span class="kpi-label">' + e(config.label) + '</span>' +
      '<span class="kpi-icon">' + icon(config.icon) + '</span></div>' +
      '<div class="kpi-value">' + config.value + '</div>' +
      '<div class="kpi-foot">' + config.foot + (config.spark || '') + '</div>' +
      '</article>';
  }

  /** 工作台：从订单、库存、客户和待办中实时汇总经营指标 */
  function renderDashboard() {
    var months = U.recentMonths(6);
    var salesValues = months.map(function (month) { return salesForMonth(month.key); });
    var active = activeOrders();
    var currentKey = currentMonth();
    var prevKey = months.length > 1 ? months[months.length - 2].key : currentKey;
    var monthlyOrders = active.filter(function (order) { return order.monthKey === currentKey; });
    var previousMonthlyOrders = active.filter(function (order) { return order.monthKey === prevKey; });
    var currentSales = salesValues[salesValues.length - 1] || 0;
    var prevSales = salesValues[salesValues.length - 2] || 0;
    var salesGrowth = prevSales > 0 ? ((currentSales - prevSales) / prevSales) * 100 : null;
    var orderDiff = monthlyOrders.length - previousMonthlyOrders.length;
    var aCustomers = db.customers.filter(function (c) { return c.level === 'A'; }).length;
    var warningProducts = lowStockProducts();
    var todos = db.todos;
    var todoDone = todos.filter(function (todo) { return todo.done; }).length;
    var todoPercent = todos.length ? Math.round((todoDone / todos.length) * 100) : 0;
    var outstanding = todos.length - todoDone;
    var announcements = db.announcements.slice().sort(function (a, b) {
      return (Number(b.pinned) - Number(a.pinned)) || (new Date(b.date) - new Date(a.date));
    });
    var statusCounts = orderStatusCounts();
    var allOrderCount = db.orders.length;
    var chartTotal = salesValues.reduce(function (sum, value) { return sum + value; }, 0);
    var chartGrowth = salesValues[0] > 0 ? ((salesValues[salesValues.length - 1] - salesValues[0]) / salesValues[0]) * 100 : null;
    var salesTrendClass = salesGrowth == null ? 'kpi-compare--neutral' : (salesGrowth >= 0 ? '' : 'kpi-compare--down');
    var orderTrendClass = orderDiff >= 0 ? '' : 'kpi-compare--down';
    var salesFoot = '<span class="kpi-compare ' + salesTrendClass + '">' +
      icon(salesGrowth != null && salesGrowth < 0 ? 'trend-down' : 'trend-up') +
      (salesGrowth == null ? '暂无环比' : (salesGrowth >= 0 ? '+' : '') + U.formatPercent(salesGrowth, 1)) +
      '<span class="kpi-compare__label">环比</span></span>';
    var orderFoot = '<span class="kpi-compare ' + orderTrendClass + '">' +
      icon(orderDiff >= 0 ? 'trend-up' : 'trend-down') +
      (orderDiff >= 0 ? '+' : '') + orderDiff +
      '<span class="kpi-compare__label">笔较上月</span></span>';
    var customerFoot = '<span class="kpi-compare kpi-compare--neutral">' + icon('shield') + aCustomers + ' 家 A 级客户</span>';
    var stockFoot = '<span class="kpi-compare kpi-compare--down">' + icon('alert-triangle') + warningProducts.length +
      '<span class="kpi-compare__label">个 SKU 需补货</span></span>';

    var kpis = '<section class="kpi-grid" aria-label="核心经营指标">' +
      renderKpiCard({
        index: '01', featured: true, label: '本月销售额', icon: 'wallet',
        value: '<span class="kpi-value__currency">¥</span>' + U.formatNumber(currentSales),
        foot: salesFoot,
        spark: sparkline(salesValues, 'var(--accent)')
      }) +
      renderKpiCard({
        index: '02', label: '本月订单数', icon: 'receipt', rgb: '47, 99, 232',
        value: U.formatNumber(monthlyOrders.length) + '<span class="kpi-value__unit">笔</span>',
        foot: orderFoot,
        spark: sparkline(months.map(function (month) {
          return active.filter(function (order) { return order.monthKey === month.key; }).length;
        }).concat([monthlyOrders.length]), 'var(--primary)')
      }) +
      renderKpiCard({
        index: '03', label: '客户总数', icon: 'users', rgb: '13, 148, 136',
        value: U.formatNumber(db.customers.length) + '<span class="kpi-value__unit">家</span>',
        foot: customerFoot,
        spark: sparkline([8, 8, 9, 10, 11, db.customers.length], 'var(--accent)')
      }) +
      renderKpiCard({
        index: '04', label: '库存预警数', icon: 'alert-triangle', rgb: '217, 78, 78',
        value: U.formatNumber(warningProducts.length) + '<span class="kpi-value__unit">项</span>',
        foot: stockFoot,
        spark: sparkline([2, 3, 2, 5, 4, warningProducts.length], 'var(--danger)')
      }) +
      '</section>';

    var chartPanel = '<section class="panel sales-panel dash-span-8">' +
      '<div class="sales-panel__head">' +
      '<div><div class="panel__kicker">REVENUE / 6 MONTHS</div><div class="panel__title">近 6 个月销售趋势</div>' +
      '<div class="sales-headline"><span class="sales-headline__value">' + U.formatMoney(chartTotal) + '</span>' +
      '<span class="sales-headline__label">累计销售额</span>' +
      (chartGrowth == null ? '' : '<span class="badge badge--' + (chartGrowth >= 0 ? 'success' : 'danger') + '">' +
        (chartGrowth >= 0 ? '+' : '') + U.formatPercent(chartGrowth, 1) + ' 较期初</span>') +
      '</div></div>' +
      '<div class="panel__tools"><span class="range-chip">' + icon('calendar') + '近 6 个月</span></div>' +
      '</div>' +
      '<div class="chart-area"><div class="chart-canvas-wrap"><canvas id="salesTrendChart" role="img" aria-label="近 6 个月销售趋势折线图"></canvas></div></div>' +
      '<div class="panel-chart-footer"><div class="chart-legend"><span class="chart-legend__item"><span class="chart-legend__dot"></span>实际销售额</span>' +
      '<span class="chart-legend__item">单位：人民币</span></div>' +
      '<span class="sales-footnote">' + icon('check-circle') + '已排除已取消订单</span></div>' +
      '</section>';

    var donutLegend = ORDER_STATUSES.map(function (status) {
      var percent = allOrderCount ? (statusCounts[status] / allOrderCount) * 100 : 0;
      return '<div class="donut-legend__item"><span class="donut-legend__dot" style="background:' + ORDER_STATUS_META[status].color + '"></span>' +
        '<span class="donut-legend__label">' + e(status) + '</span>' +
        '<span class="donut-legend__value">' + statusCounts[status] + '<span class="donut-legend__percent">' + percent.toFixed(0) + '%</span></span></div>';
    }).join('');

    var donutPanel = '<section class="panel donut-panel dash-span-4">' +
      '<div class="panel__head"><div><div class="panel__kicker">ORDER MIX / ALL</div><div class="panel__title">订单状态分布</div>' +
      '<div class="panel__sub">全部订单的履约结构</div></div>' +
      '<div class="panel__tools"><button class="panel__action" type="button" data-action="go-orders">查看订单' + icon('arrow-right') + '</button></div></div>' +
      '<div class="donut-area"><div class="chart-canvas-wrap"><canvas id="orderDonutChart" role="img" aria-label="全部订单状态分布环形图"></canvas></div></div>' +
      '<div class="donut-legend">' + donutLegend + '</div>' +
      '</section>';

    var todoRows = todos.map(function (todo) {
      var priority = PRIORITIES[todo.priority] || PRIORITIES.medium;
      return '<div class="todo-item' + (todo.done ? ' is-done' : '') + '" data-todo-row="' + e(todo.id) + '">' +
        '<button class="todo-check" type="button" data-action="toggle-todo" data-id="' + e(todo.id) + '" aria-label="' +
        (todo.done ? '标记为未完成：' : '标记为已完成：') + e(todo.title) + '" aria-pressed="' + (todo.done ? 'true' : 'false') + '">' +
        icon('check') + '</button>' +
        '<div class="todo-item__main"><div class="todo-title">' + e(todo.title) + '</div>' +
        '<div class="todo-meta"><span class="todo-dept">' + e(todo.dept) + '</span>' +
        '<span class="todo-priority todo-priority--' + priority.cls + '">' + priority.label + '</span></div></div>' +
        '<span class="todo-due">' + e(todo.due) + '</span></div>';
    }).join('');
    if (!todos.length) {
      todoRows = '<div class="empty-state" style="min-height:180px;padding:24px;"><div class="empty-state__icon">' + icon('check-circle') + '</div><h3>暂无待办</h3><p>今天的经营动作已经全部完成。</p></div>';
    }

    var todoPanel = '<section class="panel todo-panel dash-span-7">' +
      '<div class="panel__head"><div><div class="panel__kicker">TODAY / FOCUS</div><div class="panel__title">待办事项</div>' +
      '<div class="panel__sub">优先处理影响成交与履约的事项</div></div>' +
      '<div class="todo-panel__progress"><div class="todo-progress"><span class="todo-progress__bar" id="todoProgressBar" style="width:' + todoPercent + '%"></span></div>' +
      '<span class="todo-progress__text" id="todoProgressText">' + todoDone + '/' + todos.length + ' 完成</span></div></div>' +
      '<div class="todo-list" id="todoList">' + todoRows + '</div>' +
      '<div class="panel-footer-link" style="cursor:default;">' + icon('info') + '还有 <span id="todoRemainCount" style="color:var(--text);font-weight:600;">' + outstanding + '</span> 项未完成 · 数据自动保存在本机</div>' +
      '</section>';

    var noticeRows = announcements.map(function (notice) {
      return '<button class="notice-item" type="button" data-action="open-notice" data-id="' + e(notice.id) + '">' +
        (notice.pinned ? '<span class="notice-pin" title="置顶公告">' + icon('pin') + '</span>' : '') +
        '<span class="notice-item__body"><span class="notice-title">' + e(notice.title) + '</span>' +
        '<span class="notice-meta"><span class="notice-cat">' + e(notice.category) + '</span>' +
        '<span class="notice-date">' + U.formatDate(notice.date).slice(5) + '</span></span></span>' +
        '<span class="notice-arrow">' + icon('chevron-right') + '</span>' +
        '</button>';
    }).join('');
    var noticePanel = '<section class="panel notice-panel dash-span-5">' +
      '<div class="panel__head"><div><div class="panel__kicker">BULLETIN / INTERNAL</div><div class="panel__title">公司公告</div>' +
      '<div class="panel__sub">生产、品质与行政最新动态</div></div>' +
      '<div class="panel__tools"><span class="range-chip">' + icon('file-text') + announcements.length + ' 条</span></div></div>' +
      '<div class="notice-list">' + noticeRows + '</div>' +
      '<button class="panel-footer-link" type="button" data-action="all-notices">查看全部公告' + icon('arrow-right') + '</button>' +
      '</section>';

    /* ---- 生产与设备摘要：与生产页/设备页共用 db 数据源 ---- */
    var prod = productionStats();
    var deviceInfo = deviceStats();
    var liveOrders = prod.producingList.slice().sort(workOrderSort).slice(0, 4);
    var liveRows = liveOrders.map(function (order) {
      var pct = workOrderProgress(order);
      var affected = workOrderAffected(order);
      return '<div class="mes-live-item' + (affected ? ' is-affected' : '') + '">' +
        '<div class="mes-live-item__main">' +
        '<div class="mes-live-item__top"><span class="mes-live-item__name">' + e(order.productName) + '</span>' +
        (affected ? '<span class="wo-affected-tag">受影响</span>' : '<span class="mes-live-item__pct">' + pct.toFixed(0) + '%</span>') + '</div>' +
        '<div class="mes-live-item__meta">' + e(order.id) + ' · ' + e(lineCode(order.lineId)) + ' · 交期 ' + e(U.formatDate(order.dueDate).slice(5)) + '</div>' +
        '<div class="mes-live-item__progress"><i style="width:' + Math.max(2, pct).toFixed(1) + '%"></i></div>' +
        '</div></div>';
    }).join('');
    if (!liveOrders.length) {
      liveRows = '<div class="empty-state" style="min-height:150px;padding:20px;"><div class="empty-state__icon">' + icon('factory') + '</div><h3>当前无在产工单</h3><p>可在生产管理中新建工单并绑定产线与设备。</p></div>';
    }
    var productionSummary = '<section class="panel mes-panel dash-span-7">' +
      '<div class="panel__head"><div><div class="panel__kicker">MES / LIVE</div><div class="panel__title">在产工单进度</div>' +
      '<div class="panel__sub">' + (prod.affected ? '<strong style="color:var(--danger);">' + prod.affected + ' 张工单</strong> 受设备故障影响' : '设备状态正常 · 报工数据实时汇总') + '</div></div>' +
      '<div class="panel__tools"><button class="panel__action" type="button" data-action="go-production">查看生产' + icon('arrow-right') + '</button></div></div>' +
      '<div class="mes-live-list">' + liveRows + '</div>' +
      '<button class="panel-footer-link" type="button" data-action="go-production">' + icon('factory') + '进入生产管理 · 新建工单 / 报工 / 工序追踪' + icon('arrow-right') + '</button>' +
      '</section>';

    var deviceLegend = DEVICE_STATUSES.map(function (status) {
      var meta = DEVICE_STATUS_META[status];
      return '<div class="donut-legend__item"><span class="donut-legend__dot" style="background:' + meta.color + '"></span>' +
        '<span class="donut-legend__label">' + e(status) + '</span>' +
        '<span class="donut-legend__value">' + deviceInfo.counts[status] + '</span></div>';
    }).join('');
    var deviceSummary = '<section class="panel donut-panel dash-span-5">' +
      '<div class="panel__head"><div><div class="panel__kicker">EQUIPMENT / STATUS</div><div class="panel__title">设备状态分布</div>' +
      '<div class="panel__sub">3 条产线 · 平均 OEE <strong>' + deviceInfo.avgOee.toFixed(1) + '%</strong></div></div>' +
      '<div class="panel__tools"><button class="panel__action" type="button" data-action="go-devices">设备台账' + icon('arrow-right') + '</button></div></div>' +
      '<div class="donut-area"><div class="chart-canvas-wrap"><canvas id="deviceStatusDonut" role="img" aria-label="设备状态分布环形图"></canvas></div></div>' +
      '<div class="donut-legend">' + deviceLegend + '</div>' +
      '</section>';

    return '<div class="page">' +
      pageHead(PAGE_META.dashboard.eyebrow, greeting() + '，王敏',
        '今天有 <strong>' + outstanding + '</strong> 项待办 · 在产工单 <strong>' + prod.active + '</strong> 张' +
        (prod.affected ? '（<strong style="color:var(--danger);">' + prod.affected + '</strong> 张受设备故障影响）' : '') +
        ' · 设备故障 <strong style="color:var(--danger);">' + deviceInfo.fault + '</strong> 台。',
        '<span class="welcome-date">' + icon('calendar') + chineseDate() + '</span>' +
        '<button class="btn btn--ghost" type="button" data-action="export-dashboard" title="导出经营简报">' +
        icon('download') + '<span class="btn-label">导出简报</span></button>' +
        '<button class="btn btn--primary" type="button" data-action="go-production">' + icon('factory') + '生产看板' + icon('arrow-right') + '</button>') +
      kpis +
      '<div class="dash-grid">' + chartPanel + donutPanel + '</div>' +
      '<div class="dash-grid dashboard-lower">' + productionSummary + deviceSummary + '</div>' +
      '<div class="dash-grid dashboard-lower">' + todoPanel + noticePanel + '</div>' +
      '</div>';
  }

  /* =========================================================
   * 员工管理
   * ======================================================= */
  /** 按关键词与部门筛选员工，并对结果分页 */
  function filteredEmployees() {
    var query = state.employeeQuery.trim().toLowerCase();
    return db.employees.filter(function (employee) {
      var matchesQuery = !query || [employee.id, employee.name, employee.dept, employee.title, employee.email, employee.phone]
        .some(function (value) { return String(value).toLowerCase().indexOf(query) !== -1; });
      var matchesDept = !state.employeeDept || employee.dept === state.employeeDept;
      return matchesQuery && matchesDept;
    });
  }

  function employeePageData() {
    var rows = filteredEmployees();
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.employeePage = Math.min(Math.max(1, state.employeePage), pages);
    var start = (state.employeePage - 1) * PAGE_SIZE;
    return {
      rows: rows.slice(start, start + PAGE_SIZE),
      total: total,
      pages: pages,
      page: state.employeePage,
      start: total ? start + 1 : 0,
      end: Math.min(start + PAGE_SIZE, total)
    };
  }

  function employeeRowsHTML(data) {
    if (!data.rows.length) {
      return tableEmpty(7, '没有找到匹配的员工', '试试更换关键词，或清除部门筛选条件。',
        '<button class="btn btn--soft" type="button" data-action="add-employee">' + icon('plus') + '新增员工</button>');
    }
    return data.rows.map(function (employee) {
      var roleMeta = EMPLOYEE_STATUS[employee.status] || 'neutral';
      return '<tr>' +
        '<td><span class="id-tag">' + e(employee.id) + '</span></td>' +
        '<td><div class="cell-person">' + avatar(employee.name, employee.id) +
        '<div class="cell-person__body"><div class="cell-person__name">' + e(employee.name) + '</div>' +
        '<div class="cell-person__meta">' + e(employee.email) + '</div></div></div></td>' +
        '<td><div class="cell-primary">' + e(employee.dept) + '</div></td>' +
        '<td><div class="cell-primary" style="font-weight:500;">' + e(employee.title) + '</div>' +
        '<div class="cell-sub">' + e(employee.phone) + '</div></td>' +
        '<td><span class="cell-mono">' + e(U.formatDate(employee.joinedAt)) + '</span></td>' +
        '<td><span class="badge badge--' + roleMeta + '">' + e(employee.status) + '</span></td>' +
        '<td><div class="row-actions">' +
        '<button class="row-action" type="button" data-action="edit-employee" data-id="' + e(employee.id) + '" title="编辑员工" aria-label="编辑 ' + e(employee.name) + '">' + icon('edit') + '</button>' +
        '<button class="row-action row-action--danger" type="button" data-action="delete-employee" data-id="' + e(employee.id) + '" title="删除员工" aria-label="删除 ' + e(employee.name) + '">' + icon('trash') + '</button>' +
        '</div></td></tr>';
    }).join('');
  }

  function employeeFooterHTML(data) {
    return '<div class="table-footer">' +
      '<span class="table-footer__info">' + (data.total ? '显示 <strong>' + data.start + '–' + data.end + '</strong> 条，共 <strong>' + data.total + '</strong> 位员工' : '暂无匹配结果') + '</span>' +
      pagination(data.page, data.pages, 'employee-page', data.total) +
      '</div>';
  }

  function renderEmployees() {
    var data = employeePageData();
    var salesCount = db.employees.filter(function (item) { return item.dept === '销售部'; }).length;
    return '<div class="page">' +
      pageHead(PAGE_META.employees.eyebrow, '员工管理',
        '组织架构覆盖 <strong>' + Data.DEPARTMENTS.length + '</strong> 个部门 · 在册员工 <strong>' + db.employees.length + '</strong> 人 · 销售团队 <strong>' + salesCount + '</strong> 人',
        '<button class="btn btn--ghost" type="button" data-action="export-employees">' + icon('download') + '<span class="btn-label">导出名册</span></button>' +
        '<button class="btn btn--primary" type="button" data-action="add-employee">' + icon('plus') + '新增员工</button>') +
      '<section class="panel panel--flush">' +
      '<div class="toolbar">' + searchField(state.employeeQuery, '搜索姓名、工号或职位…', 'employees', 'clear-employee-search') +
      filterSelect('employee-dept', state.employeeDept, '全部部门', Data.DEPARTMENTS, '按部门筛选') +
      '<button class="icon-reset" type="button" data-action="reset-employee-filters">' + icon('refresh', 'icon--xs') + '重置</button>' +
      '<span class="toolbar__meta">筛选结果 <strong id="employeeResultCount">' + data.total + '</strong> 人</span>' +
      '</div>' +
      '<div class="table-scroll"><table class="data-table data-table--employees">' +
      '<thead><tr><th>工号</th><th>姓名 / 联系方式</th><th>部门</th><th>职位 / 电话</th><th>入职日期</th><th>状态</th><th>操作</th></tr></thead>' +
      '<tbody id="employeeTableBody">' + employeeRowsHTML(data) + '</tbody></table></div>' +
      '<div id="employeeTableFooter">' + employeeFooterHTML(data) + '</div>' +
      '</section></div>';
  }

  function refreshEmployeeResults() {
    var body = $('employeeTableBody');
    if (!body) return;
    var data = employeePageData();
    body.innerHTML = employeeRowsHTML(data);
    var footer = $('employeeTableFooter');
    if (footer) footer.innerHTML = employeeFooterHTML(data);
    var count = $('employeeResultCount');
    if (count) count.textContent = String(data.total);
  }

  function employeeDialog(id) {
    var employee = id ? db.employees.find(function (item) { return item.id === id; }) : null;
    var nextId = employeeNextId();
    var isEdit = Boolean(employee);
    var title = isEdit ? '编辑员工资料' : '新增员工';
    var sub = isEdit ? '正在编辑 ' + employee.name + '（' + employee.id + '）的档案信息。' : '新工号将自动分配，保存后即可在员工列表与报表负责人中使用。';
    var body = '<form id="employeeForm" class="form-grid" novalidate>' +
      '<div class="field"><label for="empName">姓名 <span style="color:var(--danger)">*</span></label>' +
      '<input class="input" id="empName" name="name" value="' + e(employee ? employee.name : '') + '" placeholder="请输入员工姓名" maxlength="20" required data-autofocus></div>' +
      '<div class="field"><label for="empDept">所属部门 <span style="color:var(--danger)">*</span></label>' +
      '<span class="select-wrap select-wrap--block"><select class="select" id="empDept" name="dept" required>' + optionTags(Data.DEPARTMENTS, employee ? employee.dept : '运营部') + '</select></span></div>' +
      '<div class="field"><label for="empTitle">职位 <span style="color:var(--danger)">*</span></label>' +
      '<input class="input" id="empTitle" name="title" value="' + e(employee ? employee.title : '') + '" placeholder="如：运营专员" maxlength="24" required></div>' +
      '<div class="field"><label for="empJoined">入职日期 <span style="color:var(--danger)">*</span></label>' +
      '<input class="input" id="empJoined" name="joinedAt" type="date" value="' + e(employee ? employee.joinedAt : U.formatDate(new Date())) + '" required></div>' +
      '<div class="field"><label for="empStatus">员工状态 <span style="color:var(--danger)">*</span></label>' +
      '<span class="select-wrap select-wrap--block"><select class="select" id="empStatus" name="status" required>' + optionTags(['在职', '试用期', '休假'], employee ? employee.status : '在职') + '</select></span></div>' +
      '<div class="field"><label for="empPhone">手机号 <span style="color:var(--danger)">*</span></label>' +
      '<input class="input" id="empPhone" name="phone" type="tel" value="' + e(employee ? employee.phone : '') + '" placeholder="11 位手机号" maxlength="20" required></div>' +
      '<div class="field field--full"><label for="empEmail">工作邮箱 <span style="color:var(--danger)">*</span></label>' +
      '<input class="input" id="empEmail" name="email" type="email" value="' + e(employee ? employee.email : '') + '" placeholder="name@zhihui-erp.cn" required>' +
      '<span class="form-help">工号：' + e(isEdit ? employee.id : nextId + '（保存后生成）') + ' · 员工数据保存在本机演示数据库</span></div>' +
      '</form>';
    var footer = '<span class="modal__foot-hint">' + icon('shield') + '本地数据 · 不会上传</span>' +
      '<button class="btn btn--ghost" type="button" data-modal-close>取消</button>' +
      '<button class="btn btn--primary" type="submit" form="employeeForm">保存员工</button>';
    openDialog({
      kicker: 'PEOPLE / ' + (isEdit ? 'EDIT' : 'NEW'),
      title: title,
      sub: sub,
      body: body,
      footer: footer,
      onMount: function (overlay, close) {
        var form = overlay.querySelector('#employeeForm');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          if (!form.reportValidity()) return;
          var fd = new FormData(form);
          var record = {
            name: String(fd.get('name') || '').trim(),
            dept: String(fd.get('dept') || '').trim(),
            title: String(fd.get('title') || '').trim(),
            joinedAt: String(fd.get('joinedAt') || ''),
            status: String(fd.get('status') || '在职'),
            phone: String(fd.get('phone') || '').trim(),
            email: String(fd.get('email') || '').trim()
          };
          if (employee) {
            Object.assign(employee, record);
          } else {
            record.id = employeeNextId();
            db.employees.push(record);
            state.employeeQuery = '';
            state.employeeDept = '';
            state.employeePage = 1;
          }
          if (!saveDatabase()) return;
          close();
          renderViewWithoutScroll();
          showToast(employee ? '员工资料已更新' : '员工已新增', record.name + ' · ' + record.dept + ' · ' + record.title, 'success');
        });
      }
    });
  }

  function deleteEmployee(id) {
    var employee = db.employees.find(function (item) { return item.id === id; });
    if (!employee) return;
    openConfirm({
      kicker: 'PEOPLE / DELETE',
      title: '删除员工档案',
      message: '即将删除 <span class="confirm-highlight">' + e(employee.name) + '</span>（' + e(employee.id) + '）的员工档案。',
      note: '删除后该员工将从组织名录中移除，此操作不可撤销。订单与历史经营数据不会受到影响。',
      confirmText: '删除员工',
      onConfirm: function () {
        db.employees = db.employees.filter(function (item) { return item.id !== id; });
        if (!saveDatabase()) return;
        renderViewWithoutScroll();
        showToast('员工已删除', employee.name + ' 已从组织名录中移除。', 'warning');
      }
    });
  }

  /* =========================================================
   * 客户管理
   * ======================================================= */
  function filteredCustomers() {
    var query = state.customerQuery.trim().toLowerCase();
    return db.customers.filter(function (customer) {
      var matchesQuery = !query || [customer.id, customer.name, customer.contact, customer.phone, customer.industry, customer.region, customer.email]
        .some(function (value) { return String(value || '').toLowerCase().indexOf(query) !== -1; });
      var matchesLevel = !state.customerLevel || customer.level === state.customerLevel;
      return matchesQuery && matchesLevel;
    });
  }

  function customerRowsHTML(rows) {
    if (!rows.length) {
      return tableEmpty(8, '未找到匹配的客户', '换个关键词试试，或新增一位客户开始记录合作。',
        '<button class="btn btn--soft" type="button" data-action="add-customer">' + icon('plus') + '新增客户</button>');
    }
    return rows.map(function (customer) {
      return '<tr>' +
        '<td><div class="cell-person">' + avatar(customer.name, customer.id, 'avatar--company') +
        '<div class="cell-person__body"><div class="cell-person__name">' + e(customer.name) + '</div>' +
        '<div class="cell-person__meta">' + e(customer.id) + '</div></div></div></td>' +
        '<td>' + levelBadge(customer.level) + '</td>' +
        '<td><div class="cell-primary" style="font-weight:500;">' + e(customer.industry) + '</div><div class="cell-sub">' + e(customer.region) + '</div></td>' +
        '<td><div class="cell-primary" style="font-weight:500;">' + e(customer.contact) + '</div><div class="cell-sub">' + e(customer.email) + '</div></td>' +
        '<td><span class="cell-mono">' + e(customer.phone) + '</span></td>' +
        '<td><span class="cell-money">' + U.formatMoney(customer.totalSpend) + '</span><div class="cell-sub">' + customer.ordersCount + ' 笔历史订单</div></td>' +
        '<td><span class="badge badge--' + (CUSTOMER_STATUS[customer.status] || 'neutral') + '">' + e(customer.status) + '</span></td>' +
        '<td><div class="row-actions">' +
        '<button class="row-action" type="button" data-action="edit-customer" data-id="' + e(customer.id) + '" title="编辑客户" aria-label="编辑 ' + e(customer.name) + '">' + icon('edit') + '</button>' +
        '<button class="row-action row-action--danger" type="button" data-action="delete-customer" data-id="' + e(customer.id) + '" title="删除客户" aria-label="删除 ' + e(customer.name) + '">' + icon('trash') + '</button>' +
        '</div></td></tr>';
    }).join('');
  }

  function renderCustomers() {
    var rows = filteredCustomers();
    var totalSpend = sumBy(db.customers, function (item) { return item.totalSpend; });
    var aCount = db.customers.filter(function (item) { return item.level === 'A'; }).length;
    return '<div class="page">' +
      pageHead(PAGE_META.customers.eyebrow, '客户管理',
        '客户资产 <strong>' + db.customers.length + '</strong> 家 · A 级客户 <strong>' + aCount + '</strong> 家 · 累计交易额 <strong>' + U.formatMoney(totalSpend) + '</strong>',
        '<button class="btn btn--ghost" type="button" data-action="export-customers">' + icon('download') + '<span class="btn-label">导出客户</span></button>' +
        '<button class="btn btn--primary" type="button" data-action="add-customer">' + icon('plus') + '新增客户</button>') +
      '<section class="panel panel--flush">' +
      '<div class="toolbar">' + searchField(state.customerQuery, '搜索客户、联系人或行业…', 'customers', 'clear-customer-search') +
      filterSelect('customer-level', state.customerLevel, '全部等级', ['A', 'B', 'C'], '按客户等级筛选') +
      '<button class="icon-reset" type="button" data-action="reset-customer-filters">' + icon('refresh', 'icon--xs') + '重置</button>' +
      '<span class="toolbar__meta">筛选结果 <strong id="customerResultCount">' + rows.length + '</strong> 家</span>' +
      '</div>' +
      '<div class="table-scroll"><table class="data-table data-table--customers">' +
      '<thead><tr><th>客户名称</th><th>等级</th><th>行业 / 区域</th><th>联系人</th><th>联系电话</th><th>累计交易额</th><th>状态</th><th>操作</th></tr></thead>' +
      '<tbody id="customerTableBody">' + customerRowsHTML(rows) + '</tbody></table></div>' +
      '<div class="table-footer"><span class="table-footer__info">当前显示 <strong id="customerFooterCount">' + rows.length + '</strong> 家客户 · 点击操作可编辑客户档案</span>' +
      '<span class="table-footer__info">A 级客户贡献 <strong>' + (totalSpend ? Math.round((sumBy(db.customers.filter(function (c) { return c.level === 'A'; }), function (c) { return c.totalSpend; }) / totalSpend) * 100) : 0) + '%</strong> 累计交易额</span></div>' +
      '</section></div>';
  }

  function refreshCustomerResults() {
    var body = $('customerTableBody');
    if (!body) return;
    var rows = filteredCustomers();
    body.innerHTML = customerRowsHTML(rows);
    var count = $('customerResultCount');
    if (count) count.textContent = String(rows.length);
    var footerCount = $('customerFooterCount');
    if (footerCount) footerCount.textContent = String(rows.length);
  }

  function customerDialog(id) {
    var customer = id ? db.customers.find(function (item) { return item.id === id; }) : null;
    var isEdit = Boolean(customer);
    var body = '<form id="customerForm" class="form-grid" novalidate>' +
      '<div class="field field--full"><label for="cusName">客户名称 <span style="color:var(--danger)">*</span></label>' +
      '<input class="input" id="cusName" name="name" value="' + e(customer ? customer.name : '') + '" placeholder="请输入公司全称" maxlength="80" required data-autofocus></div>' +
      '<div class="field"><label for="cusLevel">客户等级</label><span class="select-wrap select-wrap--block">' +
      '<select class="select" id="cusLevel" name="level">' + optionTags(['A', 'B', 'C'], customer ? customer.level : 'B') + '</select></span></div>' +
      '<div class="field"><label for="cusStatus">合作状态</label><span class="select-wrap select-wrap--block">' +
      '<select class="select" id="cusStatus" name="status">' + optionTags(['合作中', '待跟进', '暂停合作'], customer ? customer.status : '待跟进') + '</select></span></div>' +
      '<div class="field"><label for="cusIndustry">所属行业</label><input class="input" id="cusIndustry" name="industry" value="' + e(customer ? customer.industry : '智能硬件') + '" placeholder="如：工业自动化" maxlength="30"></div>' +
      '<div class="field"><label for="cusRegion">所在区域</label><input class="input" id="cusRegion" name="region" value="' + e(customer ? customer.region : '') + '" placeholder="如：华东 · 上海" maxlength="30"></div>' +
      '<div class="field"><label for="cusContact">联系人 <span style="color:var(--danger)">*</span></label>' +
      '<input class="input" id="cusContact" name="contact" value="' + e(customer ? customer.contact : '') + '" placeholder="请输入联系人姓名" maxlength="20" required></div>' +
      '<div class="field"><label for="cusPhone">联系电话 <span style="color:var(--danger)">*</span></label>' +
      '<input class="input" id="cusPhone" name="phone" type="tel" value="' + e(customer ? customer.phone : '') + '" placeholder="手机号或座机" maxlength="24" required></div>' +
      '<div class="field field--full"><label for="cusEmail">联系邮箱</label>' +
      '<input class="input" id="cusEmail" name="email" type="email" value="' + e(customer ? customer.email : '') + '" placeholder="contact@company.cn"></div>' +
      '<div class="field field--full"><label for="cusAddress">通讯地址</label>' +
      '<textarea class="textarea" id="cusAddress" name="address" maxlength="160" placeholder="用于订单配送、合同寄送等场景">' + e(customer ? customer.address : '') + '</textarea></div>' +
      '</form>';
    var footer = '<span class="modal__foot-hint">' + icon('info') + '客户编号：' + e(isEdit ? customer.id : customerNextId() + '（自动生成）') + '</span>' +
      '<button class="btn btn--ghost" type="button" data-modal-close>取消</button>' +
      '<button class="btn btn--primary" type="submit" form="customerForm">保存客户</button>';
    openDialog({
      kicker: 'CUSTOMERS / ' + (isEdit ? 'EDIT' : 'NEW'),
      title: isEdit ? '编辑客户档案' : '新增客户',
      sub: isEdit ? '更新客户等级、联系人或合作状态。' : '建立客户档案后，即可在订单与报表中持续追踪合作。',
      body: body,
      footer: footer,
      size: 'modal--lg',
      onMount: function (overlay, close) {
        var form = overlay.querySelector('#customerForm');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          if (!form.reportValidity()) return;
          var fd = new FormData(form);
          var record = {
            name: String(fd.get('name') || '').trim(),
            level: String(fd.get('level') || 'B'),
            status: String(fd.get('status') || '待跟进'),
            industry: String(fd.get('industry') || '').trim(),
            region: String(fd.get('region') || '').trim(),
            contact: String(fd.get('contact') || '').trim(),
            phone: String(fd.get('phone') || '').trim(),
            email: String(fd.get('email') || '').trim(),
            address: String(fd.get('address') || '').trim()
          };
          if (customer) {
            Object.assign(customer, record);
          } else {
            record.id = customerNextId();
            record.totalSpend = 0;
            record.ordersCount = 0;
            record.joinedAt = U.formatDate(new Date());
            db.customers.push(record);
            state.customerQuery = '';
            state.customerLevel = '';
          }
          if (!saveDatabase()) return;
          close();
          renderViewWithoutScroll();
          showToast(customer ? '客户档案已更新' : '客户已新增', record.name, 'success');
        });
      }
    });
  }

  function deleteCustomer(id) {
    var customer = db.customers.find(function (item) { return item.id === id; });
    if (!customer) return;
    openConfirm({
      kicker: 'CUSTOMERS / DELETE',
      title: '删除客户档案',
      message: '即将删除 <span class="confirm-highlight">' + e(customer.name) + '</span> 的客户档案。',
      note: '历史订单中的客户名称会保留，但客户将不再出现在跟进与筛选列表中。此操作不可撤销。',
      confirmText: '删除客户',
      onConfirm: function () {
        db.customers = db.customers.filter(function (item) { return item.id !== id; });
        if (!saveDatabase()) return;
        renderViewWithoutScroll();
        showToast('客户已删除', customer.name + ' 已移除。', 'warning');
      }
    });
  }

  /* =========================================================
   * 订单管理
   * ======================================================= */
  function filteredOrders() {
    var query = state.orderQuery.trim().toLowerCase();
    return db.orders.filter(function (order) {
      var matchesStatus = state.orderStatus === '全部' || order.status === state.orderStatus;
      var matchesQuery = !query || [order.id, order.customerName, order.dept, order.status, order.date]
        .some(function (value) { return String(value).toLowerCase().indexOf(query) !== -1; });
      return matchesStatus && matchesQuery;
    });
  }

  function orderTabsHTML() {
    var counts = orderStatusCounts();
    return ORDER_TABS.map(function (status) {
      var count = status === '全部' ? db.orders.length : counts[status];
      return '<button class="tab' + (state.orderStatus === status ? ' is-active' : '') + '" type="button" data-action="order-tab" data-status="' + e(status) + '"' +
        (state.orderStatus === status ? ' aria-selected="true"' : ' aria-selected="false"') + '>' + e(status) +
        '<span class="tab__count">' + count + '</span></button>';
    }).join('');
  }

  function orderItemsCount(order) {
    return order.items ? order.items.length : 0;
  }

  function orderFlowHTML(order) {
    if (order.status === '已取消') {
      return '<div class="order-flow order-flow--cancelled"><div class="flow-step is-done"><span class="flow-step__dot"></span><span class="flow-step__label">已提交</span></div>' +
        '<div class="flow-step is-current"><span class="flow-step__dot"></span><span class="flow-step__label">已取消</span></div></div>';
    }
    var labels = ['已提交', '已审核', '已发货', '已完成'];
    var current = order.status === '待付款' ? 1 : order.status === '待发货' ? 2 : 3;
    return '<div class="order-flow">' + labels.map(function (label, index) {
      var cls = order.status === '已完成' || index < current ? ' is-done' : index === current ? ' is-current' : '';
      if (order.status === '已完成') cls = ' is-done';
      return '<div class="flow-step' + cls + '"><span class="flow-step__dot"></span><span class="flow-step__label">' + label + '</span></div>';
    }).join('') + '</div>';
  }

  function orderDetailHTML(order) {
    var itemRows = (order.items || []).map(function (item) {
      return '<tr><td><span class="mini-name">' + e(item.name) + (item.service ? '<span class="mini-service">服务</span>' : '') + '</span>' +
        '<span class="mini-sku">' + e(item.sku) + ' · ' + e(item.spec) + '</span></td>' +
        '<td>' + item.qty + ' ' + e(item.unit) + '</td>' +
        '<td>' + U.formatMoney(item.unitPrice, 2) + '</td>' +
        '<td>' + U.formatMoney(item.subtotal, 2) + '</td></tr>';
    }).join('');
    return '<div class="order-detail">' +
      '<div class="order-detail__main">' +
      '<div class="detail-section-label">商品与服务明细 <span>' + orderItemsCount(order) + ' 项 / ' + U.formatDate(order.date) + '</span></div>' +
      '<table class="mini-table"><thead><tr><th>商品</th><th>数量</th><th>单价</th><th>小计</th></tr></thead><tbody>' + itemRows + '</tbody></table>' +
      '<div class="detail-note">' + icon('info') + '<span>' + e(order.note || '暂无订单备注。') + '</span></div>' +
      '</div>' +
      '<div class="detail-side">' +
      '<div class="detail-section-label">履约信息</div>' +
      '<div class="detail-meta">' +
      '<div class="detail-meta__row"><span>收货信息</span><strong>' + e(order.contact) + ' · ' + e(order.phone) + '</strong></div>' +
      '<div class="detail-meta__row"><span>收货地址</span><strong>' + e(order.address) + '</strong></div>' +
      '<div class="detail-meta__row"><span>付款条件</span><strong>' + e(order.paymentTerm) + '</strong></div>' +
      '<div class="detail-meta__row"><span>销售顾问</span><strong>' + e(order.salesRep) + '</strong></div>' +
      '<div class="detail-meta__row"><span>订单金额</span><strong style="color:var(--text-strong);">' + U.formatMoney(order.amount) + '</strong></div>' +
      '</div>' +
      orderFlowHTML(order) +
      '</div></div>';
  }

  function orderRowsHTML(rows) {
    if (!rows.length) {
      return tableEmpty(7, '没有符合条件的订单', '试试清空搜索关键词，或切换到其他状态标签。', '');
    }
    return rows.map(function (order) {
      var expanded = state.expandedOrder === order.id;
      return '<tr class="order-row' + (expanded ? ' is-expanded' : '') + '" data-order-id="' + e(order.id) + '" tabindex="0" aria-expanded="' + (expanded ? 'true' : 'false') + '">' +
        '<td><span class="id-tag">' + e(order.id) + '</span><div class="cell-sub">' + e(order.salesRep) + '</div></td>' +
        '<td><div class="order-customer">' + avatar(order.customerName, order.customerId, 'avatar--sm avatar--company') +
        '<div><div class="order-customer__name">' + e(order.customerName) + '</div>' +
        '<div class="order-customer__unit">' + e(order.dept) + '</div></div></div></td>' +
        '<td><div class="cell-primary" style="font-weight:500;">' + e(order.dept) + '</div></td>' +
        '<td><span class="cell-money">' + U.formatMoney(order.amount) + '</span><div class="cell-sub">' + orderItemsCount(order) + ' 项商品与服务</div></td>' +
        '<td>' + orderBadge(order.status) + '</td>' +
        '<td><span class="cell-mono">' + U.formatDate(order.date) + '</span></td>' +
        '<td><span class="expand-caret" aria-hidden="true">' + icon('chevron-down') + '</span></td>' +
        '</tr>' +
        (expanded ? '<tr class="detail-row"><td colspan="7">' + orderDetailHTML(order) + '</td></tr>' : '');
    }).join('');
  }

  function ordersFooterHTML(rows) {
    var amount = sumBy(rows, function (order) { return order.amount; });
    return '<div class="table-footer"><span class="table-footer__info">当前显示 <strong>' + rows.length + '</strong> 笔订单 · 订单金额合计 <strong>' + U.formatMoney(amount) + '</strong></span>' +
      '<span class="table-footer__info">点击订单行可展开商品明细与履约进度</span></div>';
  }

  function renderOrders() {
    var rows = filteredOrders();
    return '<div class="page">' +
      pageHead(PAGE_META.orders.eyebrow, '订单管理',
        '共 <strong>' + db.orders.length + '</strong> 笔订单 · 待发货 <strong>' + pendingShipments().length + '</strong> 笔 · 待付款 <strong>' + pendingPayments().length + '</strong> 笔',
        '<button class="btn btn--ghost" type="button" data-action="export-orders">' + icon('download') + '<span class="btn-label">导出订单</span></button>') +
      '<section class="panel panel--flush">' +
      '<div class="orders-toolbar">' +
      '<div class="tabs" id="orderTabs" role="tablist" aria-label="订单状态">' + orderTabsHTML() + '</div>' +
      '<div class="orders-toolbar__aside">' + searchField(state.orderQuery, '搜索订单号或客户…', 'orders', 'clear-order-search') +
      '<span class="order-hint">' + icon('info') + '点击行查看明细</span></div>' +
      '</div>' +
      '<div class="table-scroll"><table class="data-table data-table--orders">' +
      '<thead><tr><th>订单号</th><th>客户</th><th>销售单元</th><th>订单金额</th><th>状态</th><th>下单日期</th><th>明细</th></tr></thead>' +
      '<tbody id="orderTableBody">' + orderRowsHTML(rows) + '</tbody></table></div>' +
      '<div id="orderTableFooter">' + ordersFooterHTML(rows) + '</div>' +
      '</section></div>';
  }

  function refreshOrderResults() {
    var tabs = $('orderTabs');
    if (tabs) tabs.innerHTML = orderTabsHTML();
    var body = $('orderTableBody');
    if (!body) return;
    var rows = filteredOrders();
    body.innerHTML = orderRowsHTML(rows);
    var footer = $('orderTableFooter');
    if (footer) footer.innerHTML = ordersFooterHTML(rows);
  }

  function toggleOrder(orderId) {
    state.expandedOrder = state.expandedOrder === orderId ? null : orderId;
    refreshOrderResults();
  }

  /* =========================================================
   * 库存管理
   * ======================================================= */
  function filteredProducts() {
    var query = state.inventoryQuery.trim().toLowerCase();
    var rows = db.products.filter(function (product) {
      var matchesQuery = !query || [product.sku, product.name, product.category, product.supplier, product.warehouse]
        .some(function (value) { return String(value || '').toLowerCase().indexOf(query) !== -1; });
      var matchesCategory = !state.inventoryCategory || product.category === state.inventoryCategory;
      return matchesQuery && matchesCategory;
    });
    return rows.sort(function (a, b) {
      var aLow = a.stock < a.safetyStock ? 0 : 1;
      var bLow = b.stock < b.safetyStock ? 0 : 1;
      return aLow - bLow || a.sku.localeCompare(b.sku);
    });
  }

  function productStockValue(rows) {
    return sumBy(rows, function (product) { return product.stock * product.price; });
  }

  function productStatusCell(product) {
    if (product.stock < product.safetyStock) {
      return '<span class="stock-alert-tag">' + icon('alert-triangle') + '低于安全线</span>';
    }
    return '<span class="stock-ok-tag">库存充足</span>';
  }

  function productRowsHTML(rows) {
    if (!rows.length) {
      return tableEmpty(8, '没有匹配的商品', '尝试调整关键词或品类筛选条件。', '');
    }
    return rows.map(function (product) {
      var low = product.stock < product.safetyStock;
      var ratio = product.safetyStock ? Math.min(100, Math.round((product.stock / product.safetyStock) * 100)) : 100;
      var fillClass = ratio < 50 ? ' stock-bar__fill--danger' : ratio < 100 ? ' stock-bar__fill--warning' : '';
      return '<tr class="' + (low ? 'is-low' : '') + '">' +
        '<td><div class="sku-cell"><span class="sku-code">' + e(product.sku) + '</span><span class="sku-name">' + e(product.warehouse) + ' · ' + e(product.supplier) + '</span></div></td>' +
        '<td><div class="cell-primary">' + e(product.name) + '</div><div class="cell-sub">' + e(product.unit) + ' · 更新于 ' + U.formatDate(product.updatedAt) + '</div></td>' +
        '<td><span class="badge badge--neutral badge--plain">' + e(product.category) + '</span></td>' +
        '<td><div class="stock-cell"><span class="stock-number' + (low ? ' stock-number--low' : '') + '">' + U.formatNumber(product.stock) + '</span><span class="stock-unit">' + e(product.unit) + '</span></div>' +
        '<div class="stock-bar"><span class="stock-bar__fill' + fillClass + '" style="width:' + Math.max(4, ratio) + '%"></span></div></td>' +
        '<td><span class="cell-mono">' + U.formatNumber(product.safetyStock) + ' ' + e(product.unit) + '</span></td>' +
        '<td><span class="cell-money">' + U.formatMoney(product.price, 2) + '</span></td>' +
        '<td><span class="cell-money cell-money--muted">' + U.formatMoney(product.stock * product.price) + '</span></td>' +
        '<td><div class="stock-actions">' +
        '<button class="stock-action stock-action--in" type="button" data-action="stock-op" data-id="' + e(product.id) + '" data-type="in" title="办理入库">' + icon('inbound') + '入库</button>' +
        '<button class="stock-action stock-action--out" type="button" data-action="stock-op" data-id="' + e(product.id) + '" data-type="out" title="办理出库">' + icon('outbound') + '出库</button>' +
        '</div></td></tr>';
    }).join('');
  }

  function inventoryFooterHTML(rows) {
    return '<div class="table-footer"><span class="table-footer__info">当前显示 <strong>' + rows.length + '</strong> 个 SKU · 预警商品已置顶显示</span>' +
      '<span class="table-footer__info">库存货值 <strong>' + U.formatMoney(productStockValue(rows)) + '</strong></span></div>';
  }

  function renderInventory() {
    var rows = filteredProducts();
    var low = lowStockProducts();
    var allValue = productStockValue(db.products);
    var totals = db.products.reduce(function (sum, product) { return sum + product.stock; }, 0);
    var categories = Array.from(new Set(db.products.map(function (product) { return product.category; })));
    return '<div class="page">' +
      pageHead(PAGE_META.inventory.eyebrow, '库存管理',
        '共 <strong>' + db.products.length + '</strong> 个 SKU · 库存总量 <strong>' + U.formatNumber(totals) + '</strong> 件 · <strong style="color:var(--danger);">' + low.length + '</strong> 个商品低于安全库存',
        '<button class="btn btn--ghost" type="button" data-action="export-inventory">' + icon('download') + '<span class="btn-label">导出库存</span></button>') +
      '<div class="inventory-summary">' +
      '<div class="summary-card" style="--summary-rgb:47,99,232;"><span class="summary-card__icon">' + icon('box') + '</span><div class="summary-card__copy"><div class="summary-card__label">在库 SKU</div><div class="summary-card__value">' + db.products.length + ' <small>个 SKU · ' + categories.length + ' 个品类</small></div></div></div>' +
      '<div class="summary-card summary-card--danger" style="--summary-rgb:217,78,78;"><span class="summary-card__icon">' + icon('alert-triangle') + '</span><div class="summary-card__copy"><div class="summary-card__label">库存预警</div><div class="summary-card__value">' + low.length + ' <small>个 SKU 待补货</small></div></div></div>' +
      '<div class="summary-card" style="--summary-rgb:13,148,136;"><span class="summary-card__icon">' + icon('wallet') + '</span><div class="summary-card__copy"><div class="summary-card__label">库存货值</div><div class="summary-card__value">' + U.formatMoney(allValue) + ' <small>按当前单价估算</small></div></div></div>' +
      '</div>' +
      '<section class="panel panel--flush">' +
      '<div class="toolbar">' + searchField(state.inventoryQuery, '搜索 SKU、商品或供应商…', 'inventory', 'clear-inventory-search') +
      filterSelect('inventory-category', state.inventoryCategory, '全部品类', categories, '按商品品类筛选') +
      '<button class="icon-reset" type="button" data-action="reset-inventory-filters">' + icon('refresh', 'icon--xs') + '重置</button>' +
      '<span class="toolbar__meta">筛选结果 <strong id="inventoryResultCount">' + rows.length + '</strong> 个 SKU</span>' +
      '</div>' +
      '<div class="table-scroll"><table class="data-table data-table--inventory">' +
      '<thead><tr><th>SKU / 仓储</th><th>商品名称</th><th>分类</th><th>当前库存</th><th>安全库存</th><th>单价</th><th>库存货值</th><th>操作</th></tr></thead>' +
      '<tbody id="inventoryTableBody">' + productRowsHTML(rows) + '</tbody></table></div>' +
      '<div id="inventoryTableFooter">' + inventoryFooterHTML(rows) + '</div>' +
      '</section></div>';
  }

  function refreshInventoryResults() {
    var body = $('inventoryTableBody');
    if (!body) return;
    var rows = filteredProducts();
    body.innerHTML = productRowsHTML(rows);
    var count = $('inventoryResultCount');
    if (count) count.textContent = String(rows.length);
    var footer = $('inventoryTableFooter');
    if (footer) footer.innerHTML = inventoryFooterHTML(rows);
  }

  /** 库存出入库弹窗：实时预览变动结果并校验超量出库 */
  function stockDialog(id, type) {
    var product = db.products.find(function (item) { return item.id === id; });
    if (!product) return;
    var mode = type === 'out' ? 'out' : 'in';
    var low = product.stock < product.safetyStock;
    var body = '<form id="stockForm" novalidate>' +
      '<div class="modal-product"><span class="modal-product__mark">' + icon('box') + '</span>' +
      '<div class="modal-product__body"><div class="modal-product__name">' + e(product.name) + '</div>' +
      '<div class="modal-product__meta">' + e(product.sku) + ' · ' + e(product.category) + ' · ' + e(product.warehouse) + '</div></div>' +
      '<div class="modal-product__stock"><span>当前库存</span><strong class="' + (low ? 'is-low' : '') + '">' + U.formatNumber(product.stock) + ' ' + e(product.unit) + '</strong></div></div>' +
      '<div class="stock-type-toggle" role="group" aria-label="库存操作类型">' +
      '<button class="stock-type-btn' + (mode === 'in' ? ' is-active' : '') + '" type="button" data-stock-type="in">' + icon('inbound') + '办理入库</button>' +
      '<button class="stock-type-btn' + (mode === 'out' ? ' is-active' : '') + '" type="button" data-stock-type="out">' + icon('outbound') + '办理出库</button>' +
      '</div>' +
      '<div class="form-grid">' +
      '<div class="field" id="stockQtyField"><label for="stockQty">操作数量 <span style="color:var(--danger)">*</span></label>' +
      '<input class="input" id="stockQty" name="qty" type="number" min="1" step="1" value="10" required data-autofocus>' +
      '<span class="field-error" id="stockQtyError">请输入大于 0 的整数。</span></div>' +
      '<div class="field"><label>安全库存线</label><input class="input" value="' + U.formatNumber(product.safetyStock) + ' ' + e(product.unit) + '" disabled></div>' +
      '<div class="field field--full"><label for="stockNote">备注说明 <span class="optional">选填</span></label>' +
      '<input class="input" id="stockNote" name="note" placeholder="如：采购批次入库 / 订单发货出库" maxlength="80"></div>' +
      '</div>' +
      '<div class="stock-preview" id="stockPreview">' +
      '<div class="stock-preview__item"><span class="stock-preview__label">操作前</span><span class="stock-preview__value">' + product.stock + ' ' + e(product.unit) + '</span></div>' +
      '<span class="stock-preview__arrow">' + icon('arrow-right') + '</span>' +
      '<div class="stock-preview__item"><span class="stock-preview__label">操作后</span><span class="stock-preview__value stock-preview__value--after" id="stockAfter">' + (mode === 'in' ? product.stock + 10 : Math.max(0, product.stock - 10)) + ' ' + e(product.unit) + '</span></div>' +
      '<div class="stock-preview__item"><span class="stock-preview__label">安全线差额</span><span class="stock-preview__value" id="stockGap">' + (mode === 'in' ? product.stock + 10 - product.safetyStock : product.stock - 10 - product.safetyStock) + ' ' + e(product.unit) + '</span></div>' +
      '</div></form>';
    var footer = '<span class="modal__foot-hint">' + icon('shield') + '操作后立即更新库存</span>' +
      '<button class="btn btn--ghost" type="button" data-modal-close>取消</button>' +
      '<button class="btn btn--primary" type="submit" form="stockForm" id="stockSubmitBtn">' + (mode === 'in' ? '确认入库' : '确认出库') + '</button>';
    openDialog({
      kicker: 'INVENTORY / MOVEMENT',
      title: mode === 'in' ? '商品入库' : '商品出库',
      sub: '库存变动会写入本地数据，并实时更新预警状态。',
      body: body,
      footer: footer,
      onMount: function (overlay, close) {
        var form = overlay.querySelector('#stockForm');
        var qtyInput = overlay.querySelector('#stockQty');
        var qtyField = overlay.querySelector('#stockQtyField');
        var errorEl = overlay.querySelector('#stockQtyError');
        var afterEl = overlay.querySelector('#stockAfter');
        var gapEl = overlay.querySelector('#stockGap');
        var preview = overlay.querySelector('#stockPreview');
        var submitBtn = overlay.querySelector('#stockSubmitBtn');
        var currentType = mode;

        function sync() {
          var qty = Number(qtyInput.value);
          if (!isFinite(qty) || qty < 0) qty = 0;
          var after = currentType === 'in' ? product.stock + qty : product.stock - qty;
          var gap = after - product.safetyStock;
          afterEl.textContent = after + ' ' + product.unit;
          gapEl.textContent = gap + ' ' + product.unit;
          submitBtn.textContent = currentType === 'in' ? '确认入库' : '确认出库';
          qtyInput.max = currentType === 'out' ? String(product.stock) : '';
          var invalid = currentType === 'out' && qty > product.stock;
          qtyField.classList.toggle('has-error', invalid);
          if (invalid) {
            errorEl.textContent = '出库数量不能超过当前库存（' + product.stock + ' ' + product.unit + '）。';
          }
          preview.classList.toggle('stock-preview--danger', after < 0);
          preview.classList.toggle('stock-preview--warning', after >= 0 && after < product.safetyStock);
        }

        overlay.querySelectorAll('[data-stock-type]').forEach(function (button) {
          button.addEventListener('click', function () {
            currentType = button.getAttribute('data-stock-type');
            overlay.querySelectorAll('[data-stock-type]').forEach(function (btn) {
              btn.classList.toggle('is-active', btn === button);
            });
            qtyField.classList.remove('has-error');
            sync();
          });
        });
        qtyInput.addEventListener('input', function () {
          qtyField.classList.remove('has-error');
          sync();
        });
        sync();

        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var qty = Number(qtyInput.value);
          if (!Number.isInteger(qty) || qty <= 0) {
            qtyField.classList.add('has-error');
            errorEl.textContent = '请输入大于 0 的整数。';
            qtyInput.focus();
            return;
          }
          if (currentType === 'out' && qty > product.stock) {
            qtyField.classList.add('has-error');
            errorEl.textContent = '出库数量不能超过当前库存（' + product.stock + ' ' + product.unit + '）。';
            qtyInput.focus();
            return;
          }
          var before = product.stock;
          var after = currentType === 'in' ? before + qty : before - qty;
          product.stock = after;
          product.updatedAt = U.formatDate(new Date());
          if (!Array.isArray(db.stockLogs)) db.stockLogs = [];
          db.stockLogs.unshift({
            id: 'SL-' + String(Date.now()),
            productId: product.id,
            sku: product.sku,
            type: currentType,
            qty: qty,
            before: before,
            after: after,
            note: String(new FormData(form).get('note') || '').trim() || (currentType === 'in' ? '手工入库' : '手工出库'),
            operator: '王敏',
            at: new Date().toISOString()
          });
          if (!saveDatabase()) return;
          close();
          renderViewWithoutScroll();
          var warning = after < product.safetyStock;
          showToast(currentType === 'in' ? '入库成功' : '出库成功',
            product.name + '：' + before + ' → ' + after + ' ' + product.unit + (warning ? '，已低于安全库存' : ''),
            warning ? 'warning' : 'success');
        });
      }
    });
  }

  /* =========================================================
   * 报表中心
   * ======================================================= */
  /** 汇总某一月份、某一销售单元的实际销售额、目标与环比数据 */
  function reportBaseData(month, unitFilter) {
    var prevDate = U.addMonths(U.parseDate(month + '-01'), -1);
    var prevKey = U.monthKey(prevDate);
    var rows = Data.SALES_UNITS.map(function (unit) {
      var currentOrders = db.orders.filter(function (order) {
        return order.monthKey === month && order.dept === unit && order.status !== '已取消';
      });
      var previousOrders = db.orders.filter(function (order) {
        return order.monthKey === prevKey && order.dept === unit && order.status !== '已取消';
      });
      var actual = sumBy(currentOrders, function (order) { return order.amount; });
      var previous = sumBy(previousOrders, function (order) { return order.amount; });
      var target = Data.REPORT_TARGETS[unit] || 0;
      return {
        unit: unit,
        owner: Data.UNIT_OWNERS[unit] || '—',
        actual: actual,
        previous: previous,
        target: target,
        completion: target ? (actual / target) * 100 : 0,
        orderCount: currentOrders.length,
        average: currentOrders.length ? actual / currentOrders.length : 0,
        change: previous ? ((actual - previous) / previous) * 100 : null
      };
    });
    var filtered = unitFilter && unitFilter !== '全部部门' ? rows.filter(function (row) { return row.unit === unitFilter; }) : rows;
    var actual = sumBy(filtered, function (row) { return row.actual; });
    var target = sumBy(filtered, function (row) { return row.target; });
    var previous = sumBy(filtered, function (row) { return row.previous; });
    var orderCount = filtered.reduce(function (sum, row) { return sum + row.orderCount; }, 0);
    return {
      rows: filtered,
      allRows: rows,
      month: month,
      prevMonth: prevKey,
      actual: actual,
      target: target,
      previous: previous,
      completion: target ? (actual / target) * 100 : 0,
      orderCount: orderCount,
      average: orderCount ? actual / orderCount : 0,
      change: previous ? ((actual - previous) / previous) * 100 : null
    };
  }

  function reportProgressMarkup(completion) {
    var percent = Math.max(0, Math.min(100, completion));
    var cls = completion >= 100 ? '' : completion >= 90 ? ' is-under' : ' is-danger';
    var valueCls = completion >= 100 ? ' is-good' : completion >= 90 ? ' is-under' : ' is-danger';
    return '<span class="report-progress"><span class="report-progress__bar"><i class="' + (completion >= 100 ? '' : completion >= 90 ? 'is-under' : 'is-danger') + '" style="width:' + percent + '%"></i></span>' +
      '<span class="report-progress__value' + valueCls + '">' + completion.toFixed(1) + '%</span></span>';
  }

  function renderReports() {
    var months = U.recentMonths(6).slice().reverse();
    if (!months.some(function (month) { return month.key === state.reportMonth; })) {
      state.reportMonth = months[0].key;
    }
    var report = reportBaseData(state.reportMonth, state.reportUnit);
    var best = report.allRows.slice().sort(function (a, b) { return b.completion - a.completion; })[0];
    var achieved = report.allRows.filter(function (row) { return row.completion >= 100; }).length;
    var change = report.change;
    var changeClass = change == null ? '' : change >= 0 ? 'trend-up' : 'trend-down';
    var changeText = change == null ? '上月暂无数据' : '较上月 ' + (change >= 0 ? '+' : '') + U.formatPercent(change, 1);
    var monthOptions = months.map(function (month) {
      return '<option value="' + e(month.key) + '"' + (month.key === state.reportMonth ? ' selected' : '') + '>' + e(month.fullLabel) + '</option>';
    }).join('');
    var unitOptions = '<option value="全部部门"' + (state.reportUnit === '全部部门' ? ' selected' : '') + '>全部部门</option>' +
      Data.SALES_UNITS.map(function (unit) {
        return '<option value="' + e(unit) + '"' + (state.reportUnit === unit ? ' selected' : '') + '>' + e(unit) + '</option>';
      }).join('');

    var rowsHTML = report.rows.map(function (row) {
      return '<tr><td><span class="report-dept">' + e(row.unit) + '</span></td>' +
        '<td><span class="report-owner">' + avatar(row.owner, row.unit, 'avatar--sm') + e(row.owner) + '</span></td>' +
        '<td>' + U.formatMoney(row.target) + '</td>' +
        '<td style="color:var(--text-strong);font-weight:600;">' + U.formatMoney(row.actual) + '</td>' +
        '<td>' + reportProgressMarkup(row.completion) + '</td>' +
        '<td>' + row.orderCount + '</td></tr>';
    }).join('');
    if (!report.rows.length) {
      rowsHTML = '<tr><td colspan="6"><div class="empty-state" style="min-height:180px;padding:24px;"><div class="empty-state__icon">' + icon('chart') + '</div><h3>暂无报表数据</h3><p>当前筛选范围内没有有效订单。</p></div></td></tr>';
    }

    var insight = report.orderCount
      ? '<strong>' + e(best.unit) + '</strong>本期达成率最高（' + best.completion.toFixed(1) + '%），' +
        (achieved ? '共有 ' + achieved + ' 个销售单元达成月度目标。' : '暂无销售单元达成月度目标，建议关注重点客户转化与回款节奏。') +
        ' 本期有效订单 ' + report.orderCount + ' 笔，平均客单价 ' + U.formatMoney(report.average) + '。'
      : '当前筛选范围内暂无有效订单，切换月份或部门查看其他经营数据。';

    return '<div class="page">' +
      pageHead(PAGE_META.reports.eyebrow, '报表中心',
        '近 <strong>6</strong> 个月经营汇总 · 当前口径：<strong>' + e(U.fullMonthLabel(state.reportMonth)) + '</strong> · 已排除取消订单',
        '<button class="btn btn--ghost" type="button" data-action="export-report">' + icon('download') + '<span class="btn-label">导出报表</span></button>') +
      '<section class="report-filter-bar">' +
      '<div class="report-filter-bar__title">' + icon('filter') + '<div>经营筛选<small>实时计算有效订单数据</small></div></div>' +
      '<label class="report-filter"><span>统计月份</span><span class="select-wrap"><select class="select" data-filter="report-month" aria-label="选择统计月份">' + monthOptions + '</select></span></label>' +
      '<label class="report-filter"><span>销售单元</span><span class="select-wrap"><select class="select" data-filter="report-unit" aria-label="选择销售单元">' + unitOptions + '</select></span></label>' +
      '<span class="report-filter-note">' + icon('info') + '数据口径：只统计非取消订单</span>' +
      '</section>' +
      '<div class="report-kpis">' +
      '<div class="report-kpi"><div class="report-kpi__label">' + icon('wallet') + '本期销售额</div><div class="report-kpi__value">' + U.formatMoney(report.actual) + '</div><div class="report-kpi__foot"><span class="' + changeClass + '">' + changeText + '</span></div></div>' +
      '<div class="report-kpi"><div class="report-kpi__label">' + icon('target') + '目标完成率</div><div class="report-kpi__value">' + report.completion.toFixed(1) + '<small>%</small></div><div class="report-kpi__foot">目标 ' + U.formatMoney(report.target) + '</div></div>' +
      '<div class="report-kpi"><div class="report-kpi__label">' + icon('receipt') + '有效订单</div><div class="report-kpi__value">' + report.orderCount + '<small>笔</small></div><div class="report-kpi__foot">' + (achieved ? achieved + ' 个单元已达成目标' : '本月尚未有单元达标') + '</div></div>' +
      '<div class="report-kpi"><div class="report-kpi__label">' + icon('chart') + '平均客单价</div><div class="report-kpi__value">' + U.formatMoney(report.average) + '</div><div class="report-kpi__foot">按有效订单计算</div></div>' +
      '</div>' +
      '<div class="report-grid">' +
      '<section class="panel report-chart-panel">' +
      '<div class="panel__head"><div><div class="panel__kicker">TARGET VS ACTUAL</div><div class="panel__title">部门销售达成</div><div class="panel__sub">实际销售额与月度目标对比</div></div>' +
      '<div class="panel__tools"><span class="range-chip">' + icon('calendar') + e(U.fullMonthLabel(state.reportMonth)) + '</span></div></div>' +
      '<div class="report-chart-wrap"><div class="chart-canvas-wrap"><canvas id="reportBarChart" role="img" aria-label="部门销售实际与目标柱状图"></canvas></div></div>' +
      '<div class="chart-legend report-chart-legend"><span class="report-legend-item"><i style="background:var(--primary)"></i>实际销售额</span>' +
      '<span class="report-legend-item"><i style="background:var(--line-strong)"></i>月度目标</span></div>' +
      '<div class="report-insight">' + icon('sparkles') + '<span>' + insight + '</span></div>' +
      '</section>' +
      '<section class="panel report-table-panel">' +
      '<div class="panel__head"><div><div class="panel__kicker">SUMMARY / BY UNIT</div><div class="panel__title">部门经营汇总</div><div class="panel__sub">按销售单元汇总目标完成情况</div></div>' +
      '<div class="panel__tools"><span class="range-chip">' + report.rows.length + ' 个单元</span></div></div>' +
      '<div class="report-table-wrap"><table class="report-table"><thead><tr><th>销售单元</th><th>负责人</th><th>销售目标</th><th>实际销售</th><th>完成率</th><th>订单数</th></tr></thead>' +
      '<tbody>' + rowsHTML + '</tbody>' +
      '<tfoot><tr><td>合计</td><td>—</td><td>' + U.formatMoney(report.target) + '</td><td>' + U.formatMoney(report.actual) + '</td><td>' + report.completion.toFixed(1) + '%</td><td>' + report.orderCount + '</td></tr></tfoot></table></div>' +
      '</section></div>' +
      '</div>';
  }

  /* =========================================================
   * 生产管理
   * ======================================================= */
  function filteredWorkOrders() {
    var query = state.productionQuery.trim().toLowerCase();
    var rows = (db.workOrders || []).filter(function (order) {
      var matchesStatus = state.productionStatus === '全部' || order.status === state.productionStatus;
      var matchesLine = !state.productionLine || order.lineId === state.productionLine;
      var matchesQuery = !query || [order.id, order.productName, order.productSku, order.bomId, order.bomVersion, order.status, lineName(order.lineId), order.owner]
        .some(function (value) { return String(value || '').toLowerCase().indexOf(query) !== -1; });
      return matchesStatus && matchesLine && matchesQuery;
    });
    return rows.sort(workOrderSort);
  }

  function workOrderPageData() {
    var rows = filteredWorkOrders();
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.productionPage = Math.min(Math.max(1, state.productionPage), pages);
    var start = (state.productionPage - 1) * PAGE_SIZE;
    return {
      rows: rows.slice(start, start + PAGE_SIZE),
      total: total,
      pages: pages,
      page: state.productionPage,
      start: total ? start + 1 : 0,
      end: Math.min(start + PAGE_SIZE, total)
    };
  }

  function workOrderTabsHTML() {
    var counts = {};
    WORK_ORDER_STATUSES.forEach(function (status) { counts[status] = 0; });
    (db.workOrders || []).forEach(function (order) {
      if (counts[order.status] != null) counts[order.status] += 1;
    });
    return WORK_ORDER_TABS.map(function (status) {
      var count = status === '全部' ? (db.workOrders || []).length : counts[status];
      var active = state.productionStatus === status;
      return '<button class="tab' + (active ? ' is-active' : '') + '" type="button" data-action="production-tab" data-status="' + e(status) + '"' +
        (active ? ' aria-selected="true"' : ' aria-selected="false"') + '>' + e(status) +
        '<span class="tab__count">' + count + '</span></button>';
    }).join('');
  }

  function workOrderProgressCell(order) {
    var pct = workOrderProgress(order);
    var fillCls = order.status === '已完工' ? ' wo-progress__fill--done' : order.status === '已暂停' ? ' wo-progress__fill--paused' : '';
    return '<div class="wo-progress"><div class="wo-progress__bar">' +
      '<span class="wo-progress__fill' + fillCls + '" style="width:' + Math.max(2, pct).toFixed(1) + '%"></span></div>' +
      '<span class="wo-progress__value">' + pct.toFixed(0) + '%</span></div>';
  }

  function workOrderActions(order) {
    var buttons = '';
    if (order.status === '生产中') {
      buttons += '<button class="row-action" type="button" data-action="wo-report" data-id="' + e(order.id) + '" title="报工" aria-label="为工单 ' + e(order.id) + ' 报工">' + icon('clipboard') + '</button>';
      buttons += '<button class="row-action" type="button" data-action="wo-pause" data-id="' + e(order.id) + '" title="暂停工单" aria-label="暂停工单 ' + e(order.id) + '">' + icon('pause') + '</button>';
    } else if (order.status === '已暂停') {
      buttons += '<button class="row-action" type="button" data-action="wo-resume" data-id="' + e(order.id) + '" title="恢复工单" aria-label="恢复工单 ' + e(order.id) + '">' + icon('play') + '</button>';
    } else if (order.status === '待产') {
      buttons += '<button class="row-action" type="button" data-action="wo-start" data-id="' + e(order.id) + '" title="开工生产" aria-label="开始工单 ' + e(order.id) + '">' + icon('play') + '</button>';
    }
    buttons += '<button class="row-action" type="button" data-action="wo-detail" data-id="' + e(order.id) + '" title="查看工序明细" aria-label="查看工单 ' + e(order.id) + ' 明细">' + icon('eye') + '</button>';
    return '<div class="row-actions">' + buttons + '</div>';
  }

  function workOrderRowsHTML(data) {
    if (!data.rows.length) {
      return tableEmpty(11, '没有符合条件的生产工单', '试试清空搜索关键词，或切换状态与产线筛选。',
        '<button class="btn btn--soft" type="button" data-action="add-workorder">' + icon('plus') + '新建工单</button>');
    }
    return data.rows.map(function (order) {
      var affected = workOrderAffected(order);
      var overdue = order.status !== '已完工' && String(order.dueDate) < todayKey();
      var devices = (order.deviceIds || []).map(function (id) { return deviceStatusChip(id); }).join('');
      return '<tr class="wo-row' + (affected ? ' is-affected' : '') + '" data-wo-id="' + e(order.id) + '" tabindex="0" aria-label="查看工单 ' + e(order.id) + ' 工序明细">' +
        '<td><span class="id-tag">' + e(order.id) + '</span><div class="cell-sub">' + e(order.owner) + ' · ' + e(order.priority) + '优先级</div></td>' +
        '<td><div class="cell-primary">' + e(order.productName) + '</div><div class="cell-sub">' + e(order.productSku) + '</div></td>' +
        '<td><span class="bom-tag">' + e(order.bomId) + ' · ' + e(order.bomVersion) + '</span><div class="cell-sub">' + (order.operations || []).length + ' 道工序</div></td>' +
        '<td><span class="cell-money">' + U.formatNumber(order.planQty) + '</span><div class="cell-sub">' +
        e((productById(order.productId) || {}).unit || '件') + '</div></td>' +
        '<td><span class="cell-money">' + U.formatNumber(order.completedQty) + '</span><div class="cell-sub">不良 ' + U.formatNumber(order.defectQty) + ' 件</div></td>' +
        '<td><div class="cell-primary" style="font-weight:500;">' + e(lineCode(order.lineId)) + '</div><div class="cell-sub">' + e(lineName(order.lineId)) + '</div></td>' +
        '<td><div class="device-chips">' + (devices || '<span class="cell-sub">未绑定</span>') + '</div></td>' +
        '<td>' + workOrderStatusBadge(order.status) + (affected ? '<span class="wo-affected-tag">受影响</span>' : '') + '</td>' +
        '<td><span class="cell-mono"' + (overdue ? ' style="color:var(--danger);font-weight:600;"' : '') + '>' + e(U.formatDate(order.dueDate)) + '</span>' +
        (overdue ? '<div class="cell-sub" style="color:var(--danger);">已逾期</div>' : '') + '</td>' +
        '<td>' + workOrderProgressCell(order) + '<div class="cell-sub">' + U.formatNumber(order.completedQty) + ' / ' + U.formatNumber(order.planQty) + '</div></td>' +
        '<td>' + workOrderActions(order) + '</td></tr>';
    }).join('');
  }

  function workOrderFooterHTML(data) {
    var rows = filteredWorkOrders();
    var planQty = sumBy(rows, function (order) { return order.planQty; });
    var doneQty = sumBy(rows, function (order) { return order.completedQty; });
    return '<div class="table-footer">' +
      '<span class="table-footer__info">' + (data.total ? '显示 <strong>' + data.start + '–' + data.end + '</strong> 条，共 <strong>' + data.total + '</strong> 张工单' : '暂无匹配结果') +
      ' · 计划 <strong>' + U.formatNumber(planQty) + '</strong> 件 · 已完成 <strong>' + U.formatNumber(doneQty) + '</strong> 件</span>' +
      pagination(data.page, data.pages, 'production-page', data.total) + '</div>';
  }

  function renderProduction() {
    var data = workOrderPageData();
    var stats = productionStats();
    var affected = affectedWorkOrders();
    var daily = dailyOutput(12);
    var yesterdayOutput = daily.length > 1 ? daily[daily.length - 2].good : 0;
    var outputTrend = yesterdayOutput ? (stats.todayOutput - yesterdayOutput) / yesterdayOutput * 100 : null;
    var faultDevices = (db.devices || []).filter(function (device) { return device.status === '故障'; });
    var banner = '';
    if (affected.length) {
      banner = '<section class="mes-alert-banner">' +
        '<span class="mes-alert-banner__icon">' + icon('alert-triangle') + '</span>' +
        '<div class="mes-alert-banner__body"><div class="mes-alert-banner__title">设备故障联动预警 · ' + affected.length + ' 张在产工单受影响</div>' +
        '<div class="mes-alert-banner__desc">' + faultDevices.map(function (device) { return e(device.code + ' ' + device.name); }).join('、') +
        ' 处于故障状态，涉及工单 ' + affected.map(function (order) { return e(order.id); }).join('、') + '。建议暂停工单并安排改线或抢修。</div></div>' +
        '<div class="mes-alert-banner__actions">' +
        '<button class="btn btn--danger btn--sm" type="button" data-action="pause-affected">' + icon('pause') + '一键暂停受影响工单</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-action="go-devices">' + icon('chip') + '查看故障设备</button></div></section>';
    }

    var kpis = '<section class="kpi-grid" aria-label="生产核心指标">' +
      renderKpiCard({
        index: '01', featured: true, label: '在产工单数', icon: 'factory',
        value: U.formatNumber(stats.active) + '<span class="kpi-value__unit">张</span>',
        foot: '<span class="kpi-compare ' + (stats.affected ? 'kpi-compare--down' : 'kpi-compare--neutral') + '">' +
          icon(stats.affected ? 'alert-triangle' : 'check-circle') + (stats.affected ? stats.affected + ' 张受设备故障影响' : '设备运行正常') + '</span>',
        spark: sparkline(dailyOutput(7).map(function (item) { return item.good; }), 'var(--accent)')
      }) +
      renderKpiCard({
        index: '02', label: '本月计划达成率', icon: 'target', rgb: '47, 99, 232',
        value: stats.attainment.toFixed(1) + '<span class="kpi-value__unit">%</span>',
        foot: '<span class="kpi-compare kpi-compare--neutral">' + icon('check-circle') +
          U.formatNumber(stats.doneTotal) + ' / ' + U.formatNumber(stats.planTotal) + ' 件已开工工单</span>',
        spark: sparkline([62, 68, 71, 66, 74, stats.attainment], 'var(--primary)')
      }) +
      renderKpiCard({
        index: '03', label: '本月良率', icon: 'shield', rgb: '13, 148, 136',
        value: stats.yieldRate.toFixed(1) + '<span class="kpi-value__unit">%</span>',
        foot: '<span class="kpi-compare kpi-compare--neutral">' + icon('alert-triangle') + '不良 ' + U.formatNumber(stats.monthDefect) + ' 件</span>',
        spark: sparkline([96.8, 97.1, 97.6, 97.4, 97.9, stats.yieldRate], 'var(--accent)')
      }) +
      renderKpiCard({
        index: '04', label: '今日产量', icon: 'boxes', rgb: '122, 90, 234',
        value: U.formatNumber(stats.todayOutput) + '<span class="kpi-value__unit">件</span>',
        foot: '<span class="kpi-compare ' + (outputTrend == null ? 'kpi-compare--neutral' : outputTrend >= 0 ? '' : 'kpi-compare--down') + '">' +
          icon(outputTrend == null || outputTrend >= 0 ? 'trend-up' : 'trend-down') +
          (outputTrend == null ? '暂无昨日数据' : (outputTrend >= 0 ? '+' : '') + outputTrend.toFixed(1) + '%') +
          '<span class="kpi-compare__label">较昨日</span></span>',
        spark: sparkline(dailyOutput(7).map(function (item) { return item.good; }), 'var(--violet)')
      }) +
      '</section>';

    var chartPanel = '<section class="panel mes-chart-panel">' +
      '<div class="panel__head"><div><div class="panel__kicker">OUTPUT / 12 DAYS</div><div class="panel__title">近 12 天日产量趋势</div>' +
      '<div class="panel__sub">按工单报工时间聚合 · 横轴为日期 · 今日产出 ' + U.formatNumber(stats.todayOutput) + ' 件</div></div>' +
      '<div class="panel__tools"><span class="range-chip">' + icon('calendar') + '近 12 天</span></div></div>' +
      '<div class="mes-chart-area"><div class="chart-canvas-wrap"><canvas id="productionTrendChart" role="img" aria-label="近 12 天日产量柱状图"></canvas></div></div>' +
      '<div class="panel-chart-footer"><div class="chart-legend">' +
      '<span class="chart-legend__item"><span class="chart-legend__dot" style="background:var(--primary)"></span>良品产量</span>' +
      '<span class="chart-legend__item"><span class="chart-legend__dot" style="background:var(--danger)"></span>不良数量</span></div>' +
      '<span class="sales-footnote">' + icon('check-circle') + '数据来自工单报工记录</span></div></section>';

    var lineOptions = optionTags(LINES.map(function (line) {
      return { value: line.id, label: line.code + ' · ' + line.name };
    }), state.productionLine);

    var tablePanel = '<section class="panel panel--flush">' +
      '<div class="orders-toolbar"><div class="tabs" id="productionTabs" role="tablist" aria-label="工单状态">' + workOrderTabsHTML() + '</div>' +
      '<div class="orders-toolbar__aside">' +
      searchField(state.productionQuery, '搜索工单号、产品、BOM 或负责人…', 'production', 'clear-production-search') +
      '<span class="select-wrap"><select class="select filter-select" data-filter="production-line" aria-label="按产线筛选"><option value="">全部产线</option>' + lineOptions + '</select></span>' +
      '<button class="icon-reset" type="button" data-action="reset-production-filters">' + icon('refresh', 'icon--xs') + '重置</button>' +
      '<span class="order-hint">' + icon('info') + '点击工单行查看工序进度</span></div></div>' +
      '<div class="table-scroll"><table class="data-table data-table--workorders">' +
      '<thead><tr><th>工单号</th><th>产品</th><th>BOM 版本</th><th>计划数量</th><th>完成数量</th><th>产线</th><th>绑定设备</th><th>状态</th><th>计划交期</th><th>进度</th><th>操作</th></tr></thead>' +
      '<tbody id="workOrderTableBody">' + workOrderRowsHTML(data) + '</tbody></table></div>' +
      '<div id="workOrderTableFooter">' + workOrderFooterHTML(data) + '</div></section>';

    return '<div class="page">' +
      pageHead(PAGE_META.production.eyebrow, '生产管理',
        '自有 <strong>' + LINES.length + '</strong> 条产线 · 在产 <strong>' + stats.active + '</strong> 张 · 待产 <strong>' + stats.pending + '</strong> 张 · 今日产量 <strong>' + U.formatNumber(stats.todayOutput) + '</strong> 件 · 良率 <strong>' + stats.yieldRate.toFixed(1) + '%</strong>',
        '<button class="btn btn--ghost" type="button" data-action="export-workorders">' + icon('download') + '<span class="btn-label">导出工单</span></button>' +
        '<button class="btn btn--primary" type="button" data-action="add-workorder">' + icon('plus') + '新建工单</button>') +
      kpis + banner + chartPanel + tablePanel + '</div>';
  }

  function refreshProductionResults() {
    var tabs = $('productionTabs');
    if (tabs) tabs.innerHTML = workOrderTabsHTML();
    var body = $('workOrderTableBody');
    if (!body) return;
    var data = workOrderPageData();
    body.innerHTML = workOrderRowsHTML(data);
    var footer = $('workOrderTableFooter');
    if (footer) footer.innerHTML = workOrderFooterHTML(data);
  }

  /** 新建工单：产品 → BOM 版本 → 产线 → 绑定设备 → 数量与交期 */
  function workOrderDialog() {
    var boms = (db.boms || []).filter(function (bom) { return productById(bom.productId); });
    if (!boms.length) {
      showToast('暂无可生产的 BOM', '请先在数据层维护产品 BOM。', 'warning');
      return;
    }
    var defaultLine = 'L1';
    function productOptions() {
      return boms.map(function (bom) {
        var product = productById(bom.productId);
        return { value: bom.productId, label: product.name + ' · ' + product.sku };
      });
    }
    function deviceChecklist(lineId) {
      var devices = (db.devices || []).filter(function (device) { return !lineId || device.lineId === lineId; });
      if (!devices.length) return '<div class="form-help">该产线下暂无设备，请重新选择产线。</div>';
      return devices.map(function (device) {
        var meta = DEVICE_STATUS_META[device.status] || DEVICE_STATUS_META['待机'];
        var disabled = device.status === '故障';
        return '<label class="device-check' + (disabled ? ' device-check--disabled' : '') + '">' +
          '<input type="checkbox" name="deviceIds" value="' + e(device.id) + '"' + (disabled ? ' disabled' : '') + '>' +
          '<span class="device-chip device-chip--' + meta.cls + '">' + e(device.code) + '</span>' +
          '<span class="device-check__meta">' + e(device.type) + ' · ' + e(device.status) + '</span></label>';
      }).join('');
    }
    var firstProduct = productById(boms[0].productId);
    var firstRouting = (Data.PRODUCT_ROUTINGS && Data.PRODUCT_ROUTINGS[boms[0].productId]) || [];
    var defaultLineId = firstRouting.length ? firstRouting[0].lineId : defaultLine;
    var body = '<form id="workOrderForm" class="form-grid" novalidate>' +
      '<div class="field"><label for="woProduct">生产产品 <span style="color:var(--danger)">*</span></label>' +
      '<span class="select-wrap select-wrap--block"><select class="select" id="woProduct" name="productId" required>' + optionTags(productOptions(), boms[0].productId) + '</select></span></div>' +
      '<div class="field"><label for="woBomVersion">BOM 版本</label>' +
      '<input class="input" id="woBomVersion" value="' + e(boms[0].id + ' · ' + boms[0].version) + '" disabled></div>' +
      '<div class="field"><label for="woLine">生产产线 <span style="color:var(--danger)">*</span></label>' +
      '<span class="select-wrap select-wrap--block"><select class="select" id="woLine" name="lineId" required>' +
      optionTags(LINES.map(function (line) { return { value: line.id, label: line.code + ' · ' + line.name }; }), defaultLineId) + '</select></span>' +
      '<span class="form-help" id="woRoutingHint">' + e(firstRouting.map(function (op) { return op.name; }).join(' → ')) + '</span></div>' +
      '<div class="field"><label for="woPlanQty">计划数量 <span style="color:var(--danger)">*</span></label>' +
      '<input class="input" id="woPlanQty" name="planQty" type="number" min="1" step="1" value="200" placeholder="请输入计划生产数量" required data-autofocus></div>' +
      '<div class="field"><label for="woDueDate">计划交期 <span style="color:var(--danger)">*</span></label>' +
      '<input class="input" id="woDueDate" name="dueDate" type="date" value="' + e(U.formatDate(new Date(Date.now() + 7 * 86400000))) + '" required></div>' +
      '<div class="field"><label for="woPriority">优先级</label>' +
      '<span class="select-wrap select-wrap--block"><select class="select" id="woPriority" name="priority">' + optionTags(['高', '中', '低'], '中') + '</select></span></div>' +
      '<div class="field field--full"><label>绑定设备 <span style="color:var(--danger)">*</span> <span class="optional">至少选择 1 台</span></label>' +
      '<div class="device-check-grid" id="woDeviceGrid">' + deviceChecklist(defaultLineId) + '</div>' +
      '<span class="field-error" id="woDeviceError">工单必须绑定至少 1 台设备。</span>' +
      '<span class="form-help">故障设备不可绑定；工单报工将计入所选设备的今日 / 累计产量。</span></div>' +
      '<div class="field field--full"><label for="woNote">工单备注 <span class="optional">选填</span></label>' +
      '<input class="input" id="woNote" name="note" placeholder="如：客户加急 / 试产批次 / 指定物料批次" maxlength="80"></div>' +
      '</form>';
    var footer = '<span class="modal__foot-hint">' + icon('shield') + '工单号自动生成 · 数据保存在本机</span>' +
      '<button class="btn btn--ghost" type="button" data-modal-close>取消</button>' +
      '<button class="btn btn--primary" type="submit" form="workOrderForm">创建工单</button>';
    openDialog({
      kicker: 'MES / WORK ORDER',
      title: '新建生产工单',
      sub: '工单将同时绑定 BOM、产线与设备；创建后进入待产状态，可开始报工。',
      body: body,
      footer: footer,
      size: 'modal--lg',
      onMount: function (overlay, close) {
        var form = overlay.querySelector('#workOrderForm');
        var productSelect = overlay.querySelector('#woProduct');
        var lineSelect = overlay.querySelector('#woLine');
        var bomInput = overlay.querySelector('#woBomVersion');
        var routingHint = overlay.querySelector('#woRoutingHint');
        var deviceGrid = overlay.querySelector('#woDeviceGrid');
        var deviceField = deviceGrid.parentElement;
        function syncProduct() {
          var bom = bomForProduct(productSelect.value);
          bomInput.value = bom ? bom.id + ' · ' + bom.version : '—';
          var routing = (Data.PRODUCT_ROUTINGS && Data.PRODUCT_ROUTINGS[productSelect.value]) || [];
          routingHint.textContent = routing.map(function (op) { return op.name; }).join(' → ') || '—';
          if (routing.length) {
            lineSelect.value = routing[0].lineId;
            deviceGrid.innerHTML = deviceChecklist(lineSelect.value);
          }
        }
        productSelect.addEventListener('change', syncProduct);
        lineSelect.addEventListener('change', function () {
          deviceGrid.innerHTML = deviceChecklist(lineSelect.value);
          deviceField.classList.remove('has-error');
        });
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          if (!form.reportValidity()) return;
          var fd = new FormData(form);
          var productId = String(fd.get('productId') || '');
          var product = productById(productId);
          var bom = bomForProduct(productId);
          var lineId = String(fd.get('lineId') || '');
          var deviceIds = Array.prototype.slice.call(form.querySelectorAll('input[name="deviceIds"]:checked'))
            .map(function (input) { return input.value; });
          var planQty = Number(fd.get('planQty'));
          var dueDate = String(fd.get('dueDate') || '');
          if (!product || !bom) return;
          if (!deviceIds.length) {
            deviceField.classList.add('has-error');
            deviceGrid.scrollIntoView({ block: 'nearest' });
            return;
          }
          if (!Number.isInteger(planQty) || planQty <= 0) {
            showToast('计划数量不合法', '请输入大于 0 的整数。', 'error');
            return;
          }
          var line = lineById(lineId) || {};
          var now = new Date().toISOString();
          var order = {
            id: workOrderNextId(),
            productId: productId,
            productName: product.name,
            productSku: product.sku,
            bomId: bom.id,
            bomVersion: bom.version,
            planQty: planQty,
            completedQty: 0,
            defectQty: 0,
            lineId: lineId,
            deviceIds: deviceIds,
            status: '待产',
            priority: String(fd.get('priority') || '中'),
            owner: line.owner || '王芳',
            startDate: U.formatDate(new Date()),
            dueDate: dueDate,
            createdAt: now,
            updatedAt: now,
            operations: Data.buildOperations(productId, 0, planQty),
            pauseReason: '',
            note: String(fd.get('note') || '').trim()
          };
          db.workOrders.unshift(order);
          state.productionQuery = '';
          state.productionStatus = '全部';
          state.productionLine = '';
          state.productionPage = 1;
          if (!saveDatabase()) return;
          close();
          navigateTo('production');
          showToast('生产工单已创建', order.id + ' · ' + product.name + ' · ' + planQty + ' 件 · ' + lineName(lineId), 'success');
        });
      }
    });
  }

  /** 报工：本次完成数 + 不良数，联动更新工单进度、工序进度、良率与设备产量 */
  function reportDialog(orderId) {
    var order = workOrderById(orderId);
    if (!order) return;
    var remaining = Math.max(0, order.planQty - order.completedQty);
    if (remaining <= 0) {
      showToast('该工单已完成', order.id + ' 计划数量已全部报工。', 'info');
      return;
    }
    var devices = (order.deviceIds || []).map(deviceById).filter(Boolean);
    var defaultQty = Math.min(remaining, Math.max(1, Math.round(remaining / 2)));
    var body = '<form id="reportForm" novalidate>' +
      '<div class="modal-product"><span class="modal-product__mark">' + icon('factory') + '</span>' +
      '<div class="modal-product__body"><div class="modal-product__name">' + e(order.id) + ' · ' + e(order.productName) + '</div>' +
      '<div class="modal-product__meta">' + e(order.bomId + ' · ' + order.bomVersion) + ' · ' + e(lineName(order.lineId)) + ' · 交期 ' + e(U.formatDate(order.dueDate)) + '</div></div>' +
      '<div class="modal-product__stock"><span>完成 / 计划</span><strong>' + U.formatNumber(order.completedQty) + ' / ' + U.formatNumber(order.planQty) + '</strong></div></div>' +
      '<div class="form-grid">' +
      '<div class="field" id="reportQtyField"><label for="reportQty">本次完成数 <span style="color:var(--danger)">*</span></label>' +
      '<input class="input" id="reportQty" name="qty" type="number" min="1" step="1" value="' + defaultQty + '" required data-autofocus>' +
      '<span class="field-error" id="reportQtyError">请输入 1 – ' + remaining + ' 之间的整数。</span></div>' +
      '<div class="field" id="reportDefectField"><label for="reportDefect">不良数量</label>' +
      '<input class="input" id="reportDefect" name="defectQty" type="number" min="0" step="1" value="0">' +
      '<span class="field-error" id="reportDefectError">不良数量不能大于本次完成数。</span></div>' +
      '<div class="field"><label for="reportDevice">报工设备</label><span class="select-wrap select-wrap--block">' +
      '<select class="select" id="reportDevice" name="deviceId">' +
      devices.map(function (device) {
        return '<option value="' + e(device.id) + '">' + e(device.code + ' · ' + device.name) + '</option>';
      }).join('') + '</select></span></div>' +
      '<div class="field"><label for="reportNote">备注 <span class="optional">选填</span></label>' +
      '<input class="input" id="reportNote" name="note" placeholder="如：白班报工 / 返修复测" maxlength="60"></div>' +
      '</div>' +
      '<div class="report-preview"><div class="report-preview__item"><span>报工后进度</span><b id="reportPreviewPct">—</b></div>' +
      '<div class="report-preview__item"><span>工单良率</span><b id="reportPreviewYield">—</b></div>' +
      '<div class="report-preview__item"><span>计划剩余</span><b id="reportPreviewRemain">—</b></div></div>' +
      '<div class="form-help" style="margin-top:8px;">报工会写入生产报表，并同步刷新设备详情中的今日 / 累计产量。</div>' +
      '</form>';
    var footer = '<span class="modal__foot-hint">' + icon('shield') + '报工后立即更新工单与设备数据</span>' +
      '<button class="btn btn--ghost" type="button" data-modal-close>取消</button>' +
      '<button class="btn btn--primary" type="submit" form="reportForm">确认报工</button>';
    openDialog({
      kicker: 'MES / REPORT',
      title: '工单报工',
      sub: '按本次良品完成数与不良数登记产出，工序进度将自动推进。',
      body: body,
      size: 'modal--md',
      footer: footer,
      onMount: function (overlay, close) {
        var form = overlay.querySelector('#reportForm');
        var qtyInput = overlay.querySelector('#reportQty');
        var defectInput = overlay.querySelector('#reportDefect');
        var qtyField = overlay.querySelector('#reportQtyField');
        var defectField = overlay.querySelector('#reportDefectField');
        var qtyError = overlay.querySelector('#reportQtyError');
        function syncPreview() {
          var qty = Number(qtyInput.value);
          var defect = Number(defectInput.value);
          if (!isFinite(qty) || qty < 0) qty = 0;
          if (!isFinite(defect) || defect < 0) defect = 0;
          var afterDone = order.completedQty + qty;
          var afterDefect = order.defectQty + defect;
          var pct = order.planQty ? Math.min(100, afterDone / order.planQty * 100) : 0;
          var total = afterDone + afterDefect;
          overlay.querySelector('#reportPreviewPct').textContent = pct.toFixed(1) + '%';
          overlay.querySelector('#reportPreviewYield').textContent = total ? (afterDone / total * 100).toFixed(1) + '%' : '—';
          overlay.querySelector('#reportPreviewRemain').textContent = Math.max(0, remaining - qty) + ' 件';
        }
        qtyInput.addEventListener('input', function () { qtyField.classList.remove('has-error'); syncPreview(); });
        defectInput.addEventListener('input', function () { defectField.classList.remove('has-error'); syncPreview(); });
        syncPreview();
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var qty = Number(qtyInput.value);
          var defect = Number(defectInput.value) || 0;
          if (!Number.isInteger(qty) || qty <= 0 || qty > remaining) {
            qtyField.classList.add('has-error');
            qtyError.textContent = '请输入 1 – ' + remaining + ' 之间的整数。';
            qtyInput.focus();
            return;
          }
          if (!Number.isInteger(defect) || defect < 0 || defect > qty) {
            defectField.classList.add('has-error');
            defectInput.focus();
            return;
          }
          var fd = new FormData(form);
          var deviceId = String(fd.get('deviceId') || (order.deviceIds[0] || ''));
          var now = new Date();
          order.completedQty += qty;
          order.defectQty += defect;
          order.updatedAt = now.toISOString();
          order.operations = Data.buildOperations(order.productId, order.completedQty, order.planQty);
          var currentOp = (order.operations || []).filter(function (op) { return op.status !== '已完成'; })[0] ||
            (order.operations || [])[order.operations.length - 1] || { code: 'OP10' };
          if (order.completedQty >= order.planQty) {
            order.completedQty = order.planQty;
          }
          db.productionReports.unshift({
            id: 'PR-' + Date.now(),
            workOrderId: order.id,
            deviceId: deviceId,
            operationCode: currentOp.code,
            qty: qty,
            defectQty: defect,
            operator: '王敏',
            at: now.toISOString(),
            note: String(fd.get('note') || '').trim() || '车间报工'
          });
          var finished = order.completedQty >= order.planQty;
          if (finished) {
            order.status = '已完工';
            order.pauseReason = '';
            order.operations = Data.buildOperations(order.productId, order.completedQty, order.planQty);
          }
          if (!saveDatabase()) return;
          close();
          renderViewWithoutScroll();
          var yieldNow = workOrderYield(order);
          showToast(finished ? '工单已完工' : '报工成功',
            order.id + ' +' + qty + ' 件' + (defect ? '（不良 ' + defect + ' 件）' : '') +
            ' · 进度 ' + workOrderProgress(order).toFixed(0) + '%' + (yieldNow == null ? '' : ' · 良率 ' + yieldNow.toFixed(1) + '%'),
            defect ? 'warning' : 'success');
        });
      }
    });
  }

  function pauseWorkOrder(orderId, options) {
    var order = workOrderById(orderId);
    if (!order || order.status !== '生产中') return;
    var opts = options || {};
    openConfirm({
      kicker: 'MES / PAUSE',
      title: '暂停生产工单',
      message: '即将暂停工单 <span class="confirm-highlight">' + e(order.id) + '</span>（' + e(order.productName) + '）。',
      note: opts.note || '暂停后工序不再流转，已报工产量保留，可在工单列表随时恢复。',
      confirmText: '暂停工单',
      onConfirm: function () {
        order.status = '已暂停';
        order.pauseReason = opts.reason || ('手动暂停 · ' + U.formatDateTime(new Date()));
        order.updatedAt = new Date().toISOString();
        if (!saveDatabase()) return;
        renderViewWithoutScroll();
        showToast('工单已暂停', order.id + ' 已停止流转，可在列表或详情中恢复。', 'warning');
      }
    });
  }

  function resumeWorkOrder(orderId) {
    var order = workOrderById(orderId);
    if (!order || order.status !== '已暂停') return;
    order.status = '生产中';
    order.pauseReason = '';
    order.updatedAt = new Date().toISOString();
    if (!saveDatabase()) return;
    renderViewWithoutScroll();
    showToast('工单已恢复生产', order.id + ' · ' + order.productName + ' 已重新进入生产中。', 'success');
  }

  function startWorkOrder(orderId) {
    var order = workOrderById(orderId);
    if (!order || order.status !== '待产') return;
    order.status = '生产中';
    order.startDate = U.formatDate(new Date());
    order.updatedAt = new Date().toISOString();
    if (!saveDatabase()) return;
    renderViewWithoutScroll();
    showToast('工单已开工', order.id + ' 已进入生产中，可以开始报工。', 'success');
  }

  function pauseAffectedWorkOrders() {
    var affected = affectedWorkOrders();
    if (!affected.length) {
      showToast('当前没有受影响的在产工单', '设备故障已解除或无生产中工单。', 'info');
      return;
    }
    openConfirm({
      kicker: 'MES / LINKAGE',
      title: '一键暂停受影响工单',
      message: '设备故障将影响 <span class="confirm-highlight">' + affected.length + '</span> 张在产工单：' +
        affected.map(function (order) { return e(order.id); }).join('、') + '。',
      note: '暂停后可在工单列表恢复；建议同步设备部抢修或调整排程。',
      confirmText: '全部暂停',
      onConfirm: function () {
        var now = new Date().toISOString();
        affected.forEach(function (order) {
          order.status = '已暂停';
          order.pauseReason = '设备故障联动暂停 · ' + U.formatDateTime(new Date());
          order.updatedAt = now;
        });
        if (!saveDatabase()) return;
        renderViewWithoutScroll();
        showToast('受影响工单已暂停', affected.length + ' 张工单已标记为已暂停，等待设备恢复。', 'warning');
      }
    });
  }

  /** 工单详情：工序进度（3–5 道）+ 绑定设备 + 报工记录 */
  function workOrderDetailDialog(orderId) {
    var order = workOrderById(orderId);
    if (!order) return;
    var affected = workOrderAffected(order);
    var pct = workOrderProgress(order);
    var yieldRate = workOrderYield(order);
    var ops = order.operations || [];
    var opSteps = ops.map(function (operation, index) {
      var cls = operation.status === '已完成' ? ' is-done' : operation.status === '进行中' ? ' is-doing' : '';
      var fillCls = operation.status === '已完成' ? ' op-step__fill--done' : operation.status === '进行中' ? ' op-step__fill--doing' : '';
      return '<div class="op-step' + cls + '">' +
        '<span class="op-step__index">' + (operation.status === '已完成' ? icon('check') : U.pad(index + 1)) + '</span>' +
        '<div class="op-step__body"><div class="op-step__title"><span>' + e(operation.code + ' · ' + operation.name) + '</span>' +
        '<span class="op-step__pct">' + operation.progress + '%</span></div>' +
        '<div class="op-step__meta">' + e(lineName(operation.lineId)) + ' · 标准工时 ' + operation.stdMinutes + ' 分钟 · ' + e(operation.status) + '</div>' +
        '<div class="op-step__bar"><span class="op-step__fill' + fillCls + '" style="width:' + Math.max(1, operation.progress) + '%"></span></div></div></div>';
    }).join('');
    var reports = (db.productionReports || []).filter(function (report) { return report.workOrderId === order.id; }).slice(0, 6);
    var reportHTML = reports.length ? reports.map(function (report) {
      var device = deviceById(report.deviceId);
      return '<div class="mes-list__item"><span class="mes-list__icon">' + icon('clipboard') + '</span>' +
        '<div class="mes-list__body"><div class="mes-list__title">报工 ' + report.qty + ' 件' + (report.defectQty ? ' · 不良 ' + report.defectQty + ' 件' : '') + '</div>' +
        '<div class="mes-list__meta">' + U.formatDateTime(report.at) + ' · ' + e(report.operationCode) + ' · ' + e(device ? device.code : '—') + ' · ' + e(report.operator) + '</div></div>' +
        '<span class="mes-list__value">+' + report.qty + '</span></div>';
    }).join('') : '<div class="form-help">暂无报工记录。</div>';
    var deviceChips = (order.deviceIds || []).map(function (id) { return deviceStatusChip(id); }).join('');
    var body = (affected ? '<div class="mes-alert-banner mes-alert-banner--modal">' +
      '<span class="mes-alert-banner__icon">' + icon('alert-triangle') + '</span>' +
      '<div class="mes-alert-banner__body"><div class="mes-alert-banner__title">该工单受设备故障影响</div>' +
      '<div class="mes-alert-banner__desc">绑定设备中存在故障设备，建议立即暂停工单并联系设备部处理。</div></div>' +
      '<div class="mes-alert-banner__actions"><button class="btn btn--danger btn--sm" type="button" data-wo-action="pause">' + icon('pause') + '暂停工单</button></div></div>' : '') +
      '<div class="device-hero' + (affected ? ' is-fault' : '') + '">' +
      '<span class="device-hero__mark">' + icon('factory') + '</span>' +
      '<div class="device-hero__body"><div class="device-hero__name">' + e(order.productName) + '</div>' +
      '<div class="device-hero__meta">' + e(order.id) + ' · ' + e(order.bomId + ' · ' + order.bomVersion) + ' · ' + e(lineCode(order.lineId) + ' · ' + lineName(order.lineId)) + ' · 负责人 ' + e(order.owner) + '</div></div>' +
      workOrderStatusBadge(order.status) + '</div>' +
      '<div class="wo-detail__summary">' +
      '<div class="wo-metric"><span>计划数量</span><strong>' + U.formatNumber(order.planQty) + '<small>件</small></strong></div>' +
      '<div class="wo-metric"><span>已完成</span><strong>' + U.formatNumber(order.completedQty) + '<small>件</small></strong></div>' +
      '<div class="wo-metric"><span>不良数量</span><strong style="color:' + (order.defectQty ? 'var(--danger)' : 'var(--text-strong)') + ';">' + U.formatNumber(order.defectQty) + '<small>件</small></strong></div>' +
      '<div class="wo-metric"><span>工单良率 / 进度</span><strong>' + (yieldRate == null ? '—' : yieldRate.toFixed(1) + '%') + '<small> · ' + pct.toFixed(0) + '%</small></strong></div>' +
      '</div>' +
      (order.status === '已暂停' && order.pauseReason ? '<div class="confirm-note" style="margin-bottom:14px;">' + icon('info') + '<span>暂停原因：' + e(order.pauseReason) + '</span></div>' : '') +
      '<div class="device-detail-grid">' +
      '<div class="mes-section"><div class="mes-section__head">工序进度<span>' + ops.length + ' 道工序</span></div><div class="op-steps">' + opSteps + '</div></div>' +
      '<div>' +
      '<div class="mes-section"><div class="mes-section__head">绑定设备<span>' + (order.deviceIds || []).length + ' 台</span></div>' +
      '<div class="mes-section__chips">' + (deviceChips || '<span class="form-help">未绑定设备</span>') + '</div>' +
      '<div class="detail-meta" style="margin-top:10px;">' +
      '<div class="detail-meta__row"><span>生产产线</span><strong>' + e(lineCode(order.lineId) + ' · ' + lineName(order.lineId)) + '</strong></div>' +
      '<div class="detail-meta__row"><span>计划交期</span><strong>' + e(U.formatDate(order.dueDate)) + (String(order.dueDate) < todayKey() && order.status !== '已完工' ? '（已逾期）' : '') + '</strong></div>' +
      '<div class="detail-meta__row"><span>开工日期</span><strong>' + e(U.formatDate(order.startDate)) + '</strong></div>' +
      '<div class="detail-meta__row"><span>工单状态</span><strong>' + e(order.status) + '</strong></div>' +
      '</div></div>' +
      '<div class="mes-section"><div class="mes-section__head">报工记录<span>最近 ' + reports.length + ' 条</span></div>' + reportHTML + '</div>' +
      '</div></div>';
    var canReport = order.status === '生产中' || order.status === '已暂停';
    var footer = '<span class="modal__foot-hint">' + icon('shield') + '报工与暂停操作会立即写入本机数据</span>' +
      '<button class="btn btn--ghost" type="button" data-modal-close>关闭</button>' +
      (order.status === '生产中'
        ? '<button class="btn btn--ghost" type="button" data-wo-action="pause">' + icon('pause') + '暂停工单</button>'
        : order.status === '已暂停'
          ? '<button class="btn btn--ghost" type="button" data-wo-action="resume">' + icon('play') + '恢复工单</button>'
          : '<button class="btn btn--primary" type="button" data-wo-action="start">' + icon('play') + '开工生产</button>') +
      (canReport ? '<button class="btn btn--primary" type="button" data-wo-action="report">' + icon('clipboard') + '报工</button>' : '');
    openDialog({
      kicker: 'MES / WORK ORDER DETAIL',
      title: order.id + ' · 工单明细',
      sub: '工序进度由累计完成数自动推导，报工后实时更新。',
      body: body,
      footer: footer,
      size: 'modal--lg',
      onMount: function (overlay, close) {
        overlay.addEventListener('click', function (event) {
          var button = event.target.closest('[data-wo-action]');
          if (!button) return;
          var action = button.getAttribute('data-wo-action');
          if (action === 'report') {
            reportDialog(order.id);
          } else if (action === 'pause') {
            close();
            pauseWorkOrder(order.id, { note: '从工单详情暂停该工单，已报工产量保留。' });
          } else if (action === 'resume') {
            close();
            resumeWorkOrder(order.id);
          } else if (action === 'start') {
            close();
            startWorkOrder(order.id);
          }
        });
      }
    });
  }


  /* =========================================================
   * 设备管理
   * ======================================================= */
  function filteredDevices() {
    var query = state.deviceQuery.trim().toLowerCase();
    var rows = (db.devices || []).filter(function (device) {
      var matchesStatus = state.deviceStatus === '全部' || device.status === state.deviceStatus;
      var matchesLine = !state.deviceLine || device.lineId === state.deviceLine;
      var matchesQuery = !query || [device.id, device.code, device.name, device.type, device.owner, device.note, device.status, lineName(device.lineId)]
        .some(function (value) { return String(value || '').toLowerCase().indexOf(query) !== -1; });
      return matchesStatus && matchesLine && matchesQuery;
    });
    return rows.sort(deviceSort);
  }

  function devicePageData() {
    var rows = filteredDevices();
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    state.devicePage = Math.min(Math.max(1, state.devicePage), pages);
    var start = (state.devicePage - 1) * PAGE_SIZE;
    return {
      rows: rows.slice(start, start + PAGE_SIZE),
      total: total,
      pages: pages,
      page: state.devicePage,
      start: total ? start + 1 : 0,
      end: Math.min(start + PAGE_SIZE, total)
    };
  }

  function deviceTabsHTML() {
    var counts = deviceStatusCounts();
    var tabs = ['全部'].concat(DEVICE_STATUSES);
    return tabs.map(function (status) {
      var count = status === '全部' ? (db.devices || []).length : counts[status];
      var active = state.deviceStatus === status;
      return '<button class="tab' + (active ? ' is-active' : '') + '" type="button" data-action="device-tab" data-status="' + e(status) + '"' +
        (active ? ' aria-selected="true"' : ' aria-selected="false"') + '>' + e(status) +
        '<span class="tab__count">' + count + '</span></button>';
    }).join('');
  }

  function deviceRelatedChips(deviceId) {
    var active = relatedWorkOrders(deviceId).filter(function (order) {
      return order.status === '生产中' || order.status === '已暂停';
    });
    if (!active.length) return '<span class="cell-sub">暂无在制工单</span>';
    return active.slice(0, 3).map(function (order) {
      return '<span class="device-chip device-chip--linked' + (workOrderAffected(order) ? ' device-chip--fault' : '') +
        '" title="' + e(order.productName + ' · ' + order.status) + '">' + e(order.id) + '</span>';
    }).join('');
  }

  function deviceRowsHTML(data) {
    if (!data.rows.length) {
      return tableEmpty(9, '没有符合条件的设备', '试试清空搜索关键词，或切换状态与产线筛选。', '');
    }
    return data.rows.map(function (device) {
      return '<tr class="device-row' + (device.status === '故障' ? ' is-fault' : '') + '" data-device-id="' + e(device.id) + '" tabindex="0" aria-label="查看设备 ' + e(device.name) + '">' +
        '<td><span class="id-tag">' + e(device.id) + '</span><div class="cell-sub">' + e(device.type) + '</div></td>' +
        '<td><div class="cell-primary">' + e(device.name) + '</div><div class="cell-sub">' + e(device.note) + '</div></td>' +
        '<td><div class="cell-primary" style="font-weight:500;">' + e(lineCode(device.lineId)) + '</div><div class="cell-sub">' + e(lineName(device.lineId)) + '</div></td>' +
        '<td>' + deviceStatusBadge(device.status) + '</td>' +
        '<td><span class="cell-mono">' + e(device.owner) + '</span></td>' +
        '<td><span class="cell-mono">' + e(U.formatDate(device.lastCheck)) + '</span></td>' +
        '<td><div class="device-chips">' + deviceRelatedChips(device.id) + '</div></td>' +
        '<td><div class="wo-progress"><div class="wo-progress__bar"><span class="wo-progress__fill' +
        (device.oee >= 85 ? ' wo-progress__fill--done' : device.oee < 70 ? ' wo-progress__fill--paused' : '') +
        '" style="width:' + Math.max(2, Number(device.oee) || 0).toFixed(1) + '%"></span></div>' +
        '<span class="wo-progress__value">' + Number(device.oee).toFixed(1) + '%</span></div></td>' +
        '<td><div class="row-actions">' +
        '<button class="row-action" type="button" data-action="device-detail" data-id="' + e(device.id) + '" title="设备详情" aria-label="查看设备 ' + e(device.name) + '">' + icon('eye') + '</button>' +
        '<button class="row-action" type="button" data-action="device-repair" data-id="' + e(device.id) + '" title="新增报修" aria-label="为设备 ' + e(device.name) + ' 报修">' + icon('wrench') + '</button>' +
        '</div></td></tr>';
    }).join('');
  }

  function deviceFooterHTML(data) {
    return '<div class="table-footer"><span class="table-footer__info">' +
      (data.total ? '显示 <strong>' + data.start + '–' + data.end + '</strong> 条，共 <strong>' + data.total + '</strong> 台设备' : '暂无匹配结果') +
      ' · 3 条产线 · 故障设备会同步标记受影响工单</span>' +
      pagination(data.page, data.pages, 'device-page', data.total) + '</div>';
  }

  function deviceBoardHTML() {
    return '<div class="device-board">' + LINES.map(function (line) {
      var devices = (db.devices || []).filter(function (device) { return device.lineId === line.id; });
      var running = devices.filter(function (device) { return device.status === '运行'; }).length;
      var oeeAvg = devices.length ? sumBy(devices, function (device) { return device.oee; }) / devices.length : 0;
      var cards = devices.map(function (device) {
        var meta = DEVICE_STATUS_META[device.status] || DEVICE_STATUS_META['待机'];
        var output = deviceOutput(device.id);
        var activeRelated = relatedWorkOrders(device.id).filter(function (order) {
          return order.status === '生产中' || order.status === '已暂停';
        }).length;
        return '<button class="device-card device-card--' + meta.cls + '" type="button" data-action="device-detail" data-id="' + e(device.id) + '" aria-label="查看设备 ' + e(device.name) + '">' +
          '<span class="device-card__top"><span class="device-card__status">' + e(device.status) + '</span>' +
          '<span class="device-card__oee">OEE ' + Number(device.oee).toFixed(1) + '%</span></span>' +
          '<span class="device-card__name">' + e(device.name) + '</span>' +
          '<span class="device-card__meta">' + e(device.type) + ' · 负责人 ' + e(device.owner) + '</span>' +
          '<span class="device-card__foot"><span>今日 <b>' + U.formatNumber(output.today) + '</b> 件</span>' +
          '<span>关联工单 <b>' + activeRelated + '</b></span></span></button>';
      }).join('');
      return '<section class="device-line"><div class="device-line__head">' +
        '<span class="device-line__title">' + e(line.name) + '</span>' +
        '<span class="device-line__code">' + e(line.code) + '</span>' +
        '<span class="device-line__stats"><span>运行 <strong>' + running + '/' + devices.length + '</strong></span>' +
        '<span>平均 OEE <strong>' + oeeAvg.toFixed(1) + '%</strong></span>' +
        '<span>负责人 <strong>' + e(line.owner) + '</strong></span></span></div>' +
        '<div class="device-cards">' + cards + '</div></section>';
    }).join('') + '</div>';
  }

  function renderDevices() {
    var data = devicePageData();
    var stats = deviceStats();
    var faultDevices = (db.devices || []).filter(function (device) { return device.status === '故障'; });
    var affected = affectedWorkOrders();
    var banner = '';
    if (faultDevices.length) {
      banner = '<section class="mes-alert-banner">' +
        '<span class="mes-alert-banner__icon">' + icon('alert-triangle') + '</span>' +
        '<div class="mes-alert-banner__body"><div class="mes-alert-banner__title">' + faultDevices.length + ' 台设备处于故障状态' +
        (affected.length ? ' · ' + affected.length + ' 张在产工单受影响' : '') + '</div>' +
        '<div class="mes-alert-banner__desc">' + faultDevices.map(function (device) {
          return e(device.code + ' ' + device.name + '（' + lineName(device.lineId) + '）');
        }).join('、') + ' 需要设备部跟进维修，完成后设备状态与受影响工单将自动恢复联动。</div></div>' +
        '<div class="mes-alert-banner__actions">' +
        '<button class="btn btn--danger btn--sm" type="button" data-action="device-detail" data-id="' + e(faultDevices[0].id) + '">' + icon('wrench') + '处理故障设备</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-action="go-production">' + icon('factory') + '查看受影响工单</button></div></section>';
    }

    var kpis = '<section class="kpi-grid kpi-grid--5" aria-label="设备核心指标">' +
      renderKpiCard({
        index: '01', featured: true, label: '设备总数', icon: 'chip',
        value: U.formatNumber(stats.total) + '<span class="kpi-value__unit">台</span>',
        foot: '<span class="kpi-compare kpi-compare--neutral">' + icon('layers') + LINES.length + ' 条自有产线 · 覆盖 5 类工序</span>',
        spark: sparkline([11, 12, 12, 13, 13, stats.total], 'var(--accent)')
      }) +
      renderKpiCard({
        index: '02', label: '运行中', icon: 'play', rgb: '10, 156, 126',
        value: U.formatNumber(stats.running) + '<span class="kpi-value__unit">台</span>',
        foot: '<span class="kpi-compare">' + icon('check-circle') + '运行率 ' + (stats.total ? (stats.running / stats.total * 100).toFixed(0) : 0) + '%</span>',
        spark: sparkline([7, 8, 8, 9, 8, stats.running], 'var(--success)')
      }) +
      renderKpiCard({
        index: '03', label: '待机 / 保养', icon: 'pause', rgb: '148, 162, 180',
        value: U.formatNumber(stats.idle + stats.maintenance) + '<span class="kpi-value__unit">台</span>',
        foot: '<span class="kpi-compare kpi-compare--neutral">' + icon('wrench') + '待机 ' + stats.idle + ' · 保养 ' + stats.maintenance + '</span>',
        spark: sparkline([2, 1, 2, 3, 2, stats.idle + stats.maintenance], 'var(--faint)')
      }) +
      renderKpiCard({
        index: '04', label: '故障设备', icon: 'alert-triangle', rgb: '217, 78, 78',
        value: U.formatNumber(stats.fault) + '<span class="kpi-value__unit">台</span>',
        foot: '<span class="kpi-compare kpi-compare--down">' + icon('alert-circle') + '受影响工单 ' + affected.length + ' 张</span>',
        spark: sparkline([0, 0, 1, 0, 0, stats.fault], 'var(--danger)')
      }) +
      renderKpiCard({
        index: '05', label: '平均 OEE', icon: 'gauge', rgb: '122, 90, 234',
        value: stats.avgOee.toFixed(1) + '<span class="kpi-value__unit">%</span>',
        foot: '<span class="kpi-compare kpi-compare--neutral">' + icon('target') + '目标 85% · 稼动率 91.2%</span>',
        spark: sparkline([78.2, 79.6, 80.8, 81.4, 81.9, stats.avgOee], 'var(--violet)')
      }) +
      '</section>';

    var lineOptions = optionTags(LINES.map(function (line) {
      return { value: line.id, label: line.code + ' · ' + line.name };
    }), state.deviceLine);

    var chartGrid = '<div class="mes-chart-grid">' +
      '<section class="panel donut-panel mes-chart-col-4">' +
      '<div class="panel__head"><div><div class="panel__kicker">EQUIPMENT / MIX</div><div class="panel__title">设备状态分布</div>' +
      '<div class="panel__sub">全部 ' + stats.total + ' 台设备</div></div></div>' +
      '<div class="donut-area mes-donut-area"><div class="chart-canvas-wrap"><canvas id="deviceStatusChart" role="img" aria-label="设备状态分布环形图"></canvas></div></div>' +
      '<div class="donut-legend">' + DEVICE_STATUSES.map(function (status) {
        var meta = DEVICE_STATUS_META[status];
        return '<div class="donut-legend__item"><span class="donut-legend__dot" style="background:' + meta.color + '"></span>' +
          '<span class="donut-legend__label">' + e(status) + '</span><span class="donut-legend__value">' + stats.counts[status] + '</span></div>';
      }).join('') + '</div></section>' +
      '<section class="panel mes-chart-col-8">' +
      '<div class="panel__head"><div><div class="panel__kicker">OEE / BY LINE</div><div class="panel__title">产线 OEE 与目标对比</div>' +
      '<div class="panel__sub">按产线上设备平均 OEE 计算 · 目标线 85%</div></div>' +
      '<div class="panel__tools"><span class="range-chip">' + icon('activity') + '实时设备数据</span></div></div>' +
      '<div class="mes-chart-area mes-chart-area--compact"><div class="chart-canvas-wrap"><canvas id="lineOeeChart" role="img" aria-label="产线平均 OEE 柱状图"></canvas></div></div>' +
      '<div class="panel-chart-footer"><div class="chart-legend">' +
      '<span class="chart-legend__item"><span class="chart-legend__dot" style="background:var(--primary)"></span>平均 OEE</span>' +
      '<span class="chart-legend__item"><span class="chart-legend__dot" style="background:var(--line-strong)"></span>目标 85%</span></div>' +
      '<span class="sales-footnote">' + icon('check-circle') + '故障 / 保养设备计入平均值</span></div></section></div>';

    var tablePanel = '<section class="panel panel--flush">' +
      '<div class="orders-toolbar"><div class="tabs" id="deviceTabs" role="tablist" aria-label="设备状态">' + deviceTabsHTML() + '</div>' +
      '<div class="orders-toolbar__aside">' +
      searchField(state.deviceQuery, '搜索设备编号、名称或负责人…', 'devices', 'clear-device-search') +
      '<span class="select-wrap"><select class="select filter-select" data-filter="device-line" aria-label="按产线筛选"><option value="">全部产线</option>' + lineOptions + '</select></span>' +
      '<button class="icon-reset" type="button" data-action="reset-device-filters">' + icon('refresh', 'icon--xs') + '重置</button>' +
      '<span class="order-hint">' + icon('info') + '点击设备行查看详情与运维记录</span></div></div>' +
      '<div class="table-scroll"><table class="data-table data-table--devices">' +
      '<thead><tr><th>设备编号</th><th>设备名称 / 类型</th><th>所属产线</th><th>状态</th><th>负责人</th><th>上次点检</th><th>关联工单</th><th>OEE</th><th>操作</th></tr></thead>' +
      '<tbody id="deviceTableBody">' + deviceRowsHTML(data) + '</tbody></table></div>' +
      '<div id="deviceTableFooter">' + deviceFooterHTML(data) + '</div></section>';

    return '<div class="page">' +
      pageHead(PAGE_META.devices.eyebrow, '设备管理',
        '覆盖 <strong>' + LINES.length + '</strong> 条产线 · 设备 <strong>' + stats.total + '</strong> 台 · 运行 <strong>' + stats.running + '</strong> 台 · 故障 <strong style="color:var(--danger);">' + stats.fault + '</strong> 台 · 平均 OEE <strong>' + stats.avgOee.toFixed(1) + '%</strong>',
        '<button class="btn btn--ghost" type="button" data-action="export-devices">' + icon('download') + '<span class="btn-label">导出设备台账</span></button>') +
      kpis + banner + deviceBoardHTML() + chartGrid + tablePanel + '</div>';
  }

  function refreshDeviceResults() {
    var tabs = $('deviceTabs');
    if (tabs) tabs.innerHTML = deviceTabsHTML();
    var body = $('deviceTableBody');
    if (!body) return;
    var data = devicePageData();
    body.innerHTML = deviceRowsHTML(data);
    var footer = $('deviceTableFooter');
    if (footer) footer.innerHTML = deviceFooterHTML(data);
  }

  function addDeviceLog(device, fields) {
    if (!Array.isArray(db.deviceLogs)) db.deviceLogs = [];
    db.deviceLogs.unshift({
      id: 'DL-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      deviceId: device.id,
      type: fields.type || '状态',
      title: fields.title || '设备状态更新',
      operator: fields.operator || '王敏',
      at: new Date().toISOString(),
      result: fields.result || '正常',
      statusFrom: fields.statusFrom || '',
      statusTo: fields.statusTo || '',
      note: fields.note || ''
    });
  }

  function mesSection(title, metaText, content) {
    return '<div class="mes-section"><div class="mes-section__head">' + e(title) + '<span>' + e(metaText) + '</span></div>' + content + '</div>';
  }

  function refreshDeviceDialog(deviceId, close) {
    if (close) close();
    renderViewWithoutScroll();
    deviceDialog(deviceId);
  }

  function setDeviceStatus(device, status, close) {
    if (DEVICE_STATUSES.indexOf(status) === -1 || device.status === status) return;
    var from = device.status;
    device.status = status;
    addDeviceLog(device, {
      type: '状态',
      title: '设备状态切换 · ' + from + ' → ' + status,
      result: status === '故障' ? '异常' : status === '保养中' ? '进行中' : '正常',
      statusFrom: from,
      statusTo: status,
      note: status === '故障' ? '设备管理页面手动标记故障，已自动创建维修工单。' : '设备管理页面手动切换设备状态。'
    });
    if (status === '故障') {
      var hasActiveRepair = (db.repairOrders || []).some(function (repair) {
        return repair.deviceId === device.id && (repair.status === '待派工' || repair.status === '维修中');
      });
      if (!hasActiveRepair) {
        if (!Array.isArray(db.repairOrders)) db.repairOrders = [];
        db.repairOrders.unshift({
          id: 'RO-' + Date.now(),
          deviceId: device.id,
          title: '设备故障报修 · ' + device.name,
          description: '设备状态由「' + from + '」切换为故障，请设备部排查处理。',
          status: '待派工',
          priority: '高',
          reporter: '王敏',
          assignee: '待派工',
          reportedAt: new Date().toISOString(),
          startedAt: null,
          finishedAt: null,
          solution: ''
        });
      }
    }
    if (status === '运行' && from === '故障') {
      (db.repairOrders || []).forEach(function (repair) {
        if (repair.deviceId !== device.id) return;
        if (repair.status !== '待派工' && repair.status !== '维修中') return;
        repair.status = '已完成';
        repair.assignee = repair.assignee && repair.assignee !== '待派工' ? repair.assignee : '王敏';
        repair.startedAt = repair.startedAt || new Date().toISOString();
        repair.finishedAt = new Date().toISOString();
        repair.solution = repair.solution || '现场处置后设备恢复运行。';
      });
    }
    if (!saveDatabase()) return;
    refreshDeviceDialog(device.id, close);
    showToast('设备状态已切换', device.code + '：' + from + ' → ' + status,
      status === '故障' ? 'warning' : status === '运行' ? 'success' : 'info');
  }

  function checkDevice(device, close) {
    device.lastCheck = U.formatDate(new Date());
    addDeviceLog(device, {
      type: '点检',
      title: '例行点检完成',
      result: '正常',
      note: '设备外观、安全防护、关键参数点检通过，可继续生产。'
    });
    if (!saveDatabase()) return;
    refreshDeviceDialog(device.id, close);
    showToast('点检记录已提交', device.code + ' · ' + device.lastCheck + ' · 点检结果正常', 'success');
  }

  function maintainDevice(device, planId, close) {
    var plan = (db.maintenancePlans || []).find(function (item) { return item.id === planId; });
    if (!plan) return;
    var now = new Date();
    if (!Array.isArray(db.maintenanceRecords)) db.maintenanceRecords = [];
    db.maintenanceRecords.unshift({
      id: 'MR-' + Date.now(),
      deviceId: device.id,
      name: plan.name,
      type: '保养',
      date: U.formatDate(now),
      operator: '王敏',
      result: '正常',
      note: plan.items
    });
    var next = new Date(now.getTime());
    next.setDate(next.getDate() + (plan.cycle === '每月' ? 30 : plan.cycle === '每季度' ? 90 : 365));
    plan.nextDate = U.formatDate(next);
    plan.status = '待执行';
    var from = device.status;
    if (device.status === '保养中') device.status = '运行';
    addDeviceLog(device, {
      type: '保养',
      title: '执行保养 · ' + plan.name,
      result: '正常',
      statusFrom: from,
      statusTo: device.status,
      note: plan.items
    });
    if (!saveDatabase()) return;
    refreshDeviceDialog(device.id, close);
    showToast('保养已完成', plan.name + ' · 下次保养 ' + plan.nextDate, 'success');
  }

  function assignRepair(repairId, close, deviceId) {
    var repair = (db.repairOrders || []).find(function (item) { return item.id === repairId; });
    if (!repair || repair.status !== '待派工') return;
    repair.status = '维修中';
    repair.assignee = '吴昊';
    repair.startedAt = new Date().toISOString();
    var device = deviceById(repair.deviceId);
    if (device) {
      addDeviceLog(device, {
        type: '维修',
        title: '维修派工 · ' + repair.title,
        result: '处理中',
        note: '设备部派工给维修技师 吴昊，开始现场处理。'
      });
    }
    if (!saveDatabase()) return;
    refreshDeviceDialog(deviceId || repair.deviceId, close);
    showToast('维修工单已派工', repair.id + ' · 处理人 吴昊', 'info');
  }

  function completeRepair(repairId, close, deviceId) {
    var repair = (db.repairOrders || []).find(function (item) { return item.id === repairId; });
    if (!repair || repair.status !== '维修中') return;
    repair.status = '已完成';
    repair.finishedAt = new Date().toISOString();
    repair.solution = repair.solution || '完成故障排查与部件更换，设备测试正常并恢复运行。';
    var device = deviceById(repair.deviceId);
    if (device) {
      var from = device.status;
      device.status = '运行';
      addDeviceLog(device, {
        type: '维修',
        title: '维修完成 · ' + repair.title,
        result: '正常',
        statusFrom: from,
        statusTo: '运行',
        note: repair.solution
      });
    }
    if (!saveDatabase()) return;
    refreshDeviceDialog(deviceId || repair.deviceId, close);
    showToast('维修完成，设备已恢复运行', repair.id + ' · ' + (device ? device.code : ''), 'success');
  }

  /** 设备报修表单：提交后设备状态置为故障，并生成待派工维修工单 */
  function deviceRepairDialog(deviceId) {
    var device = deviceById(deviceId);
    if (!device) return;
    var body = '<form id="deviceRepairForm" class="form-grid" novalidate>' +
      '<div class="modal-product"><span class="modal-product__mark">' + icon('wrench') + '</span>' +
      '<div class="modal-product__body"><div class="modal-product__name">' + e(device.name) + '</div>' +
      '<div class="modal-product__meta">' + e(device.id + ' · ' + device.type + ' · ' + lineName(device.lineId)) + '</div></div>' +
      '<div class="modal-product__stock"><span>当前状态</span><strong>' + e(device.status) + '</strong></div></div>' +
      '<div class="field field--full"><label for="repairTitle">故障现象 <span style="color:var(--danger)">*</span></label>' +
      '<input class="input" id="repairTitle" name="title" placeholder="如：回流焊温区 3 温度异常" maxlength="40" required data-autofocus></div>' +
      '<div class="field"><label for="repairPriority">优先级</label><span class="select-wrap select-wrap--block">' +
      '<select class="select" id="repairPriority" name="priority">' + optionTags(['高', '中', '低'], '高') + '</select></span></div>' +
      '<div class="field"><label>报修人</label><input class="input" value="王敏 · 运营总监" disabled></div>' +
      '<div class="field field--full"><label for="repairDescription">故障描述 <span class="optional">选填</span></label>' +
      '<textarea class="textarea" id="repairDescription" name="description" maxlength="160" placeholder="补充故障发生时间、报警信息与已采取的措施"></textarea></div>' +
      '<div class="field field--full"><span class="form-help">' + icon('info') + ' 提交后设备状态将变为「故障」，并生成待派工维修工单，生产端受影响的在产工单会立即标记为受影响。</span></div>' +
      '</form>';
    var footer = '<span class="modal__foot-hint">' + icon('alert-triangle') + '故障状态会联动生产工单</span>' +
      '<button class="btn btn--ghost" type="button" data-modal-close>取消</button>' +
      '<button class="btn btn--primary" type="submit" form="deviceRepairForm">提交报修</button>';
    openDialog({
      kicker: 'EQUIPMENT / REPAIR',
      title: '设备故障报修',
      sub: '报修将生成维修工单，并触发生产工单受影响预警。',
      body: body,
      footer: footer,
      size: 'modal--md',
      onMount: function (overlay, close) {
        var form = overlay.querySelector('#deviceRepairForm');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          if (!form.reportValidity()) return;
          var fd = new FormData(form);
          var title = String(fd.get('title') || '').trim();
          if (!title) return;
          if (!Array.isArray(db.repairOrders)) db.repairOrders = [];
          var repair = {
            id: 'RO-' + Date.now(),
            deviceId: device.id,
            title: title,
            description: String(fd.get('description') || '').trim() || '车间发现设备异常，已提交报修。',
            status: '待派工',
            priority: String(fd.get('priority') || '高'),
            reporter: '王敏',
            assignee: '待派工',
            reportedAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            solution: ''
          };
          db.repairOrders.unshift(repair);
          var from = device.status;
          device.status = '故障';
          addDeviceLog(device, {
            type: '维修',
            title: '设备报修 · ' + title,
            result: '异常',
            statusFrom: from,
            statusTo: '故障',
            note: repair.description
          });
          if (!saveDatabase()) return;
          close();
          renderViewWithoutScroll();
          deviceDialog(device.id);
          showToast('报修已提交', repair.id + ' · ' + title + ' · 等待设备部派工', 'warning');
        });
      }
    });
  }

  /** 设备详情：状态切换 / 关联工单（含受影响工单暂停）/ 点检 / 保养 / 维修工单 */
  function deviceDialog(deviceId) {
    var device = deviceById(deviceId);
    if (!device) return;
    var output = deviceOutput(device.id);
    var line = lineById(device.lineId) || { name: '—', code: '—' };
    var activeRelated = relatedWorkOrders(device.id).filter(function (order) {
      return order.status === '生产中' || order.status === '已暂停' || order.status === '待产';
    });
    var plans = (db.maintenancePlans || []).filter(function (plan) { return plan.deviceId === device.id; });
    var records = (db.maintenanceRecords || []).filter(function (record) { return record.deviceId === device.id; }).slice(0, 4);
    var repairs = (db.repairOrders || []).filter(function (repair) { return repair.deviceId === device.id; }).slice(0, 4);
    var logs = (db.deviceLogs || []).filter(function (log) { return log.deviceId === device.id; }).slice(0, 5);

    var hero = '<div class="device-hero' + (device.status === '故障' ? ' is-fault' : '') + '">' +
      '<span class="device-hero__mark">' + icon('chip') + '</span>' +
      '<div class="device-hero__body"><div class="device-hero__name">' + e(device.name) + '</div>' +
      '<div class="device-hero__meta">' + e(device.id + ' · ' + device.type + ' · ' + line.code + ' ' + line.name + ' · 负责人 ' + device.owner) + '</div></div>' +
      deviceStatusBadge(device.status) + '</div>';

    var metrics = '<div class="device-metrics">' +
      '<div class="device-metric"><span>今日产量</span><strong>' + U.formatNumber(output.today) + '<small>件</small></strong></div>' +
      '<div class="device-metric"><span>累计产量</span><strong>' + U.formatNumber(output.total) + '<small>件</small></strong></div>' +
      '<div class="device-metric"><span>OEE</span><strong>' + Number(device.oee).toFixed(1) + '<small>%</small></strong></div>' +
      '<div class="device-metric"><span>稼动率</span><strong>' + Number(device.availability).toFixed(1) + '<small>%</small></strong></div>' +
      '</div>';

    var statusActions = '<div class="device-status-actions"><span class="device-status-actions__label">状态切换</span>' +
      DEVICE_STATUSES.map(function (status) {
        var statusMeta = DEVICE_STATUS_META[status];
        var active = device.status === status;
        return '<button class="device-status-btn device-status-btn--' + statusMeta.cls + (active ? ' is-active' : '') +
          '" type="button" data-device-action="set-status" data-status="' + e(status) + '"' + (active ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' +
          (active ? icon('check') : '') + e(status) + '</button>';
      }).join('') +
      '<span class="form-help" style="margin-left:auto;">切换到故障会自动生成维修工单</span></div>';

    var relatedHTML = activeRelated.length ? activeRelated.map(function (order) {
      var affected = workOrderAffected(order);
      return '<div class="mes-list__item"><span class="mes-list__icon">' + icon('factory') + '</span>' +
        '<div class="mes-list__body"><div class="mes-list__title">' + e(order.id) + ' · ' + e(order.productName) +
        (affected ? ' <span class="wo-affected-tag">受影响</span>' : '') + '</div>' +
        '<div class="mes-list__meta">' + e(order.status) + ' · 进度 ' + workOrderProgress(order).toFixed(0) + '% · 交期 ' + e(U.formatDate(order.dueDate)) + '</div></div>' +
        (affected ? '<button class="mini-action mini-action--danger" type="button" data-device-action="pause-wo" data-id="' + e(order.id) + '">' + icon('pause') + '暂停</button>' : '') +
        '<button class="mini-action" type="button" data-device-action="open-wo" data-id="' + e(order.id) + '">明细</button></div>';
    }).join('') : '<div class="form-help">该设备暂无在制工单。</div>';

    var repairHTML = repairs.length ? repairs.map(function (repair) {
      var repairMeta = REPAIR_STATUS_META[repair.status] || REPAIR_STATUS_META['待派工'];
      var action = '';
      if (repair.status === '待派工') {
        action = '<button class="mini-action" type="button" data-device-action="assign-repair" data-id="' + e(repair.id) + '">派工</button>';
      } else if (repair.status === '维修中') {
        action = '<button class="mini-action mini-action--success" type="button" data-device-action="complete-repair" data-id="' + e(repair.id) + '">完成维修</button>';
      }
      return '<div class="mes-list__item"><span class="mes-list__icon">' + icon('wrench') + '</span>' +
        '<div class="mes-list__body"><div class="mes-list__title">' + e(repair.id) + ' · ' + e(repair.title) + '</div>' +
        '<div class="mes-list__meta">' + e(repair.priority) + '优先级 · 报修 ' + e(repair.reporter) + ' · ' + U.formatDateTime(repair.reportedAt) +
        (repair.status !== '待派工' ? ' · 处理人 ' + e(repair.assignee) : '') + '</div>' +
        (repair.solution ? '<div class="mes-list__meta">处理结果：' + e(repair.solution) + '</div>' : '') + '</div>' +
        '<span class="badge badge--' + repairMeta.badge + '">' + e(repair.status) + '</span>' + action + '</div>';
    }).join('') : '<div class="form-help">暂无维修工单。</div>';

    var planHTML = plans.length ? plans.map(function (plan) {
      return '<div class="mes-list__item"><span class="mes-list__icon">' + icon('calendar') + '</span>' +
        '<div class="mes-list__body"><div class="mes-list__title">' + e(plan.name) + '</div>' +
        '<div class="mes-list__meta">' + e(plan.cycle) + ' · 下次 ' + e(U.formatDate(plan.nextDate)) + ' · ' + e(plan.owner) + ' · ' + e(plan.status) + '</div>' +
        '<div class="mes-list__meta">' + e(plan.items) + '</div></div>' +
        '<button class="mini-action" type="button" data-device-action="maintain" data-id="' + e(plan.id) + '">执行保养</button></div>';
    }).join('') : '<div class="form-help">未配置保养计划。</div>';

    var recordHTML = records.length ? records.map(function (record) {
      return '<div class="mes-list__item"><span class="mes-list__icon">' + icon('check-circle') + '</span>' +
        '<div class="mes-list__body"><div class="mes-list__title">' + e(record.name) + '</div>' +
        '<div class="mes-list__meta">' + e(record.type) + ' · ' + e(record.date) + ' · ' + e(record.operator) + ' · ' + e(record.result) + '</div>' +
        '<div class="mes-list__meta">' + e(record.note) + '</div></div></div>';
    }).join('') : '<div class="form-help">暂无保养记录。</div>';

    var logHTML = logs.length ? logs.map(function (log) {
      var logIcon = log.type === '点检' ? 'clipboard' : log.type === '保养' ? 'wrench' : log.type === '维修' ? 'wrench' : 'activity';
      return '<div class="mes-list__item"><span class="mes-list__icon">' + icon(logIcon) + '</span>' +
        '<div class="mes-list__body"><div class="mes-list__title">' + e(log.title) + '</div>' +
        '<div class="mes-list__meta">' + e(log.type) + ' · ' + e(log.operator) + ' · ' + U.formatDateTime(log.at) + ' · ' + e(log.result) + '</div>' +
        (log.note ? '<div class="mes-list__meta">' + e(log.note) + '</div>' : '') + '</div></div>';
    }).join('') : '<div class="form-help">暂无点检记录。</div>';

    var body = hero + metrics + statusActions +
      '<div class="device-detail-grid">' +
      '<div>' +
      mesSection('关联在制工单', activeRelated.length + ' 张', relatedHTML) +
      mesSection('维修工单', repairs.length + ' 条',
        '<div class="device-actions-row"><button class="btn btn--ghost btn--sm" type="button" data-device-action="repair">' + icon('wrench') + '新增报修</button></div>' + repairHTML) +
      '</div><div>' +
      mesSection('保养计划', plans.length + ' 项', planHTML) +
      mesSection('保养记录', records.length + ' 条', recordHTML) +
      mesSection('点检记录', logs.length + ' 条',
        '<div class="device-actions-row"><button class="btn btn--ghost btn--sm" type="button" data-device-action="check">' + icon('clipboard') + '立即点检</button></div>' + logHTML) +
      '</div></div>';

    var footer = '<span class="modal__foot-hint">' + icon('shield') + '设备操作会写入点检 / 维修日志并更新生产联动</span>' +
      '<button class="btn btn--ghost" type="button" data-modal-close>关闭</button>' +
      '<button class="btn btn--primary" type="button" data-device-action="repair">' + icon('wrench') + '新增报修</button>';

    openDialog({
      kicker: 'EQUIPMENT / DETAIL',
      title: device.code + ' · 设备详情',
      sub: '状态切换、点检、保养与维修工单都会同步生产工单的受影响状态。',
      body: body,
      footer: footer,
      size: 'modal--xl',
      onMount: function (overlay, close) {
        overlay.addEventListener('click', function (event) {
          var button = event.target.closest('[data-device-action]');
          if (!button) return;
          var action = button.getAttribute('data-device-action');
          if (action === 'set-status') {
            setDeviceStatus(device, button.getAttribute('data-status'), close);
          } else if (action === 'check') {
            checkDevice(device, close);
          } else if (action === 'maintain') {
            maintainDevice(device, button.getAttribute('data-id'), close);
          } else if (action === 'repair') {
            deviceRepairDialog(device.id);
          } else if (action === 'assign-repair') {
            assignRepair(button.getAttribute('data-id'), close, device.id);
          } else if (action === 'complete-repair') {
            completeRepair(button.getAttribute('data-id'), close, device.id);
          } else if (action === 'pause-wo') {
            close();
            pauseWorkOrder(button.getAttribute('data-id'), { note: '设备故障导致工单受影响，从设备详情直接暂停。' });
          } else if (action === 'open-wo') {
            close();
            var orderId = button.getAttribute('data-id');
            state.productionStatus = '全部';
            state.productionLine = '';
            state.productionQuery = '';
            navigateTo('production');
            window.setTimeout(function () { workOrderDetailDialog(orderId); }, 160);
          }
        });
      }
    });
  }

  /* =========================================================
   * 系统设置
   * ======================================================= */
  function renderSettings() {
    var company = db.company || {};
    var theme = currentTheme();
    var dataSize = 0;
    try { dataSize = new Blob([JSON.stringify(db)]).size; } catch (err) { dataSize = 0; }
    var sizeText = dataSize ? (dataSize / 1024).toFixed(1) + ' KB' : '—';
    return '<div class="page">' +
      pageHead(PAGE_META.settings.eyebrow, '系统设置',
        '管理工作空间资料、外观主题与本地演示数据。所有设置即时生效。',
        '<span class="welcome-date">' + icon('shield') + '本地演示环境 · 无后端连接</span>') +
      '<div class="settings-grid">' +
      '<section class="panel settings-card">' +
      '<div class="panel__head panel__head--bordered"><div><div class="panel__kicker">COMPANY PROFILE</div><div class="panel__title">公司信息</div>' +
      '<div class="panel__sub">用于页面展示与订单抬头，保存后立即写入本机存储。</div></div><div class="panel__tools"><span class="range-chip">' + icon('building') + '企业资料</span></div></div>' +
      '<div class="settings-card__body"><form class="settings-form" id="companyForm">' +
      '<div class="form-grid">' +
      '<div class="field field--full"><label for="companyName">公司名称 <span style="color:var(--danger)">*</span></label><input class="input" id="companyName" name="name" value="' + e(company.name) + '" required maxlength="60"></div>' +
      '<div class="field"><label for="companyCode">统一社会信用代码</label><input class="input" id="companyCode" name="creditCode" value="' + e(company.creditCode) + '" maxlength="30"></div>' +
      '<div class="field"><label for="companyIndustry">所属行业</label><input class="input" id="companyIndustry" name="industry" value="' + e(company.industry) + '" maxlength="40"></div>' +
      '<div class="field"><label for="companyScale">公司规模</label><input class="input" id="companyScale" name="scale" value="' + e(company.scale) + '" maxlength="30"></div>' +
      '<div class="field"><label for="companyContact">联系人</label><input class="input" id="companyContact" name="contact" value="' + e(company.contact) + '" maxlength="20"></div>' +
      '<div class="field"><label for="companyPhone">联系电话</label><input class="input" id="companyPhone" name="phone" value="' + e(company.phone) + '" maxlength="30"></div>' +
      '<div class="field"><label for="companyEmail">电子邮箱</label><input class="input" id="companyEmail" name="email" type="email" value="' + e(company.email) + '"></div>' +
      '<div class="field"><label for="companyWebsite">官方网站</label><input class="input" id="companyWebsite" name="website" value="' + e(company.website) + '" maxlength="60"></div>' +
      '<div class="field"><label for="companyAddress">办公地址</label><input class="input" id="companyAddress" name="address" value="' + e(company.address) + '" maxlength="100"></div>' +
      '<div class="field field--full"><label for="companyIntro">公司简介</label><textarea class="textarea" id="companyIntro" name="intro" maxlength="280">' + e(company.intro) + '</textarea><span class="form-help">将用于演示工作空间中的企业信息展示，建议控制在 120 字以内。</span></div>' +
      '</div>' +
      '<div class="settings-actions"><span class="settings-actions__hint">' + icon('shield') + '数据仅保存在当前浏览器</span>' +
      '<div class="settings-actions__buttons"><button class="btn btn--ghost" type="reset">恢复修改</button>' +
      '<button class="btn btn--primary" type="submit">' + icon('check') + '保存公司信息</button></div></div>' +
      '</form></div></section>' +
      '<aside class="settings-side">' +
      '<section class="panel settings-card">' +
      '<div class="panel__head panel__head--bordered"><div><div class="panel__kicker">APPEARANCE</div><div class="panel__title">外观主题</div><div class="panel__sub">选择适合当前环境的界面风格。</div></div></div>' +
      '<div class="settings-card__body"><div class="theme-options">' +
      '<button class="theme-option' + (theme === 'light' ? ' is-active' : '') + '" type="button" data-action="theme-choice" data-theme-choice="light" aria-pressed="' + (theme === 'light') + '">' +
      '<span class="theme-option__check">' + icon('check') + '</span>' +
      '<span class="theme-option__preview theme-preview--light"><span class="theme-preview__side"></span><span class="theme-preview__body"><span class="theme-preview__line" style="width:65%"></span><span class="theme-preview__line" style="width:40%"></span><span class="theme-preview__cards"><span class="theme-preview__card"></span><span class="theme-preview__card"></span><span class="theme-preview__card"></span></span></span></span>' +
      '<span class="theme-option__label">浅色模式' + icon('sun') + '</span></button>' +
      '<button class="theme-option' + (theme === 'dark' ? ' is-active' : '') + '" type="button" data-action="theme-choice" data-theme-choice="dark" aria-pressed="' + (theme === 'dark') + '">' +
      '<span class="theme-option__check">' + icon('check') + '</span>' +
      '<span class="theme-option__preview theme-preview--dark"><span class="theme-preview__side"></span><span class="theme-preview__body"><span class="theme-preview__line" style="width:65%"></span><span class="theme-preview__line" style="width:40%"></span><span class="theme-preview__cards"><span class="theme-preview__card"></span><span class="theme-preview__card"></span><span class="theme-preview__card"></span></span></span></span>' +
      '<span class="theme-option__label">深色模式' + icon('moon') + '</span></button>' +
      '</div><p class="settings-block__desc" style="margin-top:12px;">主题偏好会保存到本机，下次打开时自动恢复。</p></div></section>' +
      '<section class="panel settings-card">' +
      '<div class="panel__head panel__head--bordered"><div><div class="panel__kicker">LOCAL DATA</div><div class="panel__title">演示数据</div><div class="panel__sub">数据以 localStorage 形式保存在本机浏览器。</div></div></div>' +
      '<div class="settings-card__body">' +
      '<div class="settings-data-row"><span>员工记录</span><strong>' + db.employees.length + ' 人</strong></div>' +
      '<div class="settings-data-row"><span>客户记录</span><strong>' + db.customers.length + ' 家</strong></div>' +
      '<div class="settings-data-row"><span>订单记录</span><strong>' + db.orders.length + ' 笔</strong></div>' +
      '<div class="settings-data-row"><span>商品记录</span><strong>' + db.products.length + ' 个 SKU</strong></div>' +
      '<div class="settings-data-row"><span>生产工单 / BOM</span><strong>' + db.workOrders.length + ' 张 / ' + db.boms.length + ' 个</strong></div>' +
      '<div class="settings-data-row"><span>设备 / 维修工单</span><strong>' + db.devices.length + ' 台 / ' + db.repairOrders.length + ' 条</strong></div>' +
      '<div class="settings-data-row"><span>数据占用</span><strong>' + e(sizeText) + '</strong></div>' +
      '<div class="settings-data-actions"><button class="btn btn--ghost btn--sm" type="button" data-action="export-backup">' + icon('download') + '导出数据备份</button>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-action="export-dashboard">' + icon('file-text') + '导出经营简报</button></div>' +
      '<div class="settings-danger-zone"><div class="settings-danger-zone__title">' + icon('alert-triangle') + '重置演示数据</div>' +
      '<p>恢复初始的 25 位员工、10 张生产工单、13 台设备、12 家客户、20 笔订单与 12 个商品。当前所有本地修改将被覆盖。</p>' +
      '<button class="btn btn--danger btn--sm" type="button" data-action="reset-demo">重置为初始数据</button></div>' +
      '<div class="settings-meta">' + icon('database') + '<span>种子版本 v' + Data.SEED_VERSION + ' · 本地持久化 · 不连接真实后端</span></div>' +
      '</div></section>' +
      '</aside>' +
      '</div></div>';
  }

  /* =========================================================
   * 自绘图表
   * ======================================================= */
  function cssVar(name, fallback) {
    var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function drawDashboardCharts() {
    var lineCanvas = $('salesTrendChart');
    var donutCanvas = $('orderDonutChart');
    if (!lineCanvas && !donutCanvas && !$('deviceStatusDonut')) return;
    var months = U.recentMonths(6);
    var values = months.map(function (month) { return salesForMonth(month.key); });
    if (lineCanvas) {
      Charts.line(lineCanvas, {
        labels: months.map(function (month) { return month.label; }),
        values: values,
        formatValue: function (value) { return '¥' + U.formatCompactMoney(value); },
        valueSubLabel: '全渠道销售额'
      });
    }
    if (donutCanvas) {
      var counts = orderStatusCounts();
      Charts.donut(donutCanvas, {
        centerLabel: '订单总量',
        segments: ORDER_STATUSES.map(function (status) {
          return { label: status, value: counts[status], color: ORDER_STATUS_META[status].color };
        })
      });
    }
    var deviceCanvas = $('deviceStatusDonut');
    if (deviceCanvas) {
      var deviceCounts = deviceStatusCounts();
      Charts.donut(deviceCanvas, {
        centerLabel: '设备总数',
        segments: DEVICE_STATUSES.map(function (status) {
          return { label: status, value: deviceCounts[status], color: DEVICE_STATUS_META[status].color };
        })
      });
    }
  }

  function drawProductionCharts() {
    var canvas = $('productionTrendChart');
    if (!canvas) return;
    var daily = dailyOutput(12);
    Charts.bars(canvas, {
      labels: daily.map(function (item) { return item.label; }),
      series: [
        {
          name: '良品产量',
          color: cssVar('--primary', '#2f63e8'),
          values: daily.map(function (item) { return item.good; })
        },
        {
          name: '不良数量',
          color: cssVar('--danger', '#d94e4e'),
          values: daily.map(function (item) { return item.defect; })
        }
      ],
      formatValue: function (value) { return U.formatNumber(value) + ' 件'; }
    });
  }

  function drawDeviceCharts() {
    var donutCanvas = $('deviceStatusChart');
    var barCanvas = $('lineOeeChart');
    if (donutCanvas) {
      var counts = deviceStatusCounts();
      Charts.donut(donutCanvas, {
        centerLabel: '设备总数',
        segments: DEVICE_STATUSES.map(function (status) {
          return { label: status, value: counts[status], color: DEVICE_STATUS_META[status].color };
        })
      });
    }
    if (barCanvas) {
      Charts.bars(barCanvas, {
        labels: LINES.map(function (line) { return line.code; }),
        series: [
          {
            name: '平均 OEE',
            color: cssVar('--primary', '#2f63e8'),
            values: LINES.map(function (line) {
              var devices = (db.devices || []).filter(function (device) { return device.lineId === line.id; });
              return devices.length ? sumBy(devices, function (device) { return device.oee; }) / devices.length : 0;
            })
          },
          {
            name: '目标 85%',
            color: cssVar('--line-strong', '#d2ddea'),
            ghost: true,
            values: LINES.map(function () { return 85; })
          }
        ],
        formatValue: function (value) { return Number(value).toFixed(1) + '%'; }
      });
    }
  }

  function drawReportChart() {
    var canvas = $('reportBarChart');
    if (!canvas) return;
    var report = reportBaseData(state.reportMonth, state.reportUnit);
    Charts.bars(canvas, {
      labels: report.rows.map(function (row) { return row.unit; }),
      series: [
        {
          name: '实际销售额',
          color: cssVar('--primary', '#2f63e8'),
          values: report.rows.map(function (row) { return row.actual; })
        },
        {
          name: '月度目标',
          color: cssVar('--line-strong', '#d2ddea'),
          ghost: true,
          values: report.rows.map(function (row) { return row.target; })
        }
      ],
      formatValue: function (value) { return '¥' + U.formatCompactMoney(value); }
    });
  }

  function drawCurrentCharts() {
    if (!session) return;
    if (state.view === 'dashboard') drawDashboardCharts();
    if (state.view === 'production') drawProductionCharts();
    if (state.view === 'devices') drawDeviceCharts();
    if (state.view === 'reports') drawReportChart();
  }

  function redrawCurrentCharts() {
    drawCurrentCharts();
  }

  /* =========================================================
   * 弹窗 / 表单
   * ======================================================= */
  /** 打开统一风格弹窗，支持自定义主体、底部按钮、焦点收拢与 Esc 关闭 */
  function openDialog(options) {
    var root = $('modalRoot');
    lastModalFocus = document.activeElement;
    var sizeClass = options.size ? ' ' + options.size : '';
    root.innerHTML = '<div class="modal-backdrop" data-modal-backdrop>' +
      '<div class="modal' + sizeClass + '" role="dialog" aria-modal="true" aria-labelledby="modalTitle">' +
      '<div class="modal__head">' +
      '<div class="modal__kicker">' + e(options.kicker || 'ZHIHUI ERP') + '</div>' +
      '<h2 class="modal__title" id="modalTitle">' + e(options.title) + '</h2>' +
      (options.sub ? '<p class="modal__sub">' + e(options.sub) + '</p>' : '') +
      '<button class="modal__close" type="button" data-modal-close aria-label="关闭弹窗">' + icon('close') + '</button>' +
      '</div>' +
      '<div class="modal__body">' + options.body + '</div>' +
      (options.footer ? '<div class="modal__foot">' + options.footer + '</div>' : '') +
      '</div></div>';
    var overlay = root.querySelector('.modal-backdrop');
    function close() {
      if (!root.childElementCount) return;
      root.innerHTML = '';
      syncBodyLock();
      if (lastModalFocus && typeof lastModalFocus.focus === 'function') {
        lastModalFocus.focus({ preventScroll: true });
      }
    }
    root.setAttribute('data-open', 'true');
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay || event.target.closest('[data-modal-close]')) {
        close();
      }
    });
    overlay.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab') return;
      var focusables = Array.prototype.slice.call(overlay.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )).filter(function (element) {
        return element.offsetParent !== null;
      });
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    syncBodyLock();
    if (options.onMount) options.onMount(overlay, close);
    window.requestAnimationFrame(function () {
      var focusTarget = overlay.querySelector('[data-autofocus]') ||
        overlay.querySelector('.modal__body input:not([type="hidden"]), .modal__body select, .modal__body textarea') ||
        overlay.querySelector('.modal__foot .btn') ||
        overlay.querySelector('.modal__close');
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    });
    return { overlay: overlay, close: close };
  }

  function closeModal() {
    var root = $('modalRoot');
    if (!root || !root.childElementCount) {
      syncBodyLock();
      return;
    }
    root.innerHTML = '';
    syncBodyLock();
  }

  function openConfirm(options) {
    var body = '<div class="confirm-body">' +
      '<span class="confirm-icon">' + icon('alert-triangle') + '</span>' +
      '<div class="confirm-copy">' + options.message +
      (options.note ? '<div class="confirm-note">' + icon('info') + '<span>' + e(options.note) + '</span></div>' : '') +
      '</div></div>';
    var footer = '<button class="btn btn--ghost" type="button" data-modal-close>取消</button>' +
      '<button class="btn btn--danger" type="button" data-confirm-accept>' + e(options.confirmText || '确认删除') + '</button>';
    openDialog({
      kicker: options.kicker || 'CONFIRMATION',
      title: options.title,
      sub: '此操作需要你的确认。',
      body: body,
      footer: footer,
      size: 'modal--sm',
      onMount: function (overlay, close) {
        overlay.querySelector('[data-confirm-accept]').addEventListener('click', function () {
          close();
          if (options.onConfirm) options.onConfirm();
        });
      }
    });
  }

  function announcementById(id) {
    return db.announcements.find(function (item) { return item.id === id; });
  }

  function openNotice(id) {
    var notice = announcementById(id);
    if (!notice) return;
    openDialog({
      kicker: 'BULLETIN / ' + notice.category,
      title: notice.title,
      sub: '公司公告 · ' + U.formatDate(notice.date),
      body: '<div class="notice-detail__meta"><span class="notice-cat">' + e(notice.category) + '</span>' +
        '<span>发布于 ' + e(U.formatDate(notice.date)) + '</span>' +
        (notice.pinned ? '<span class="badge badge--warning badge--plain">' + icon('pin', 'icon--xs') + '置顶</span>' : '') +
        '</div><div class="notice-detail__body">' + e(notice.content) + '</div>',
      footer: '<button class="btn btn--ghost" type="button" data-modal-close>关闭</button>' +
        '<button class="btn btn--primary" type="button" data-modal-close>知道了</button>',
      size: 'modal--md'
    });
  }

  function openAllNotices() {
    var list = db.announcements.slice().sort(function (a, b) {
      return (Number(b.pinned) - Number(a.pinned)) || (new Date(b.date) - new Date(a.date));
    });
    var body = '<div class="notice-archive">' + list.map(function (notice) {
      return '<button class="notice-archive__item" type="button" data-archive-notice="' + e(notice.id) + '">' +
        '<span class="notice-archive__icon">' + icon('file-text') + '</span>' +
        '<span class="notice-archive__body"><span class="notice-archive__title">' + e(notice.title) + '</span>' +
        '<span class="notice-meta"><span class="notice-cat">' + e(notice.category) + '</span><span class="notice-date">' + e(U.formatDate(notice.date)) + '</span>' +
        (notice.pinned ? '<span class="notice-pin" style="display:inline-grid;width:16px;height:16px;">' + icon('pin') + '</span>' : '') +
        '</span></span><span class="notice-arrow" style="opacity:1;">' + icon('chevron-right') + '</span></button>';
    }).join('') + '</div>';
    openDialog({
      kicker: 'BULLETIN / ARCHIVE',
      title: '全部公司公告',
      sub: '共 ' + list.length + ' 条公告 · 按置顶与时间排序',
      body: body,
      footer: '<button class="btn btn--ghost" type="button" data-modal-close>关闭</button>',
      size: 'modal--md',
      onMount: function (overlay) {
        overlay.querySelectorAll('[data-archive-notice]').forEach(function (button) {
          button.addEventListener('click', function () {
            openNotice(button.getAttribute('data-archive-notice'));
          });
        });
      }
    });
  }

  /* =========================================================
   * 通知 / 全局搜索
   * ======================================================= */
  function getNotifications() {
    var stock = lowStockProducts();
    var shipping = pendingShipments();
    var payments = pendingPayments();
    var faultDevices = (db.devices || []).filter(function (device) { return device.status === '故障'; });
    var affected = affectedWorkOrders();
    var list = [];
    if (faultDevices.length) {
      list.push({
        key: 'device',
        tone: 'danger',
        icon: 'alert-triangle',
        title: faultDevices.length + ' 台设备故障' + (affected.length ? '，' + affected.length + ' 张在产工单受影响' : ''),
        desc: faultDevices.slice(0, 2).map(function (device) { return device.code + ' ' + device.name; }).join('、') + ' 等待维修处理',
        time: '刚刚 · 设备状态监控',
        view: 'devices'
      });
    }
    if (stock.length) {
      list.push({
        key: 'stock',
        tone: 'warning',
        icon: 'alert-triangle',
        title: stock.length + ' 个 SKU 低于安全库存',
        desc: stock.slice(0, 2).map(function (item) { return item.name; }).join('、') + ' 等商品需尽快补货',
        time: '刚刚 · 库存健康监控',
        view: 'inventory'
      });
    }
    if (shipping.length) {
      list.push({
        key: 'shipping',
        tone: 'info',
        icon: 'outbound',
        title: shipping.length + ' 笔订单等待发货',
        desc: '今日需优先处理 ' + Math.min(2, shipping.length) + ' 笔，避免影响客户交付节点',
        time: '12 分钟前 · 履约提醒',
        view: 'orders',
        status: '待发货'
      });
    }
    if (payments.length) {
      list.push({
        key: 'payment',
        tone: 'danger',
        icon: 'wallet',
        title: payments.length + ' 笔订单待确认付款',
        desc: '涉及应收金额 ' + U.formatMoney(sumBy(payments, function (order) { return order.amount; })) + '，请跟进回款',
        time: '32 分钟前 · 财务协同',
        view: 'orders',
        status: '待付款'
      });
    }
    return list;
  }

  function renderNotifications() {
    var list = $('notificationList');
    if (!list) return;
    var notifications = getNotifications();
    list.innerHTML = notifications.map(function (item) {
      return '<button class="notification-item notification-item--' + item.tone + '" type="button" data-notification="' + e(item.key) + '">' +
        '<span class="notification-item__icon">' + icon(item.icon) + '</span>' +
        '<span class="notification-item__body"><span class="notification-item__title">' + e(item.title) + '</span>' +
        '<span class="notification-item__desc">' + e(item.desc) + '</span><span class="notification-item__time">' + e(item.time) + '</span></span>' +
        (state.notificationsRead ? '' : '<span class="notification-unread"></span>') + '</button>';
    }).join('');
    var sub = $('notificationSub');
    if (sub) sub.textContent = state.notificationsRead ? '所有经营动态均已查看' : notifications.length + ' 条经营动态待查看';
    var toggle = $('notificationToggle');
    if (toggle) toggle.classList.toggle('has-dot', !state.notificationsRead);
  }

  function markNotificationsRead() {
    state.notificationsRead = true;
    Data.writeLocal(NOTICE_KEY, '1');
    renderNotifications();
    updateBadges();
    showToast('通知已全部标为已读', '', 'success');
  }

  function closePopovers() {
    var panel = $('notificationPanel');
    var menu = $('userMenu');
    var notifToggle = $('notificationToggle');
    var userToggle = $('userMenuToggle');
    if (panel) panel.hidden = true;
    if (menu) menu.hidden = true;
    if (notifToggle) notifToggle.setAttribute('aria-expanded', 'false');
    if (userToggle) userToggle.setAttribute('aria-expanded', 'false');
  }

  function searchResult(kind, id, title, meta, iconName) {
    return '<button class="command-result" type="button" data-search-kind="' + e(kind) + '" data-search-id="' + e(id) + '">' +
      '<span class="command-result__icon">' + icon(iconName) + '</span>' +
      '<span class="command-result__body"><span class="command-result__title">' + e(title) + '</span>' +
      '<span class="command-result__meta">' + e(meta) + '</span></span>' +
      '<span class="command-result__hint">↵</span></button>';
  }

  /** 全站搜索：聚合功能入口、员工、客户、订单与商品结果 */
  function buildSearchGroups(query) {
    var q = String(query || '').trim().toLowerCase();
    var groups = [];
    if (!q) {
      groups.push({
        label: '快速前往',
        html: NAV_ITEMS.map(function (item) {
          return searchResult('page', item.view, item.label, item.desc, item.icon);
        }).join('')
      });
      return groups;
    }
    var pages = NAV_ITEMS.filter(function (item) {
      return (item.label + ' ' + item.desc + ' ' + item.keywords).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 5);
    if (pages.length) {
      groups.push({
        label: '功能',
        html: pages.map(function (item) { return searchResult('page', item.view, item.label, item.desc, item.icon); }).join('')
      });
    }
    var employees = db.employees.filter(function (item) {
      return [item.id, item.name, item.dept, item.title, item.email].join(' ').toLowerCase().indexOf(q) !== -1;
    }).slice(0, 4);
    if (employees.length) {
      groups.push({
        label: '员工',
        html: employees.map(function (item) {
          return searchResult('employee', item.id, item.name, item.id + ' · ' + item.dept + ' · ' + item.title, 'users');
        }).join('')
      });
    }
    var customers = db.customers.filter(function (item) {
      return [item.name, item.contact, item.industry, item.phone, item.id].join(' ').toLowerCase().indexOf(q) !== -1;
    }).slice(0, 4);
    if (customers.length) {
      groups.push({
        label: '客户',
        html: customers.map(function (item) {
          return searchResult('customer', item.id, item.name, item.level + ' 级客户 · ' + item.industry + ' · ' + item.contact, 'building');
        }).join('')
      });
    }
    var orders = db.orders.filter(function (item) {
      return [item.id, item.customerName, item.status, item.dept].join(' ').toLowerCase().indexOf(q) !== -1;
    }).slice(0, 4);
    if (orders.length) {
      groups.push({
        label: '订单',
        html: orders.map(function (item) {
          return searchResult('order', item.id, item.id, item.customerName + ' · ' + item.status + ' · ' + U.formatMoney(item.amount), 'receipt');
        }).join('')
      });
    }
    var products = db.products.filter(function (item) {
      return [item.sku, item.name, item.category, item.supplier].join(' ').toLowerCase().indexOf(q) !== -1;
    }).slice(0, 4);
    if (products.length) {
      groups.push({
        label: '商品',
        html: products.map(function (item) {
          return searchResult('product', item.id, item.name, item.sku + ' · ' + item.category + ' · 库存 ' + item.stock + item.unit, 'box');
        }).join('')
      });
    }
    var workOrders = (db.workOrders || []).filter(function (item) {
      return [item.id, item.productName, item.productSku, item.bomVersion, item.status, item.owner, lineName(item.lineId)]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    }).slice(0, 4);
    if (workOrders.length) {
      groups.push({
        label: '生产工单',
        html: workOrders.map(function (item) {
          return searchResult('workorder', item.id, item.id + ' · ' + item.productName,
            item.status + ' · ' + lineCode(item.lineId) + ' · 进度 ' + workOrderProgress(item).toFixed(0) + '%', 'factory');
        }).join('')
      });
    }
    var devices = (db.devices || []).filter(function (item) {
      return [item.id, item.code, item.name, item.type, item.owner, item.status, lineName(item.lineId)]
        .join(' ').toLowerCase().indexOf(q) !== -1;
    }).slice(0, 4);
    if (devices.length) {
      groups.push({
        label: '设备',
        html: devices.map(function (item) {
          return searchResult('device', item.id, item.code + ' · ' + item.name,
            item.type + ' · ' + lineName(item.lineId) + ' · ' + item.status, 'chip');
        }).join('')
      });
    }
    return groups;
  }

  function applyCommandSelection(index) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('#commandResults [data-search-kind]'));
    if (!buttons.length) {
      searchCache = [];
      commandIndex = 0;
      return;
    }
    commandIndex = (index + buttons.length) % buttons.length;
    searchCache = buttons;
    buttons.forEach(function (button, i) {
      button.classList.toggle('is-selected', i === commandIndex);
    });
    var selected = buttons[commandIndex];
    if (selected && selected.scrollIntoView) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  function renderCommandResults(query) {
    var results = $('commandResults');
    if (!results) return;
    var groups = buildSearchGroups(query);
    if (!groups.length) {
      results.innerHTML = '<div class="command-empty">' + icon('search') +
        '<strong>没有找到匹配结果</strong><span>换个关键词试试，或搜索“员工”、“订单”、“库存”。</span></div>';
      searchCache = [];
      return;
    }
    results.innerHTML = groups.map(function (group) {
      return '<div class="command-group"><div class="command-group__label"><span>' + group.label + '</span><span>' + (group.html.split('data-search-kind').length - 1) + ' 项</span></div>' + group.html + '</div>';
    }).join('');
    commandIndex = 0;
    applyCommandSelection(0);
  }

  function openCommand() {
    if (!session) return;
    closePopovers();
    closeModal();
    $('commandOverlay').hidden = false;
    syncBodyLock();
    var input = $('commandInput');
    input.value = '';
    renderCommandResults('');
    window.requestAnimationFrame(function () {
      input.focus();
    });
  }

  function closeCommand() {
    var overlay = $('commandOverlay');
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    syncBodyLock();
  }

  function executeSearchResult(kind, id) {
    if (kind === 'page') {
      closeCommand();
      navigateTo(id);
      return;
    }
    if (kind === 'employee') {
      var employee = db.employees.find(function (item) { return item.id === id; });
      if (!employee) return;
      state.employeeQuery = employee.name;
      state.employeeDept = '';
      state.employeePage = 1;
      closeCommand();
      navigateTo('employees');
      return;
    }
    if (kind === 'customer') {
      var customer = db.customers.find(function (item) { return item.id === id; });
      if (!customer) return;
      state.customerQuery = customer.name;
      state.customerLevel = '';
      closeCommand();
      navigateTo('customers');
      return;
    }
    if (kind === 'order') {
      var order = db.orders.find(function (item) { return item.id === id; });
      if (!order) return;
      state.orderQuery = order.id;
      state.orderStatus = '全部';
      state.expandedOrder = order.id;
      closeCommand();
      navigateTo('orders');
      return;
    }
    if (kind === 'product') {
      var product = db.products.find(function (item) { return item.id === id; });
      if (!product) return;
      state.inventoryQuery = product.sku;
      state.inventoryCategory = '';
      closeCommand();
      navigateTo('inventory');
      return;
    }
    if (kind === 'workorder') {
      var workOrder = workOrderById(id);
      if (!workOrder) return;
      state.productionQuery = workOrder.id;
      state.productionStatus = '全部';
      state.productionLine = '';
      state.productionPage = 1;
      closeCommand();
      navigateTo('production');
      window.setTimeout(function () { workOrderDetailDialog(workOrder.id); }, 160);
      return;
    }
    if (kind === 'device') {
      var device = deviceById(id);
      if (!device) return;
      state.deviceQuery = device.code;
      state.deviceStatus = '全部';
      state.deviceLine = '';
      state.devicePage = 1;
      closeCommand();
      navigateTo('devices');
      window.setTimeout(function () { deviceDialog(device.id); }, 160);
    }
  }

  /* =========================================================
   * 导出
   * ======================================================= */
  function exportEmployees() {
    var rows = filteredEmployees();
    var csv = [['工号', '姓名', '部门', '职位', '入职日期', '状态', '手机号', '邮箱']];
    rows.forEach(function (item) {
      csv.push([item.id, item.name, item.dept, item.title, item.joinedAt, item.status, item.phone, item.email]);
    });
    downloadBlob('智汇ERP_员工名册_' + stamp() + '.csv', toCSV(csv), 'text/csv;charset=utf-8');
    showToast('员工名册已导出', '共 ' + rows.length + ' 位员工（当前筛选结果）。', 'success');
  }

  function exportCustomers() {
    var rows = filteredCustomers();
    var csv = [['客户编号', '客户名称', '等级', '行业', '区域', '联系人', '电话', '邮箱', '累计交易额', '状态']];
    rows.forEach(function (item) {
      csv.push([item.id, item.name, item.level, item.industry, item.region, item.contact, item.phone, item.email, item.totalSpend, item.status]);
    });
    downloadBlob('智汇ERP_客户清单_' + stamp() + '.csv', toCSV(csv), 'text/csv;charset=utf-8');
    showToast('客户清单已导出', '共 ' + rows.length + ' 家客户（当前筛选结果）。', 'success');
  }

  function exportOrders() {
    var rows = filteredOrders();
    var csv = [['订单号', '客户', '销售单元', '金额', '状态', '下单日期', '付款条件']];
    rows.forEach(function (item) {
      csv.push([item.id, item.customerName, item.dept, item.amount, item.status, item.date, item.paymentTerm]);
    });
    downloadBlob('智汇ERP_订单清单_' + stamp() + '.csv', toCSV(csv), 'text/csv;charset=utf-8');
    showToast('订单清单已导出', '共 ' + rows.length + ' 笔订单（当前筛选结果）。', 'success');
  }

  function exportInventory() {
    var rows = filteredProducts();
    var csv = [['SKU', '商品名称', '分类', '当前库存', '安全库存', '单价', '库存货值', '仓库', '供应商']];
    rows.forEach(function (item) {
      csv.push([item.sku, item.name, item.category, item.stock, item.safetyStock, item.price, item.stock * item.price, item.warehouse, item.supplier]);
    });
    downloadBlob('智汇ERP_库存清单_' + stamp() + '.csv', toCSV(csv), 'text/csv;charset=utf-8');
    showToast('库存清单已导出', '共 ' + rows.length + ' 个 SKU（当前筛选结果）。', 'success');
  }

  function exportWorkOrders() {
    var rows = filteredWorkOrders();
    var csv = [['工单号', '产品', '产品编码', 'BOM 版本', '计划数量', '完成数量', '不良数量', '良率', '产线', '绑定设备', '状态', '计划交期', '进度', '负责人']];
    rows.forEach(function (item) {
      var yieldRate = workOrderYield(item);
      csv.push([
        item.id, item.productName, item.productSku, item.bomVersion, item.planQty, item.completedQty, item.defectQty,
        yieldRate == null ? '—' : yieldRate.toFixed(1) + '%',
        lineCode(item.lineId) + ' ' + lineName(item.lineId),
        (item.deviceIds || []).join(' / '),
        item.status + (workOrderAffected(item) ? '（设备故障受影响）' : ''),
        item.dueDate, workOrderProgress(item).toFixed(1) + '%', item.owner
      ]);
    });
    downloadBlob('智汇ERP_生产工单_' + stamp() + '.csv', toCSV(csv), 'text/csv;charset=utf-8');
    showToast('生产工单已导出', '共 ' + rows.length + ' 张工单（当前筛选结果）。', 'success');
  }

  function exportDevices() {
    var rows = filteredDevices();
    var csv = [['设备编号', '设备名称', '类型', '所属产线', '状态', '负责人', '上次点检', 'OEE', '稼动率', '关联在制工单', '备注']];
    rows.forEach(function (item) {
      var related = relatedWorkOrders(item.id).filter(function (order) {
        return order.status === '生产中' || order.status === '已暂停' || order.status === '待产';
      }).map(function (order) { return order.id; });
      csv.push([
        item.id, item.name, item.type, lineCode(item.lineId) + ' ' + lineName(item.lineId), item.status, item.owner,
        item.lastCheck, Number(item.oee).toFixed(1) + '%', Number(item.availability).toFixed(1) + '%',
        related.join(' / ') || '—', item.note
      ]);
    });
    downloadBlob('智汇ERP_设备台账_' + stamp() + '.csv', toCSV(csv), 'text/csv;charset=utf-8');
    showToast('设备台账已导出', '共 ' + rows.length + ' 台设备（当前筛选结果）。', 'success');
  }

  function exportReport() {
    var report = reportBaseData(state.reportMonth, state.reportUnit);
    var csv = [['智汇 ERP 部门经营报表', U.fullMonthLabel(state.reportMonth), state.reportUnit]];
    csv.push(['销售单元', '负责人', '销售目标', '实际销售额', '完成率', '有效订单数', '平均客单价']);
    report.rows.forEach(function (row) {
      csv.push([row.unit, row.owner, row.target, row.actual, row.completion.toFixed(1) + '%', row.orderCount, Math.round(row.average)]);
    });
    csv.push(['合计', '', report.target, report.actual, report.completion.toFixed(1) + '%', report.orderCount, Math.round(report.average)]);
    downloadBlob('智汇ERP_经营报表_' + state.reportMonth.replace('-', '') + '.csv', toCSV(csv), 'text/csv;charset=utf-8');
    showToast('经营报表已导出', U.fullMonthLabel(state.reportMonth) + ' · ' + state.reportUnit, 'success');
  }

  function exportDashboard() {
    var months = U.recentMonths(6);
    var prod = productionStats();
    var deviceInfo = deviceStats();
    var csv = [['智汇 ERP · 经营简报', chineseDate()]];
    csv.push(['核心指标', '数值']);
    csv.push(['本月销售额', salesForMonth(currentMonth())]);
    csv.push(['本月订单数', activeOrders().filter(function (order) { return order.monthKey === currentMonth(); }).length]);
    csv.push(['客户总数', db.customers.length]);
    csv.push(['库存预警 SKU', lowStockProducts().length]);
    csv.push([]);
    csv.push(['生产与设备', '']);
    csv.push(['在产工单', prod.active]);
    csv.push(['待产工单', prod.pending]);
    csv.push(['本月计划达成率', prod.attainment.toFixed(1) + '%']);
    csv.push(['本月良率', prod.yieldRate.toFixed(1) + '%']);
    csv.push(['今日产量', prod.todayOutput]);
    csv.push(['设备总数', deviceInfo.total]);
    csv.push(['运行 / 待机 / 故障 / 保养', deviceInfo.running + ' / ' + deviceInfo.idle + ' / ' + deviceInfo.fault + ' / ' + deviceInfo.maintenance]);
    csv.push(['平均 OEE', deviceInfo.avgOee.toFixed(1) + '%']);
    csv.push(['设备故障受影响工单', prod.affected]);
    csv.push([]);
    csv.push(['近 6 个月销售额', '']);
    months.forEach(function (month) {
      csv.push([month.fullLabel, salesForMonth(month.key)]);
    });
    csv.push([]);
    csv.push(['订单状态', '数量']);
    var counts = orderStatusCounts();
    ORDER_STATUSES.forEach(function (status) { csv.push([status, counts[status]]); });
    downloadBlob('智汇ERP_经营简报_' + stamp() + '.csv', toCSV(csv), 'text/csv;charset=utf-8');
    showToast('经营简报已导出', 'CSV 文件已开始下载。', 'success');
  }

  function exportBackup() {
    downloadBlob('智汇ERP_数据备份_' + stamp() + '.json', JSON.stringify(db, null, 2), 'application/json;charset=utf-8');
    showToast('数据备份已导出', '包含员工、客户、订单、库存、生产工单、设备与设置。', 'success');
  }

  function resetDemoData() {
    openConfirm({
      kicker: 'SYSTEM / RESET',
      title: '重置全部演示数据',
      message: '即将把员工、客户、订单、库存、生产工单、设备、公告与公司资料恢复为初始种子数据。',
      note: '当前浏览器中的全部演示修改将被覆盖，且无法撤销。主题偏好不会改变。',
      confirmText: '确认重置',
      onConfirm: function () {
        db = Data.reset();
        Data.removeLocal(NOTICE_KEY);
        state.notificationsRead = false;
        state.employeeQuery = '';
        state.employeeDept = '';
        state.employeePage = 1;
        state.customerQuery = '';
        state.customerLevel = '';
        state.orderQuery = '';
        state.orderStatus = '全部';
        state.expandedOrder = null;
        state.inventoryQuery = '';
        state.inventoryCategory = '';
        state.productionQuery = '';
        state.productionStatus = '全部';
        state.productionLine = '';
        state.productionPage = 1;
        state.deviceQuery = '';
        state.deviceStatus = '全部';
        state.deviceLine = '';
        state.devicePage = 1;
        state.reportMonth = currentMonth();
        state.reportUnit = '全部部门';
        state.view = 'dashboard';
        history.replaceState(null, '', '#/dashboard');
        renderCurrentView();
        window.scrollTo(0, 0);
        showToast('演示数据已重置',
          '已恢复 25 位员工、10 张生产工单、13 台设备、12 家客户与 20 笔订单。', 'success');
      }
    });
  }

  /* =========================================================
   * 视图事件
   * ======================================================= */
  function syncSearchHasValue(target) {
    var field = target.closest('.search-field');
    if (field) field.classList.toggle('has-value', Boolean(target.value));
  }

  function clearSearch(key, action) {
    var input = document.querySelector('[data-search="' + key + '"]');
    if (input) {
      input.value = '';
      syncSearchHasValue(input);
      input.focus();
    }
    if (action) action();
  }

  function handleViewAction(element) {
    var action = element.getAttribute('data-action');
    if (!action) return;
    if (action === 'go-reports') {
      navigateTo('reports');
      return;
    }
    if (action === 'go-orders') {
      navigateTo('orders');
      return;
    }
    if (action === 'go-production') {
      navigateTo('production');
      return;
    }
    if (action === 'go-devices') {
      navigateTo('devices');
      return;
    }
    if (action === 'production-tab') {
      state.productionStatus = element.getAttribute('data-status') || '全部';
      state.productionPage = 1;
      refreshProductionResults();
      return;
    }
    if (action === 'production-page') {
      var productionPage = Number(element.getAttribute('data-page'));
      if (isFinite(productionPage) && productionPage > 0) {
        state.productionPage = productionPage;
        refreshProductionResults();
      }
      return;
    }
    if (action === 'clear-production-search') {
      clearSearch('production', function () {
        state.productionQuery = '';
        state.productionPage = 1;
        refreshProductionResults();
      });
      return;
    }
    if (action === 'reset-production-filters') {
      state.productionQuery = '';
      state.productionStatus = '全部';
      state.productionLine = '';
      state.productionPage = 1;
      renderViewWithoutScroll();
      return;
    }
    if (action === 'add-workorder') {
      workOrderDialog();
      return;
    }
    if (action === 'wo-detail') {
      workOrderDetailDialog(element.getAttribute('data-id'));
      return;
    }
    if (action === 'wo-report') {
      reportDialog(element.getAttribute('data-id'));
      return;
    }
    if (action === 'wo-pause') {
      pauseWorkOrder(element.getAttribute('data-id'));
      return;
    }
    if (action === 'wo-resume') {
      resumeWorkOrder(element.getAttribute('data-id'));
      return;
    }
    if (action === 'wo-start') {
      startWorkOrder(element.getAttribute('data-id'));
      return;
    }
    if (action === 'pause-affected') {
      pauseAffectedWorkOrders();
      return;
    }
    if (action === 'export-workorders') {
      exportWorkOrders();
      return;
    }
    if (action === 'device-tab') {
      state.deviceStatus = element.getAttribute('data-status') || '全部';
      state.devicePage = 1;
      refreshDeviceResults();
      return;
    }
    if (action === 'device-page') {
      var devicePage = Number(element.getAttribute('data-page'));
      if (isFinite(devicePage) && devicePage > 0) {
        state.devicePage = devicePage;
        refreshDeviceResults();
      }
      return;
    }
    if (action === 'clear-device-search') {
      clearSearch('devices', function () {
        state.deviceQuery = '';
        state.devicePage = 1;
        refreshDeviceResults();
      });
      return;
    }
    if (action === 'reset-device-filters') {
      state.deviceQuery = '';
      state.deviceStatus = '全部';
      state.deviceLine = '';
      state.devicePage = 1;
      renderViewWithoutScroll();
      return;
    }
    if (action === 'device-detail') {
      deviceDialog(element.getAttribute('data-id'));
      return;
    }
    if (action === 'device-repair') {
      deviceRepairDialog(element.getAttribute('data-id'));
      return;
    }
    if (action === 'export-devices') {
      exportDevices();
      return;
    }
    if (action === 'export-dashboard') {
      exportDashboard();
      return;
    }
    if (action === 'toggle-todo') {
      var todo = db.todos.find(function (item) { return item.id === element.getAttribute('data-id'); });
      if (!todo) return;
      todo.done = !todo.done;
      saveDatabase();
      var row = element.closest('[data-todo-row]');
      if (row) row.classList.toggle('is-done', todo.done);
      element.setAttribute('aria-pressed', todo.done ? 'true' : 'false');
      element.setAttribute('aria-label', (todo.done ? '标记为未完成：' : '标记为已完成：') + todo.title);
      var todos = db.todos;
      var done = todos.filter(function (item) { return item.done; }).length;
      var percent = todos.length ? Math.round((done / todos.length) * 100) : 0;
      var bar = $('todoProgressBar');
      if (bar) bar.style.width = percent + '%';
      var text = $('todoProgressText');
      if (text) text.textContent = done + '/' + todos.length + ' 完成';
      var remain = $('todoRemainCount');
      if (remain) remain.textContent = String(todos.length - done);
      return;
    }
    if (action === 'open-notice') {
      openNotice(element.getAttribute('data-id'));
      return;
    }
    if (action === 'all-notices') {
      openAllNotices();
      return;
    }
    if (action === 'add-employee') {
      employeeDialog();
      return;
    }
    if (action === 'edit-employee') {
      employeeDialog(element.getAttribute('data-id'));
      return;
    }
    if (action === 'delete-employee') {
      deleteEmployee(element.getAttribute('data-id'));
      return;
    }
    if (action === 'employee-page') {
      var page = Number(element.getAttribute('data-page'));
      if (isFinite(page) && page > 0) {
        state.employeePage = page;
        refreshEmployeeResults();
      }
      return;
    }
    if (action === 'clear-employee-search') {
      clearSearch('employees', function () {
        state.employeeQuery = '';
        state.employeePage = 1;
        refreshEmployeeResults();
      });
      return;
    }
    if (action === 'reset-employee-filters') {
      state.employeeQuery = '';
      state.employeeDept = '';
      state.employeePage = 1;
      renderViewWithoutScroll();
      return;
    }
    if (action === 'export-employees') {
      exportEmployees();
      return;
    }
    if (action === 'add-customer') {
      customerDialog();
      return;
    }
    if (action === 'edit-customer') {
      customerDialog(element.getAttribute('data-id'));
      return;
    }
    if (action === 'delete-customer') {
      deleteCustomer(element.getAttribute('data-id'));
      return;
    }
    if (action === 'clear-customer-search') {
      clearSearch('customers', function () {
        state.customerQuery = '';
        refreshCustomerResults();
      });
      return;
    }
    if (action === 'reset-customer-filters') {
      state.customerQuery = '';
      state.customerLevel = '';
      renderViewWithoutScroll();
      return;
    }
    if (action === 'export-customers') {
      exportCustomers();
      return;
    }
    if (action === 'order-tab') {
      state.orderStatus = element.getAttribute('data-status') || '全部';
      state.expandedOrder = null;
      refreshOrderResults();
      return;
    }
    if (action === 'clear-order-search') {
      clearSearch('orders', function () {
        state.orderQuery = '';
        refreshOrderResults();
      });
      return;
    }
    if (action === 'export-orders') {
      exportOrders();
      return;
    }
    if (action === 'stock-op') {
      stockDialog(element.getAttribute('data-id'), element.getAttribute('data-type'));
      return;
    }
    if (action === 'clear-inventory-search') {
      clearSearch('inventory', function () {
        state.inventoryQuery = '';
        refreshInventoryResults();
      });
      return;
    }
    if (action === 'reset-inventory-filters') {
      state.inventoryQuery = '';
      state.inventoryCategory = '';
      renderViewWithoutScroll();
      return;
    }
    if (action === 'export-inventory') {
      exportInventory();
      return;
    }
    if (action === 'export-report') {
      exportReport();
      return;
    }
    if (action === 'theme-choice') {
      setTheme(element.getAttribute('data-theme-choice'));
      return;
    }
    if (action === 'export-backup') {
      exportBackup();
      return;
    }
    if (action === 'reset-demo') {
      resetDemoData();
    }
  }

  function initViewEvents() {
    var viewRoot = $('viewRoot');
    if (!viewRoot) return;

    viewRoot.addEventListener('click', function (event) {
      var actionEl = event.target.closest('[data-action]');
      if (actionEl) {
        event.preventDefault();
        handleViewAction(actionEl);
        return;
      }
      var orderRow = event.target.closest('.order-row[data-order-id]');
      if (orderRow) {
        toggleOrder(orderRow.getAttribute('data-order-id'));
        return;
      }
      var workOrderRow = event.target.closest('.wo-row[data-wo-id]');
      if (workOrderRow) {
        workOrderDetailDialog(workOrderRow.getAttribute('data-wo-id'));
        return;
      }
      var deviceRow = event.target.closest('.device-row[data-device-id]');
      if (deviceRow) {
        deviceDialog(deviceRow.getAttribute('data-device-id'));
      }
    });

    viewRoot.addEventListener('input', function (event) {
      var target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      var searchKey = target.getAttribute('data-search');
      if (!searchKey) return;
      syncSearchHasValue(target);
      if (searchKey === 'employees') {
        state.employeeQuery = target.value;
        state.employeePage = 1;
        refreshEmployeeResults();
      } else if (searchKey === 'customers') {
        state.customerQuery = target.value;
        refreshCustomerResults();
      } else if (searchKey === 'orders') {
        state.orderQuery = target.value;
        refreshOrderResults();
      } else if (searchKey === 'inventory') {
        state.inventoryQuery = target.value;
        refreshInventoryResults();
      } else if (searchKey === 'production') {
        state.productionQuery = target.value;
        state.productionPage = 1;
        refreshProductionResults();
      } else if (searchKey === 'devices') {
        state.deviceQuery = target.value;
        state.devicePage = 1;
        refreshDeviceResults();
      }
    });

    viewRoot.addEventListener('change', function (event) {
      var target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      var filter = target.getAttribute('data-filter');
      if (!filter) return;
      if (filter === 'employee-dept') {
        state.employeeDept = target.value;
        state.employeePage = 1;
        refreshEmployeeResults();
      } else if (filter === 'customer-level') {
        state.customerLevel = target.value;
        refreshCustomerResults();
      } else if (filter === 'inventory-category') {
        state.inventoryCategory = target.value;
        refreshInventoryResults();
      } else if (filter === 'production-line') {
        state.productionLine = target.value;
        state.productionPage = 1;
        refreshProductionResults();
      } else if (filter === 'device-line') {
        state.deviceLine = target.value;
        state.devicePage = 1;
        refreshDeviceResults();
      } else if (filter === 'report-month') {
        state.reportMonth = target.value;
        renderViewWithoutScroll();
      } else if (filter === 'report-unit') {
        state.reportUnit = target.value;
        renderViewWithoutScroll();
      }
    });

    viewRoot.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.classList.contains('order-row')) {
        event.preventDefault();
        toggleOrder(event.target.getAttribute('data-order-id'));
      } else if (event.target.classList.contains('wo-row')) {
        event.preventDefault();
        workOrderDetailDialog(event.target.getAttribute('data-wo-id'));
      } else if (event.target.classList.contains('device-row')) {
        event.preventDefault();
        deviceDialog(event.target.getAttribute('data-device-id'));
      }
    });

    viewRoot.addEventListener('submit', function (event) {
      if (event.target.id !== 'companyForm') return;
      event.preventDefault();
      if (!event.target.reportValidity()) return;
      var fd = new FormData(event.target);
      var company = db.company || {};
      ['name', 'creditCode', 'industry', 'scale', 'contact', 'phone', 'email', 'website', 'address', 'intro'].forEach(function (key) {
        company[key] = String(fd.get(key) || '').trim();
      });
      db.company = company;
      if (!saveDatabase()) return;
      var sidebar = $('sidebarCompanyName');
      if (sidebar) sidebar.textContent = company.name;
      showToast('公司信息已保存', '工作空间资料已即时更新。', 'success');
    });
  }

  /* =========================================================
   * 外壳 / 搜索 / 登录事件
   * ======================================================= */
  function initShellEvents() {
    var loginForm = $('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    ['loginUser', 'loginPass'].forEach(function (id) {
      var input = $(id);
      if (input) input.addEventListener('input', hideLoginError);
    });

    var togglePassword = $('togglePassword');
    if (togglePassword) {
      togglePassword.addEventListener('click', function () {
        var password = $('loginPass');
        var visible = password.type === 'text';
        password.type = visible ? 'password' : 'text';
        togglePassword.setAttribute('aria-label', visible ? '显示密码' : '隐藏密码');
        togglePassword.setAttribute('title', visible ? '显示密码' : '隐藏密码');
        var eye = $('passwordEyeIcon');
        if (eye) eye.setAttribute('href', visible ? '#i-eye' : '#i-eye-off');
        password.focus();
      });
    }

    var fillDemo = $('fillDemoBtn');
    if (fillDemo) {
      fillDemo.addEventListener('click', function () {
        $('loginUser').value = 'admin';
        $('loginPass').value = '123456';
        hideLoginError();
        $('loginBtn').focus();
      });
    }

    var themeToggle = $('themeToggleBtn');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }

    var notificationToggle = $('notificationToggle');
    if (notificationToggle) {
      notificationToggle.addEventListener('click', function (event) {
        event.stopPropagation();
        var panel = $('notificationPanel');
        var opening = panel.hidden;
        closePopovers();
        if (opening) {
          panel.hidden = false;
          notificationToggle.setAttribute('aria-expanded', 'true');
          renderNotifications();
        }
      });
    }

    var userToggle = $('userMenuToggle');
    if (userToggle) {
      userToggle.addEventListener('click', function (event) {
        event.stopPropagation();
        var menu = $('userMenu');
        var opening = menu.hidden;
        closePopovers();
        if (opening) {
          menu.hidden = false;
          userToggle.setAttribute('aria-expanded', 'true');
        }
      });
    }

    var notificationPanel = $('notificationPanel');
    if (notificationPanel) {
      notificationPanel.addEventListener('click', function (event) {
        var actionEl = event.target.closest('[data-action]');
        if (actionEl) {
          if (actionEl.getAttribute('data-action') === 'mark-all-read') {
            markNotificationsRead();
          } else if (actionEl.getAttribute('data-action') === 'close-notifications') {
            closePopovers();
          }
          return;
        }
        var item = event.target.closest('[data-notification]');
        if (item) {
          var notifications = getNotifications();
          var target = notifications.find(function (notification) { return notification.key === item.getAttribute('data-notification'); });
          if (target) {
            state.notificationsRead = true;
            Data.writeLocal(NOTICE_KEY, '1');
            closePopovers();
            if (target.key === 'stock') {
              navigateTo('inventory');
            } else if (target.key === 'device') {
              navigateTo('devices');
            } else {
              state.orderStatus = target.status || '全部';
              state.orderQuery = '';
              state.expandedOrder = null;
              navigateTo('orders');
            }
          }
        }
      });
    }

    var logoutBtn = $('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    document.querySelectorAll('[data-user-nav]').forEach(function (item) {
      item.addEventListener('click', function () {
        closePopovers();
        navigateTo(item.getAttribute('data-user-nav'));
      });
    });

    var searchBtn = $('globalSearchBtn');
    if (searchBtn) searchBtn.addEventListener('click', openCommand);

    var commandOverlay = $('commandOverlay');
    if (commandOverlay) {
      commandOverlay.addEventListener('click', function (event) {
        if (event.target === commandOverlay) closeCommand();
      });
    }

    var commandInput = $('commandInput');
    if (commandInput) {
      commandInput.addEventListener('input', function () {
        renderCommandResults(commandInput.value);
      });
      commandInput.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          applyCommandSelection(commandIndex + 1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          applyCommandSelection(commandIndex - 1);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          var selected = searchCache[commandIndex];
          if (selected) {
            executeSearchResult(selected.getAttribute('data-search-kind'), selected.getAttribute('data-search-id'));
          }
        }
      });
    }

    var commandResults = $('commandResults');
    if (commandResults) {
      commandResults.addEventListener('click', function (event) {
        var item = event.target.closest('[data-search-kind]');
        if (!item) return;
        executeSearchResult(item.getAttribute('data-search-kind'), item.getAttribute('data-search-id'));
      });
    }

    document.addEventListener('click', function (event) {
      if (!event.target.closest('.topbar-actions')) closePopovers();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        if ($('modalRoot').childElementCount) {
          closeModal();
          return;
        }
        if (!$('commandOverlay').hidden) {
          closeCommand();
          return;
        }
        closePopovers();
      }
      var tag = (event.target.tagName || '').toLowerCase();
      var isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || event.target.isContentEditable;
      var commandShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      var slashShortcut = event.key === '/' && !isTyping;
      if (!isTyping && !event.target.closest('[role="dialog"]') && (slashShortcut || commandShortcut) && session && !$('modalRoot').childElementCount) {
        event.preventDefault();
        openCommand();
      }
    });

    window.addEventListener('hashchange', handleRoute);

    var resizeTimeout = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(drawCurrentCharts, 180);
    });
  }

  /* =========================================================
   * 初始化
   * ======================================================= */
  function init() {
    db = Data.init();
    session = readSession();
    state.reportMonth = currentMonth();
    setTheme(currentTheme(), false);
    syncThemeUI();
    initViewEvents();
    initShellEvents();
    var topbarDate = $('topbarDate');
    if (topbarDate) {
      var now = new Date();
      topbarDate.textContent = now.getFullYear() + '.' + U.pad(now.getMonth() + 1) + '.' + U.pad(now.getDate());
    }
    if (session) {
      showApp();
    } else {
      showLogin();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
