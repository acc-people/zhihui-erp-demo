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
    employees: { label: '员工管理', eyebrow: 'ORGANIZATION / 02', icon: 'users', desc: '组织与人员' },
    customers: { label: '客户管理', eyebrow: 'CUSTOMERS / 03', icon: 'building', desc: '客户资产' },
    orders: { label: '订单管理', eyebrow: 'SALES ORDERS / 04', icon: 'receipt', desc: '订单履约' },
    inventory: { label: '库存管理', eyebrow: 'INVENTORY / 05', icon: 'box', desc: '库存与预警' },
    reports: { label: '报表中心', eyebrow: 'BUSINESS INTELLIGENCE / 06', icon: 'chart', desc: '经营分析' },
    settings: { label: '系统设置', eyebrow: 'WORKSPACE / 07', icon: 'settings', desc: '工作空间设置' }
  };

  var NAV_ITEMS = [
    { view: 'dashboard', label: '工作台', desc: '经营总览与关键指标', icon: 'grid', keywords: 'dashboard 首页 概览 数据 看板' },
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
    var companyName = db.company && db.company.name ? db.company.name : '深圳智汇科技有限公司';
    var sidebarCompany = $('sidebarCompanyName');
    if (sidebarCompany) sidebarCompany.textContent = companyName;
    updateBadges();
    renderNotifications();
    syncThemeUI();
  }

  function updateBadges() {
    var orderBadge = $('ordersNavBadge');
    var stockBadge = $('stockNavBadge');
    var shipCount = pendingShipments().length;
    var stockCount = lowStockProducts().length;
    if (orderBadge) {
      orderBadge.textContent = String(shipCount);
      orderBadge.hidden = shipCount === 0;
    }
    if (stockBadge) {
      stockBadge.textContent = String(stockCount);
      stockBadge.hidden = stockCount === 0;
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
        role: '运营主管',
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
      '<div class="panel__sub">制度、业务与行政最新动态</div></div>' +
      '<div class="panel__tools"><span class="range-chip">' + icon('file-text') + announcements.length + ' 条</span></div></div>' +
      '<div class="notice-list">' + noticeRows + '</div>' +
      '<button class="panel-footer-link" type="button" data-action="all-notices">查看全部公告' + icon('arrow-right') + '</button>' +
      '</section>';

    return '<div class="page">' +
      pageHead(PAGE_META.dashboard.eyebrow, greeting() + '，王敏',
        '今天有 <strong>' + outstanding + '</strong> 项待办 · <strong>' + warningProducts.length + '</strong> 个 SKU 需补货 · <strong>' +
        pendingShipments().length + '</strong> 笔订单待发货。',
        '<span class="welcome-date">' + icon('calendar') + chineseDate() + '</span>' +
        '<button class="btn btn--ghost" type="button" data-action="export-dashboard" title="导出经营简报">' +
        icon('download') + '<span class="btn-label">导出简报</span></button>' +
        '<button class="btn btn--primary" type="button" data-action="go-reports">' + icon('chart') + '查看报表' + icon('arrow-right') + '</button>') +
      kpis +
      '<div class="dash-grid">' + chartPanel + donutPanel + '</div>' +
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
      '<div class="settings-data-row"><span>数据占用</span><strong>' + e(sizeText) + '</strong></div>' +
      '<div class="settings-data-actions"><button class="btn btn--ghost btn--sm" type="button" data-action="export-backup">' + icon('download') + '导出数据备份</button>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-action="export-dashboard">' + icon('file-text') + '导出经营简报</button></div>' +
      '<div class="settings-danger-zone"><div class="settings-danger-zone__title">' + icon('alert-triangle') + '重置演示数据</div>' +
      '<p>恢复初始的 15 位员工、12 家客户、20 笔订单与 12 个商品。当前所有本地修改将被覆盖。</p>' +
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
    if (!lineCanvas && !donutCanvas) return;
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
    var list = [];
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
    var csv = [['智汇 ERP · 经营简报', chineseDate()]];
    csv.push(['核心指标', '数值']);
    csv.push(['本月销售额', salesForMonth(currentMonth())]);
    csv.push(['本月订单数', activeOrders().filter(function (order) { return order.monthKey === currentMonth(); }).length]);
    csv.push(['客户总数', db.customers.length]);
    csv.push(['库存预警 SKU', lowStockProducts().length]);
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
    showToast('数据备份已导出', '包含员工、客户、订单、库存与设置。', 'success');
  }

  function resetDemoData() {
    openConfirm({
      kicker: 'SYSTEM / RESET',
      title: '重置全部演示数据',
      message: '即将把员工、客户、订单、库存、公告与公司资料恢复为初始种子数据。',
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
        state.reportMonth = currentMonth();
        state.reportUnit = '全部部门';
        state.view = 'dashboard';
        history.replaceState(null, '', '#/dashboard');
        renderCurrentView();
        window.scrollTo(0, 0);
        showToast('演示数据已重置', '已恢复 15 位员工、12 家客户、20 笔订单与 12 个商品。', 'success');
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
      } else if (filter === 'report-month') {
        state.reportMonth = target.value;
        renderViewWithoutScroll();
      } else if (filter === 'report-unit') {
        state.reportUnit = target.value;
        renderViewWithoutScroll();
      }
    });

    viewRoot.addEventListener('keydown', function (event) {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.classList.contains('order-row')) {
        event.preventDefault();
        toggleOrder(event.target.getAttribute('data-order-id'));
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
