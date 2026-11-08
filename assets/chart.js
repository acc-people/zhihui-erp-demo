/* =========================================================
 * 智汇 ERP · 轻量图表引擎
 * 无任何第三方依赖，基于 Canvas 2D 自绘
 * 支持：折线面积图 / 环形图 / 分组柱状图 + 悬停提示
 * ======================================================= */
(function (global) {
  'use strict';

  var reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function cssVar(name, fallback) {
    var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function rgba(color, alpha) {
    var hex = String(color || '').trim();
    if (hex.charAt(0) === '#') {
      hex = hex.slice(1);
      if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
      var r = parseInt(hex.slice(0, 2), 16);
      var g = parseInt(hex.slice(2, 4), 16);
      var b = parseInt(hex.slice(4, 6), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }
    if (hex.indexOf('rgb') === 0) {
      return hex.replace('rgb(', 'rgba(').replace(')', ',' + alpha + ')');
    }
    return hex;
  }

  function fontStack() {
    return cssVar('--font-num', '"Bahnschrift", "DIN Alternate", "Segoe UI", sans-serif');
  }

  function setupCanvas(canvas) {
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    var width = Math.round(rect.width);
    var height = Math.round(rect.height);
    if (!width || !height) return null;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var targetW = Math.round(width * dpr);
    var targetH = Math.round(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx: ctx, width: width, height: height };
  }

  function animate(canvas, duration, draw) {
    if (canvas._chartRaf) cancelAnimationFrame(canvas._chartRaf);
    if (reduceMotion || !duration) {
      draw(1);
      return;
    }
    var start = null;
    function frame(time) {
      if (start === null) start = time;
      var progress = Math.min(1, (time - start) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      draw(eased);
      if (progress < 1) {
        canvas._chartRaf = requestAnimationFrame(frame);
      } else {
        canvas._chartRaf = null;
      }
    }
    canvas._chartRaf = requestAnimationFrame(frame);
  }

  function ensureTooltip(canvas) {
    var wrap = canvas.closest('.chart-canvas-wrap') || canvas.parentElement;
    if (!wrap) return null;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    var tip = wrap.querySelector('.chart-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tooltip';
      tip.hidden = true;
      wrap.appendChild(tip);
    }
    return tip;
  }

  function hideTooltip(canvas) {
    var wrap = canvas.closest('.chart-canvas-wrap') || canvas.parentElement;
    var tip = wrap && wrap.querySelector('.chart-tooltip');
    if (tip) tip.hidden = true;
  }

  function showTooltip(canvas, html, x, y) {
    var wrap = canvas.closest('.chart-canvas-wrap') || canvas.parentElement;
    var tip = ensureTooltip(canvas);
    if (!tip || !wrap) return;
    var canvasRect = canvas.getBoundingClientRect();
    var wrapRect = wrap.getBoundingClientRect();
    tip.innerHTML = html;
    tip.hidden = false;
    tip.style.visibility = 'hidden';
    var w = tip.offsetWidth;
    var h = tip.offsetHeight;
    var baseX = canvasRect.left - wrapRect.left + x;
    var baseY = canvasRect.top - wrapRect.top + y;
    var left = Math.max(8, Math.min(baseX - w / 2, wrapRect.width - w - 8));
    var top = baseY - h - 14;
    if (top < 6) top = baseY + 18;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.style.visibility = 'visible';
  }

  function bindHover(canvas) {
    if (canvas._chartHoverBound) return;
    canvas._chartHoverBound = true;
    var rectPoint = function (event) {
      var rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    canvas.addEventListener('mousemove', function (event) {
      var meta = canvas._chartMeta;
      if (!meta) return;
      var point = rectPoint(event);
      if (meta.type === 'line') {
        var nearest = null;
        var minDistance = Infinity;
        meta.points.forEach(function (p) {
          var distance = Math.abs(p.x - point.x);
          if (distance < minDistance) {
            minDistance = distance;
            nearest = p;
          }
        });
        if (nearest && minDistance < 34 && point.y >= meta.plotTop - 10 && point.y <= meta.plotBottom + 8) {
          showTooltip(
            canvas,
            '<span class="chart-tip-label">' + nearest.label + '</span>' +
            '<strong class="chart-tip-value">' + nearest.valueLabel + '</strong>' +
            '<span class="chart-tip-sub">' + (nearest.sublabel || '销售额') + '</span>',
            nearest.x,
            nearest.y
          );
        } else {
          hideTooltip(canvas);
        }
        return;
      }

      if (meta.type === 'donut') {
        var cx = meta.cx;
        var cy = meta.cy;
        var dx = point.x - cx;
        var dy = point.y - cy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var outer = meta.outerRadius;
        var inner = meta.innerRadius;
        if (dist <= outer + 6 && dist >= inner - 6) {
          var angle = Math.atan2(dy, dx);
          if (angle < -Math.PI / 2) angle += Math.PI * 2;
          var found = null;
          meta.segments.forEach(function (seg) {
            if (angle >= seg.startAngle && angle <= seg.endAngle) found = seg;
          });
          if (found) {
            showTooltip(
              canvas,
              '<span class="chart-tip-label">' + found.label + '</span>' +
              '<strong class="chart-tip-value">' + found.value + ' 笔</strong>' +
              '<span class="chart-tip-sub">占比 ' + found.percent + '</span>',
              point.x,
              point.y
            );
            return;
          }
        }
        hideTooltip(canvas);
        return;
      }

      if (meta.type === 'bars') {
        var group = null;
        meta.groups.forEach(function (item) {
          if (point.x >= item.start && point.x <= item.end) group = item;
        });
        if (group && point.y >= meta.plotTop - 8 && point.y <= meta.plotBottom + 10) {
          var rows = group.values.map(function (entry, index) {
            return '<span class="chart-tip-row"><i style="background:' + meta.series[index].color + '"></i>' +
              meta.series[index].name + '<b>' + entry.label + '</b></span>';
          }).join('');
          showTooltip(
            canvas,
            '<span class="chart-tip-label">' + group.label + '</span>' + rows,
            point.x,
            Math.min(point.y, meta.plotTop + 42)
          );
        } else {
          hideTooltip(canvas);
        }
      }
    });

    canvas.addEventListener('mouseleave', function () {
      hideTooltip(canvas);
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function roundedTopRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h);
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }

  function niceCeil(value) {
    if (value <= 0) return 1;
    var exponent = Math.pow(10, Math.floor(Math.log10(value)));
    var normalized = value / exponent;
    var nice;
    if (normalized <= 1) nice = 1;
    else if (normalized <= 2) nice = 2;
    else if (normalized <= 2.5) nice = 2.5;
    else if (normalized <= 5) nice = 5;
    else nice = 10;
    return nice * exponent;
  }

  function compact(value) {
    var n = Number(value) || 0;
    if (Math.abs(n) >= 100000000) {
      return String(Number((n / 100000000).toFixed(2))) + '亿';
    }
    if (Math.abs(n) >= 10000) {
      return String(Number((n / 10000).toFixed(1))) + '万';
    }
    return String(Math.round(n));
  }

  function formatTick(value) {
    if (value === 0) return '0';
    return compact(value);
  }

  /* -------------------- 折线面积图 -------------------- */
  function line(canvas, config) {
    if (!canvas) return;
    bindHover(canvas);
    var size = setupCanvas(canvas);
    if (!size) return;
    var ctx = size.ctx;
    var width = size.width;
    var height = size.height;
    var labels = config.labels || [];
    var values = (config.values || []).map(Number);
    if (!labels.length) return;

    var colorPrimary = cssVar('--chart-line', '#4b7bff');
    var colorAccent = cssVar('--chart-accent', '#22d3c5');
    var gridColor = cssVar('--chart-grid', '#e6ecf5');
    var labelColor = cssVar('--chart-label', '#8292a8');
    var pillBg = cssVar('--chart-pill-bg', '#0c1c32');
    var pillText = cssVar('--chart-pill-text', '#ffffff');
    var font = fontStack();
    var formatValue = config.formatValue || function (v) { return compact(v); };

    var left = width < 520 ? 42 : 54;
    var right = width < 520 ? 14 : 24;
    var top = 28;
    var bottom = 34;
    var plotW = width - left - right;
    var plotH = height - top - bottom;
    var maxValue = Math.max.apply(null, values.concat([0]));
    var yMax = niceCeil(maxValue * 1.14) || 1;
    var steps = 4;

    var points = values.map(function (value, index) {
      return {
        x: left + (labels.length === 1 ? plotW / 2 : (plotW / (labels.length - 1)) * index),
        y: top + plotH - (value / yMax) * plotH,
        label: labels[index],
        value: value,
        valueLabel: formatValue(value),
        sublabel: config.valueSubLabel || '销售额'
      };
    });

    canvas._chartMeta = {
      type: 'line',
      points: points,
      plotTop: top,
      plotBottom: top + plotH
    };

    animate(canvas, 720, function (progress) {
      ctx.clearRect(0, 0, width, height);

      // 水平网格与 Y 轴刻度
      ctx.save();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.fillStyle = labelColor;
      ctx.font = '500 10.5px ' + font;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (var i = 0; i <= steps; i += 1) {
        var y = top + (plotH / steps) * i;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(left + plotW, y);
        ctx.stroke();
        ctx.fillText(formatTick(yMax - (yMax / steps) * i), left - 10, y);
      }
      ctx.setLineDash([]);
      ctx.restore();

      // X 轴月份
      ctx.save();
      ctx.fillStyle = labelColor;
      ctx.font = '500 11px ' + font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      points.forEach(function (p) {
        ctx.fillText(p.label, p.x, top + plotH + 12);
      });
      ctx.restore();

      var currentPoints = points.map(function (p) {
        return { x: p.x, y: top + plotH - (top + plotH - p.y) * progress };
      });

      // 面积渐变
      var areaGradient = ctx.createLinearGradient(0, top, 0, top + plotH);
      areaGradient.addColorStop(0, rgba(colorPrimary, 0.26));
      areaGradient.addColorStop(0.55, rgba(colorPrimary, 0.08));
      areaGradient.addColorStop(1, rgba(colorPrimary, 0));
      ctx.beginPath();
      ctx.moveTo(currentPoints[0].x, top + plotH);
      currentPoints.forEach(function (p) { ctx.lineTo(p.x, p.y); });
      ctx.lineTo(currentPoints[currentPoints.length - 1].x, top + plotH);
      ctx.closePath();
      ctx.fillStyle = areaGradient;
      ctx.fill();

      // 平滑折线
      var strokeGradient = ctx.createLinearGradient(left, 0, left + plotW, 0);
      strokeGradient.addColorStop(0, colorPrimary);
      strokeGradient.addColorStop(1, colorAccent);
      ctx.save();
      ctx.strokeStyle = strokeGradient;
      ctx.lineWidth = 2.6;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      for (var j = 0; j < currentPoints.length - 1; j += 1) {
        var p0 = currentPoints[Math.max(0, j - 1)];
        var p1 = currentPoints[j];
        var p2 = currentPoints[j + 1];
        var p3 = currentPoints[Math.min(currentPoints.length - 1, j + 2)];
        var tension = 0.17;
        var cp1x = p1.x + (p2.x - p0.x) * tension;
        var cp1y = p1.y + (p2.y - p0.y) * tension;
        var cp2x = p2.x - (p3.x - p1.x) * tension;
        var cp2y = p2.y - (p3.y - p1.y) * tension;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
      ctx.stroke();
      ctx.restore();

      // 数据节点
      currentPoints.forEach(function (p, index) {
        var isLast = index === currentPoints.length - 1;
        if (isLast) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
          ctx.fillStyle = rgba(colorPrimary, 0.14);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, isLast ? 4.5 : 3.2, 0, Math.PI * 2);
        ctx.fillStyle = isLast ? colorAccent : cssVar('--surface', '#ffffff');
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isLast ? colorAccent : colorPrimary;
        ctx.stroke();
      });

      // 最新数据气泡
      var last = currentPoints[currentPoints.length - 1];
      if (progress > 0.82) {
        var label = formatValue(values[values.length - 1]);
        ctx.save();
        ctx.font = '600 10.5px ' + font;
        var textWidth = ctx.measureText(label).width;
        var pillW = textWidth + 18;
        var pillH = 23;
        var pillX = last.x - pillW / 2;
        var pillY = last.y - 35;
        if (pillX < left) pillX = left;
        if (pillX + pillW > width - 4) pillX = width - pillW - 4;
        if (pillY < 2) pillY = last.y + 16;
        roundRect(ctx, pillX, pillY, pillW, pillH, 7);
        ctx.fillStyle = pillBg;
        ctx.fill();
        ctx.fillStyle = pillText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, pillX + pillW / 2, pillY + pillH / 2 + 0.5);
        ctx.restore();
      }
    });
  }

  /* -------------------- 环形图 -------------------- */
  function donut(canvas, config) {
    if (!canvas) return;
    bindHover(canvas);
    var size = setupCanvas(canvas);
    if (!size) return;
    var ctx = size.ctx;
    var width = size.width;
    var height = size.height;
    var segments = config.segments || [];
    var total = segments.reduce(function (sum, item) { return sum + Number(item.value || 0); }, 0);
    var cx = width / 2;
    var cy = height / 2;
    var outerRadius = Math.min(width, height) / 2 - 8;
    var lineWidth = Math.min(24, Math.max(14, outerRadius * 0.22));
    var radius = outerRadius - lineWidth / 2;
    var gap = 0.055;
    var font = fontStack();
    var trackColor = cssVar('--chart-grid', '#e7edf6');
    var centerColor = cssVar('--text-strong', '#10213a');
    var mutedColor = cssVar('--chart-label', '#8a99ad');

    var start = -Math.PI / 2;
    var draft = [];
    segments.forEach(function (item) {
      var angle = total ? (Number(item.value) / total) * Math.PI * 2 : 0;
      var segStart = start + gap / 2;
      var segEnd = start + angle - gap / 2;
      if (segEnd < segStart) segEnd = segStart;
      draft.push({
        label: item.label,
        value: item.value,
        color: item.color,
        percent: (total ? (Number(item.value) / total) * 100 : 0).toFixed(1) + '%',
        startAngle: start,
        endAngle: start + angle,
        drawStart: segStart,
        drawEnd: segEnd
      });
      start += angle;
    });

    canvas._chartMeta = {
      type: 'donut',
      cx: cx,
      cy: cy,
      outerRadius: outerRadius,
      innerRadius: outerRadius - lineWidth,
      segments: draft
    };

    animate(canvas, 760, function (progress) {
      ctx.clearRect(0, 0, width, height);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = trackColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      draft.forEach(function (seg) {
        if (seg.endAngle <= seg.startAngle) return;
        var end = seg.drawStart + (seg.drawEnd - seg.drawStart) * progress;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, seg.drawStart, end);
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
      });

      // 中心数字
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = centerColor;
      ctx.font = '600 ' + Math.round(Math.min(32, outerRadius * 0.47)) + 'px ' + font;
      ctx.fillText(String(Math.round(total * progress)), cx, cy - 4);
      ctx.fillStyle = mutedColor;
      ctx.font = '500 11px ' + font;
      ctx.fillText(config.centerLabel || '订单总量', cx, cy + Math.round(Math.min(26, outerRadius * 0.36)));
      ctx.restore();
    });
  }

  /* -------------------- 分组柱状图 -------------------- */
  function bars(canvas, config) {
    if (!canvas) return;
    bindHover(canvas);
    var size = setupCanvas(canvas);
    if (!size) return;
    var ctx = size.ctx;
    var width = size.width;
    var height = size.height;
    var labels = config.labels || [];
    var series = (config.series || []).map(function (item, index) {
      return {
        name: item.name,
        color: item.color || (index === 0 ? cssVar('--chart-line', '#4c7dff') : '#c7d2e3'),
        ghost: Boolean(item.ghost),
        values: item.values || []
      };
    });
    if (!labels.length || !series.length) return;

    var gridColor = cssVar('--chart-grid', '#e6ecf5');
    var labelColor = cssVar('--chart-label', '#8292a8');
    var valueColor = cssVar('--text-strong', '#10213a');
    var font = fontStack();
    var formatValue = config.formatValue || compact;

    var left = width < 520 ? 40 : 50;
    var right = 12;
    var top = 30;
    var bottom = 38;
    var plotW = width - left - right;
    var plotH = height - top - bottom;
    var allValues = [];
    series.forEach(function (item) {
      allValues = allValues.concat(item.values.map(Number));
    });
    var yMax = niceCeil(Math.max.apply(null, allValues.concat([0])) * 1.16) || 1;
    var steps = 4;
    var groupWidth = plotW / labels.length;
    var barWidth = Math.min(28, (groupWidth * 0.52) / series.length);
    var groupGap = 6;
    var groups = [];

    labels.forEach(function (label, index) {
      var center = left + groupWidth * index + groupWidth / 2;
      var totalBarsWidth = barWidth * series.length + groupGap * (series.length - 1);
      var startX = center - totalBarsWidth / 2;
      groups.push({
        start: center - groupWidth / 2 + 4,
        end: center + groupWidth / 2 - 4,
        center: center,
        label: label,
        values: series.map(function (item) {
          return {
            value: Number(item.values[index] || 0),
            label: formatValue(Number(item.values[index] || 0))
          };
        })
      });
      groups[groups.length - 1]._barStart = startX;
    });

    canvas._chartMeta = {
      type: 'bars',
      groups: groups,
      plotTop: top,
      plotBottom: top + plotH,
      series: series
    };

    animate(canvas, 700, function (progress) {
      ctx.clearRect(0, 0, width, height);

      // 网格
      ctx.save();
      ctx.strokeStyle = gridColor;
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.fillStyle = labelColor;
      ctx.font = '500 10.5px ' + font;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (var s = 0; s <= steps; s += 1) {
        var y = top + (plotH / steps) * s;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(left + plotW, y);
        ctx.stroke();
        ctx.fillText(compact(yMax - (yMax / steps) * s), left - 9, y);
      }
      ctx.restore();

      labels.forEach(function (label, index) {
        var group = groups[index];
        var x = group._barStart;
        series.forEach(function (item, seriesIndex) {
          var value = Number(item.values[index] || 0);
          var barH = Math.max(0, (value / yMax) * plotH * progress);
          var y = top + plotH - barH;
          var color = item.ghost ? rgba(item.color, 0.55) : item.color;

          if (seriesIndex === 0) {
            var gradient = ctx.createLinearGradient(0, y, 0, top + plotH);
            gradient.addColorStop(0, item.color);
            gradient.addColorStop(1, rgba(item.color, 0.72));
            ctx.fillStyle = gradient;
          } else {
            ctx.fillStyle = item.ghost ? rgba(item.color, 0.5) : rgba(item.color, 0.9);
          }
          roundedTopRect(ctx, x, y, barWidth, barH, 5);
          ctx.fill();

          if (progress > 0.9 && value > 0) {
            ctx.save();
            ctx.fillStyle = seriesIndex === 0 ? valueColor : labelColor;
            ctx.font = '600 10px ' + font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(compact(value), x + barWidth / 2, y - 6);
            ctx.restore();
          }
          x += barWidth + groupGap;
        });

        ctx.save();
        ctx.fillStyle = labelColor;
        ctx.font = '500 11px ' + font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, group.center, top + plotH + 13);
        ctx.restore();
      });
    });
  }

  global.ERPCharts = {
    line: line,
    donut: donut,
    bars: bars,
    hideTooltip: hideTooltip
  };
})(window);
