(function () {
  "use strict";

  var STORAGE_KEY = "calismaTakip_v1";

  function defaultYds() {
    return {
      examDate: "",
      applicationDate: "",
      chartStartDate: "",
      programStartDate: "2026-04-06",
      targetScore: "",
      weeklyMinutesTarget: 0,
      lastFullMockDate: "",
      focusNote: "",
      done: {
        kelime_akademik: false,
        okuma_temel: false,
        cikmis_tarama: false,
        zamanli_bolum: false,
        tam_deneme: false,
        zayif_tekrar: false,
        sinav_oncesi: false,
      },
    };
  }

  function mergeYds(from) {
    var d = defaultYds();
    if (!from || typeof from !== "object") return d;
    if (from.examDate) d.examDate = String(from.examDate);
    if (from.applicationDate) d.applicationDate = String(from.applicationDate);
    if (from.chartStartDate != null) d.chartStartDate = String(from.chartStartDate);
    if (from.programStartDate != null) d.programStartDate = String(from.programStartDate).trim();
    if (from.targetScore != null) d.targetScore = String(from.targetScore);
    var wmt = Number(from.weeklyMinutesTarget);
    if (!isNaN(wmt) && wmt >= 0) d.weeklyMinutesTarget = Math.min(10080, Math.floor(wmt));
    if (from.lastFullMockDate) d.lastFullMockDate = String(from.lastFullMockDate);
    if (from.focusNote != null) d.focusNote = String(from.focusNote);
    if (from.done && typeof from.done === "object") {
      Object.keys(d.done).forEach(function (k) {
        if (from.done[k] === true) d.done[k] = true;
      });
    }
    return d;
  }

  function defaultState() {
    return {
      sessions: [],
      books: [],
      goals: {
        weeklyMinutesEnglish: 0,
        weeklyMinutesTechnical: 0,
        streakMinMinutesPerDay: 15,
      },
      yds: defaultYds(),
    };
  }

  function normalizeStateObject(data) {
    if (!data || typeof data !== "object") return defaultState();
    if (!data.sessions || !Array.isArray(data.sessions)) return defaultState();
    if (!data.goals) data.goals = { weeklyMinutesEnglish: 0, weeklyMinutesTechnical: 0 };
    if (data.goals.streakMinMinutesPerDay == null) data.goals.streakMinMinutesPerDay = 15;
    if (!data.books || !Array.isArray(data.books)) data.books = [];
    data.yds = mergeYds(data.yds);
    return data;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var data = JSON.parse(raw);
      return normalizeStateObject(data);
    } catch (e) {
      return defaultState();
    }
  }

  function persistStateLocal(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  var _serverSaveTimer = null;

  function apiFetch(path, options) {
    var url = typeof getCalismaApiUrl === "function" ? getCalismaApiUrl(path) : path;
    var opt = options ? Object.assign({}, options) : {};
    var headers = Object.assign({}, opt.headers || {});
    if (typeof getCalismaApiKey === "function" && getCalismaApiKey()) {
      headers["X-API-Key"] = getCalismaApiKey();
    }
    if (typeof getCalismaSessionToken === "function" && getCalismaSessionToken()) {
      headers["X-Calisma-Session"] = getCalismaSessionToken();
    }
    opt.headers = headers;
    if (typeof getCalismaApiBase === "function" && getCalismaApiBase()) {
      opt.credentials = "omit";
    } else if (opt.credentials === undefined) {
      opt.credentials = "include";
    }
    return fetch(url, opt);
  }

  function pushStateToServer(state) {
    if (typeof fetch === "undefined") return;
    try {
      apiFetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      }).catch(function () {});
    } catch (e) {}
  }

  function pushStateToServerImmediate(state) {
    persistStateLocal(state);
    pushStateToServer(state);
  }

  function saveState(state) {
    persistStateLocal(state);
    if (typeof fetch === "undefined") return;
    if (_serverSaveTimer) clearTimeout(_serverSaveTimer);
    _serverSaveTimer = setTimeout(function () {
      _serverSaveTimer = null;
      pushStateToServer(state);
    }, 500);
  }

  function startOfWeekMonday(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = x.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function isInCurrentWeek(iso) {
    var t = new Date(iso);
    var start = startOfWeekMonday(new Date());
    var end = new Date(start);
    end.setDate(end.getDate() + 7);
    return t >= start && t < end;
  }

  function dateKeyLocal(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1);
    if (m.length < 2) m = "0" + m;
    var day = String(d.getDate());
    if (day.length < 2) day = "0" + day;
    return y + "-" + m + "-" + day;
  }

  function parseDateKey(key) {
    var p = key.split("-");
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }

  function investmentSignedAmount(s) {
    if (!s || s.category !== "investment") return 0;
    var a = s.amount;
    if (a == null || isNaN(Number(a))) return 0;
    a = Number(a);
    if (s.investAction === "satis") return -Math.abs(a);
    return Math.abs(a);
  }

  function investmentVolumeAmount(s) {
    if (!s || s.category !== "investment") return 0;
    var a = s.amount;
    if (a == null || isNaN(Number(a))) return 0;
    return Math.abs(Number(a));
  }

  function investmentAssetLabel(s) {
    return (s.assetName && String(s.assetName).trim()) || "—";
  }

  var MONTH_NAMES_TR = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ];
  var MONTH_SHORT_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

  function migrateYatirimPeriodStorage() {
    if (sessionStorage.getItem("yatirimMode")) return;
    var old = sessionStorage.getItem("yatirimPeriod");
    if (old === "week") sessionStorage.setItem("yatirimMode", "week");
    else sessionStorage.setItem("yatirimMode", "month");
  }

  function ensureYatirimPickerDefaults() {
    var n = new Date();
    var cy = n.getFullYear();
    if (!sessionStorage.getItem("yatirimYear")) sessionStorage.setItem("yatirimYear", String(cy));
    if (!sessionStorage.getItem("yatirimMonth")) sessionStorage.setItem("yatirimMonth", String(n.getMonth() + 1));
    if (!sessionStorage.getItem("yatirimWeekRef")) {
      var m = String(n.getMonth() + 1);
      if (m.length < 2) m = "0" + m;
      var d = String(n.getDate());
      if (d.length < 2) d = "0" + d;
      sessionStorage.setItem("yatirimWeekRef", cy + "-" + m + "-" + d);
    }
  }

  function fillYatirimYearSelect(sel) {
    if (!sel || sel.options.length) return;
    var n = new Date().getFullYear();
    for (var y = n - 5; y <= n + 2; y++) {
      var opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      sel.appendChild(opt);
    }
  }

  function fillYatirimMonthSelect(sel) {
    if (!sel || sel.options.length) return;
    for (var i = 0; i < 12; i++) {
      var opt = document.createElement("option");
      opt.value = String(i + 1);
      opt.textContent = MONTH_NAMES_TR[i];
      sel.appendChild(opt);
    }
  }

  function getYatirimPeriodRange() {
    migrateYatirimPeriodStorage();
    ensureYatirimPickerDefaults();
    var mode = sessionStorage.getItem("yatirimMode") || "month";
    var y = parseInt(sessionStorage.getItem("yatirimYear") || String(new Date().getFullYear()), 10);
    if (isNaN(y) || y < 1970 || y > 2100) y = new Date().getFullYear();

    if (mode === "year") {
      var ys = new Date(y, 0, 1);
      var ye = new Date(y + 1, 0, 1);
      return { mode: mode, start: ys, end: ye, label: String(y) };
    }
    if (mode === "month") {
      var mo = parseInt(sessionStorage.getItem("yatirimMonth") || "1", 10);
      if (isNaN(mo) || mo < 1 || mo > 12) mo = new Date().getMonth() + 1;
      var ms = new Date(y, mo - 1, 1);
      var me = new Date(y, mo, 1);
      return { mode: mode, start: ms, end: me, label: MONTH_NAMES_TR[mo - 1] + " " + y };
    }
    var weekRef = sessionStorage.getItem("yatirimWeekRef") || "";
    var ref;
    if (weekRef && /^\d{4}-\d{2}-\d{2}$/.test(weekRef)) {
      ref = parseDateKey(weekRef);
    } else {
      ref = new Date();
    }
    var ws = startOfWeekMonday(ref);
    var we = new Date(ws);
    we.setDate(we.getDate() + 7);
    var sunday = new Date(we);
    sunday.setDate(sunday.getDate() - 1);
    var label =
      ws.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) +
      " – " +
      sunday.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
    return { mode: "week", start: ws, end: we, label: label };
  }

  function sessionInRange(iso, start, end) {
    var t = new Date(iso);
    return t >= start && t < end;
  }

  function dateInputToStartMs(str) {
    if (!str || !String(str).trim()) return null;
    var p = String(str).split("-");
    if (p.length !== 3) return null;
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  function dateInputToEndMs(str) {
    if (!str || !String(str).trim()) return null;
    var p = String(str).split("-");
    if (p.length !== 3) return null;
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 23, 59, 59, 999);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  function investmentAmountSortValue(s) {
    var a = s.amount;
    if (a == null || isNaN(Number(a))) return null;
    return Number(a);
  }

  function investmentPriceSortValue(s) {
    if (s.sharePrice != null && !isNaN(s.sharePrice)) return Number(s.sharePrice);
    if (s.shareQuantity != null && !isNaN(s.shareQuantity)) return Number(s.shareQuantity);
    return null;
  }

  function applyYatirimFilters(rows) {
    var qEl = document.getElementById("yatirim-filter-q");
    var actEl = document.getElementById("yatirim-filter-action");
    var fromEl = document.getElementById("yatirim-filter-from");
    var toEl = document.getElementById("yatirim-filter-to");
    var qv = qEl && qEl.value ? String(qEl.value).trim().toLowerCase() : "";
    var act = actEl && actEl.value ? actEl.value : "";
    var fromMs = fromEl && fromEl.value ? dateInputToStartMs(fromEl.value) : null;
    var toMs = toEl && toEl.value ? dateInputToEndMs(toEl.value) : null;

    return rows.filter(function (s) {
      if (act && (s.investAction || "") !== act) return false;
      if (qv) {
        var name = (s.assetName || "").toLowerCase();
        var note = (s.note || "").toLowerCase();
        if (name.indexOf(qv) === -1 && note.indexOf(qv) === -1) return false;
      }
      var tMs = new Date(sessionEffectiveTime(s)).getTime();
      if (fromMs != null && tMs < fromMs) return false;
      if (toMs != null && tMs > toMs) return false;
      return true;
    });
  }

  function getYatirimTableSort() {
    return {
      col: sessionStorage.getItem("yatirimSortCol") || "date",
      dir: sessionStorage.getItem("yatirimSortDir") || "desc",
    };
  }

  var YATIRIM_SORT_DEFAULT_DIR = {
    date: "desc",
    asset: "asc",
    action: "asc",
    price: "desc",
    amount: "desc",
    note: "asc",
  };

  function sortYatirimRows(rows, col, dir) {
    var copy = rows.slice();
    var asc = dir === "asc";

    if (col === "date") {
      copy.sort(function (a, b) {
        var va = new Date(sessionEffectiveTime(a)).getTime();
        var vb = new Date(sessionEffectiveTime(b)).getTime();
        return asc ? va - vb : vb - va;
      });
    } else if (col === "asset") {
      copy.sort(function (a, b) {
        var r = String(a.assetName || "").localeCompare(String(b.assetName || ""), "tr");
        return asc ? r : -r;
      });
    } else if (col === "action") {
      copy.sort(function (a, b) {
        var r = String(a.investAction || "").localeCompare(String(b.investAction || ""), "tr");
        return asc ? r : -r;
      });
    } else if (col === "price") {
      copy.sort(function (a, b) {
        var va = investmentPriceSortValue(a);
        var vb = investmentPriceSortValue(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        var n = va - vb;
        return asc ? n : -n;
      });
    } else if (col === "amount") {
      copy.sort(function (a, b) {
        var va = investmentAmountSortValue(a);
        var vb = investmentAmountSortValue(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        var n = va - vb;
        return asc ? n : -n;
      });
    } else if (col === "note") {
      copy.sort(function (a, b) {
        var r = String(a.note || "").localeCompare(String(b.note || ""), "tr");
        return asc ? r : -r;
      });
    } else {
      copy.sort(function (a, b) {
        var va = new Date(sessionEffectiveTime(a)).getTime();
        var vb = new Date(sessionEffectiveTime(b)).getTime();
        return vb - va;
      });
    }
    return copy;
  }

  function updateYatirimSortHeaders() {
    var sort = getYatirimTableSort();
    document.querySelectorAll(".yatirim-th-btn[data-yatirim-sort]").forEach(function (btn) {
      var c = btn.getAttribute("data-yatirim-sort");
      var active = c === sort.col;
      btn.classList.toggle("yatirim-th-btn--active", active);
      var span = btn.querySelector(".yatirim-th__sort");
      if (span) span.textContent = active ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
      if (active) btn.setAttribute("aria-sort", sort.dir === "asc" ? "ascending" : "descending");
      else btn.removeAttribute("aria-sort");
    });
  }

  function formatMoneyTR(n) {
    if (n == null || isNaN(n)) return "—";
    return (
      Number(n).toLocaleString("tr-TR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }) + " ₺"
    );
  }

  var INV_CHART_COLORS = ["#0d9488", "#7c3aed", "#c2410c", "#15803d", "#0ea5e9", "#ca8a04", "#be123c", "#4f46e5", "#db2777"];

  function drawDonutPercentLabels(svg, entries, volume) {
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (volume <= 0 || !entries.length) return;
    var cx = 100;
    var cy = 100;
    var rOuter = 70;
    var rInner = 31;
    var rLabel = (rOuter + rInner) / 2;
    var angle = -Math.PI / 2;
    var NS = "http://www.w3.org/2000/svg";
    for (var i = 0; i < entries.length; i++) {
      var pct = entries[i].value / volume;
      var sweep = pct * 2 * Math.PI;
      var mid = angle + sweep / 2;
      var pctRounded = Math.round(pct * 100);
      if (pct >= 0.05 && pctRounded > 0) {
        var x = cx + rLabel * Math.cos(mid);
        var y = cy + rLabel * Math.sin(mid);
        var te = document.createElementNS(NS, "text");
        te.setAttribute("x", String(x));
        te.setAttribute("y", String(y));
        te.setAttribute("text-anchor", "middle");
        te.setAttribute("dominant-baseline", "central");
        te.setAttribute("class", "yatirim-donut-pct");
        te.textContent = pctRounded + "%";
        svg.appendChild(te);
      }
      angle += sweep;
    }
  }

  function formatYatirimBarAmount(v) {
    if (v == null || isNaN(v)) return "—";
    if (v === 0) return "0 ₺";
    return formatMoneyTR(v);
  }

  function buildConicGradient(entries) {
    var total = 0;
    for (var i = 0; i < entries.length; i++) total += entries[i].value;
    if (total <= 0) return "";
    var acc = 0;
    var parts = [];
    for (var j = 0; j < entries.length; j++) {
      var pct = (entries[j].value / total) * 100;
      var startPct = acc;
      acc += pct;
      parts.push(entries[j].color + " " + startPct + "% " + acc + "%");
    }
    return "conic-gradient(" + parts.join(", ") + ")";
  }

  function minutesByDayFromSessions() {
    var map = {};
    state.sessions.forEach(function (s) {
      var k = dateKeyLocal(new Date(s.createdAt));
      map[k] = (map[k] || 0) + (s.durationMinutes || 0);
    });
    return map;
  }

  function dayAggregates() {
    var tot = {};
    var en = {};
    var tech = {};
    var book = {};
    var inv = {};
    state.sessions.forEach(function (s) {
      var k = dateKeyLocal(new Date(s.createdAt));
      var dm = s.durationMinutes || 0;
      tot[k] = (tot[k] || 0) + dm;
      if (s.category === "english") en[k] = (en[k] || 0) + dm;
      else if (s.category === "technical") tech[k] = (tech[k] || 0) + dm;
      else if (s.category === "book") book[k] = (book[k] || 0) + dm;
      else if (s.category === "investment") inv[k] = (inv[k] || 0) + dm;
    });
    return { tot: tot, en: en, tech: tech, book: book, inv: inv };
  }

  /** Günlük dakika, oturum tarihi için `sessionEffectiveTime` (yatırım işlem tarihi vb.) */
  function dayCategoryMapsByEffectiveDate() {
    var en = {};
    var tech = {};
    var book = {};
    var inv = {};
    state.sessions.forEach(function (s) {
      var iso = sessionEffectiveTime(s);
      if (!iso) return;
      var k = dateKeyLocal(new Date(iso));
      var dm = s.durationMinutes || 0;
      if (s.category === "english") en[k] = (en[k] || 0) + dm;
      else if (s.category === "technical") tech[k] = (tech[k] || 0) + dm;
      else if (s.category === "book") book[k] = (book[k] || 0) + dm;
      else if (s.category === "investment") inv[k] = (inv[k] || 0) + dm;
    });
    return { en: en, tech: tech, book: book, inv: inv };
  }

  var dashboardChartWeek = null;
  var dashboardChartDaily = null;

  function destroyDashboardCharts() {
    if (typeof Chart === "undefined") return;
    if (dashboardChartWeek) {
      dashboardChartWeek.destroy();
      dashboardChartWeek = null;
    }
    if (dashboardChartDaily) {
      dashboardChartDaily.destroy();
      dashboardChartDaily = null;
    }
  }

  function toggleChartCardEmpty(card, showEmpty, emptyText) {
    if (!card) return;
    var emptyEl = card.querySelector(".chart-empty");
    var wrap = card.querySelector(".chart-card__canvas-wrap");
    if (emptyEl) {
      emptyEl.textContent = emptyText || "";
      emptyEl.hidden = !showEmpty;
    }
    if (wrap) wrap.hidden = showEmpty;
  }

  function renderDashboardCharts() {
    var canvasWeek = document.getElementById("chart-week-categories");
    var canvasDaily = document.getElementById("chart-daily-7");
    if (!canvasWeek && !canvasDaily) return;

    destroyDashboardCharts();
    if (typeof Chart === "undefined") return;

    var w = weeklyMinutes();
    if (canvasWeek) {
      var cardW = canvasWeek.closest(".chart-card");
      if (w.total <= 0) {
        toggleChartCardEmpty(cardW, true, "Bu hafta henüz kayıt yok.");
      } else {
        toggleChartCardEmpty(cardW, false, "");
        var labelsW = [];
        var dataW = [];
        var colorsW = [];
        if (w.en > 0) {
          labelsW.push("YDS");
          dataW.push(w.en);
          colorsW.push("#0d9488");
        }
        if (w.tech > 0) {
          labelsW.push("Teknik");
          dataW.push(w.tech);
          colorsW.push("#7c3aed");
        }
        if (w.book > 0) {
          labelsW.push("Kitap");
          dataW.push(w.book);
          colorsW.push("#d97706");
        }
        if (w.inv > 0) {
          labelsW.push("Yatırım");
          dataW.push(w.inv);
          colorsW.push("#2563eb");
        }
        dashboardChartWeek = new Chart(canvasWeek, {
          type: "doughnut",
          data: {
            labels: labelsW,
            datasets: [
              {
                data: dataW,
                backgroundColor: colorsW,
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "58%",
            plugins: {
              legend: {
                position: "bottom",
                labels: { boxWidth: 12, padding: 10, font: { size: 11 } },
              },
              tooltip: {
                callbacks: {
                  label: function (ctx) {
                    var v = ctx.raw != null ? ctx.raw : 0;
                    return (ctx.label || "") + ": " + v + " dk";
                  },
                },
              },
            },
          },
        });
      }
    }

    if (canvasDaily) {
      var maps = dayCategoryMapsByEffectiveDate();
      var labels7 = [];
      var dEn = [];
      var dTech = [];
      var dBook = [];
      var dInv = [];
      var i;
      var dailySum = 0;
      for (i = 6; i >= 0; i--) {
        var d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        var key = dateKeyLocal(d);
        labels7.push(d.getDate() + " " + MONTH_SHORT_TR[d.getMonth()]);
        var e = maps.en[key] || 0;
        var t = maps.tech[key] || 0;
        var b = maps.book[key] || 0;
        var iv = maps.inv[key] || 0;
        dEn.push(e);
        dTech.push(t);
        dBook.push(b);
        dInv.push(iv);
        dailySum += e + t + b + iv;
      }
      var cardD = canvasDaily.closest(".chart-card");
      if (dailySum <= 0) {
        toggleChartCardEmpty(cardD, true, "Son 7 günde kayıt yok.");
      } else {
        toggleChartCardEmpty(cardD, false, "");
        dashboardChartDaily = new Chart(canvasDaily, {
          type: "bar",
          data: {
            labels: labels7,
            datasets: [
              { label: "YDS", data: dEn, backgroundColor: "#0d9488", borderWidth: 0 },
              { label: "Teknik", data: dTech, backgroundColor: "#7c3aed", borderWidth: 0 },
              { label: "Kitap", data: dBook, backgroundColor: "#d97706", borderWidth: 0 },
              { label: "Yatırım", data: dInv, backgroundColor: "#2563eb", borderWidth: 0 },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { stacked: true, grid: { display: false } },
              y: {
                stacked: true,
                beginAtZero: true,
                ticks: {
                  callback: function (val) {
                    return val + " dk";
                  },
                },
              },
            },
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
              tooltip: { mode: "index", intersect: false },
            },
          },
        });
      }
    }
  }

  function getStreakMin() {
    var v = state.goals.streakMinMinutesPerDay;
    if (v == null || v < 1) return 15;
    return v;
  }

  function programStartDateKey(yds) {
    var y = mergeYds(yds);
    var p = (y.programStartDate && String(y.programStartDate).trim()) || "";
    return /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : "";
  }

  /** Günlük dakika haritasında program başlangıcından önceki günleri çıkarır. */
  function filterDateKeysFrom(map, minDateKey) {
    if (!minDateKey || !/^\d{4}-\d{2}-\d{2}$/.test(minDateKey)) return map;
    var out = {};
    Object.keys(map).forEach(function (k) {
      if (k >= minDateKey) out[k] = map[k];
    });
    return out;
  }

  function isDayActive(minutesMap, key, min) {
    return (minutesMap[key] || 0) >= min;
  }

  function computeCurrentStreak(minutesMap, min) {
    var now = new Date();
    var todayKey = dateKeyLocal(now);
    var y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    var yesterdayKey = dateKeyLocal(y);

    var activeToday = isDayActive(minutesMap, todayKey, min);
    var activeYesterday = isDayActive(minutesMap, yesterdayKey, min);
    if (!activeToday && !activeYesterday) return 0;

    var start = activeToday ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : y;
    var count = 0;
    var cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (true) {
      var k = dateKeyLocal(cursor);
      if (isDayActive(minutesMap, k, min)) {
        count += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
    return count;
  }

  function computeLongestStreak(minutesMap, min) {
    var keys = Object.keys(minutesMap).filter(function (k) {
      return isDayActive(minutesMap, k, min);
    });
    keys.sort();
    if (keys.length === 0) return 0;
    var best = 1;
    var run = 1;
    for (var i = 1; i < keys.length; i++) {
      var a = parseDateKey(keys[i - 1]);
      var b = parseDateKey(keys[i]);
      var diff = Math.round((b - a) / 86400000);
      if (diff === 1) {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 1;
      }
    }
    return best;
  }

  /** YDS: gün içinde herhangi bir YDS dakikası (>0) varsa o gün seriye sayılır; üst üste boş gün olmamalı. */
  function ydsStreakDayActive(minutesMap, key) {
    return (minutesMap[key] || 0) > 0;
  }

  function computeCurrentStreakYds(minutesMap) {
    var now = new Date();
    var todayKey = dateKeyLocal(now);
    var y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    var yesterdayKey = dateKeyLocal(y);

    var activeToday = ydsStreakDayActive(minutesMap, todayKey);
    var activeYesterday = ydsStreakDayActive(minutesMap, yesterdayKey);
    if (!activeToday && !activeYesterday) return 0;

    var start = activeToday ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : y;
    var count = 0;
    var cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (true) {
      var k = dateKeyLocal(cursor);
      if (ydsStreakDayActive(minutesMap, k)) {
        count += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
    return count;
  }

  function computeLongestStreakYds(minutesMap) {
    var keys = Object.keys(minutesMap).filter(function (k) {
      return ydsStreakDayActive(minutesMap, k);
    });
    keys.sort();
    if (keys.length === 0) return 0;
    var best = 1;
    var run = 1;
    var i;
    for (i = 1; i < keys.length; i++) {
      var a = parseDateKey(keys[i - 1]);
      var b = parseDateKey(keys[i]);
      var diff = Math.round((b - a) / 86400000);
      if (diff === 1) {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 1;
      }
    }
    return best;
  }

  function uid() {
    return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
  }

  var enSkillLabels = {
    dinleme: "Dinleme",
    konusma: "Konuşma",
    okuma: "Okuma",
    yazma: "Yazma",
    kelime: "Kelime",
  };

  function parseNonNegInt(val) {
    var n = parseInt(val, 10);
    return isNaN(n) || n < 0 ? 0 : n;
  }

  var enSubtypeLabels = {
    grammar: "Grammar",
    cloze: "Cloze",
    tr_eng: "TR→EN",
    eng_tr: "EN→TR",
    passage: "Passage",
    paragraf: "Paragraf",
    deneme: "Deneme",
    kelime: "Kelime ezber",
  };

  function readEnScoreFromForm(elForm) {
    var d = elForm.enDogru ? parseNonNegInt(elForm.enDogru.value) : 0;
    var y = elForm.enYanlis ? parseNonNegInt(elForm.enYanlis.value) : 0;
    var b = elForm.enBos ? parseNonNegInt(elForm.enBos.value) : 0;
    return { dogru: d, yanlis: y, bos: b };
  }

  function validateEnScoreVsQ(q, score) {
    if (q <= 0) return true;
    var sum = score.dogru + score.yanlis + score.bos;
    if (sum > q) {
      alert("Doğru + yanlış + boş toplamı, soru sayısını (" + q + ") geçemez.");
      return false;
    }
    return true;
  }

  function formatEnglishSessionMeta(s) {
    var parts = [];
    if (s.enSubtype && enSubtypeLabels[s.enSubtype]) parts.push(enSubtypeLabels[s.enSubtype]);
    if (s.enSkill && enSkillLabels[s.enSkill]) parts.push(enSkillLabels[s.enSkill]);
    var c = s.enCounts;
    if (c && typeof c === "object") {
      var g = parseNonNegInt(c.grammar);
      var cl = parseNonNegInt(c.cloze);
      var te = parseNonNegInt(c.trEng);
      var et = parseNonNegInt(c.engTr);
      var pa = parseNonNegInt(c.passage);
      var par = parseNonNegInt(c.paragrafAtama);
      var dn = parseNonNegInt(c.deneme);
      if (g) parts.push("Gr:" + g);
      if (cl) parts.push("Cloze:" + cl);
      if (te) parts.push("TR→EN:" + te);
      if (et) parts.push("EN→TR:" + et);
      if (pa) parts.push("Passage:" + pa);
      if (par) parts.push("Par.:" + par);
      if (dn) parts.push("Deneme:" + dn);
    }
    if (s.enGrammarMinutes != null && s.enGrammarMinutes > 0) parts.push("Gr " + s.enGrammarMinutes + " dk");
    if (s.enKelimeEzberMinutes != null && s.enKelimeEzberMinutes > 0) parts.push("Ezber " + s.enKelimeEzberMinutes + " dk");
    if (s.enKelimeSayisi != null && s.enKelimeSayisi > 0) parts.push(s.enKelimeSayisi + " kelime");
    var sc = s.enScore;
    if (sc && typeof sc === "object") {
      var sd = parseNonNegInt(sc.dogru);
      var sy = parseNonNegInt(sc.yanlis);
      var sb = parseNonNegInt(sc.bos);
      if (sd + sy + sb > 0) {
        parts.push("D:" + sd + " Y:" + sy + (sb ? " B:" + sb : ""));
      }
    }
    return parts.length ? parts.join(" · ") : "";
  }

  var categoryLabels = {
    english: "YDS",
    technical: "Teknik",
    book: "Kitap",
    investment: "Yatırım",
  };

  var investActionLabels = {
    arastirma: "Araştırma / not",
    alis: "Alış",
    satis: "Satış",
    gelir: "Gelir / temettü",
    diger: "Diğer",
  };

  var state = loadState();

  /** YDS: sınav tarihi girildikten sonra alan gizlenir; düzenlemede tekrar açılır */
  var ydsExamDateEditing = false;
  var ydsScoreEditing = false;
  var ydsApplicationEditing = false;

  var ydsCalView = {
    y: new Date().getFullYear(),
    m: new Date().getMonth(),
  };
  var ydsTrendChart = null;
  var ydsDenemeChart = null;

  var timerElapsedSec = 0;
  var timerInterval = null;
  var timerRunning = false;

  var page = document.body.getAttribute("data-page") || "";

  function q(id) {
    return document.getElementById(id);
  }

  var el = {};
  if (page === "dashboard") {
    el = {
      streakCurrent: q("streak-current"),
      streakBest: q("streak-best"),
      statWeekTotal: q("stat-week-total"),
      statWeekEn: q("stat-week-en"),
      statWeekTech: q("stat-week-tech"),
      statWeekBook: q("stat-week-book"),
      statWeekInv: q("stat-week-inv"),
      barEn: q("bar-en"),
      barTech: q("bar-tech"),
      barBook: q("bar-book"),
      barInv: q("bar-inv"),
      btnExport: q("btn-export"),
      importFile: q("import-file"),
    };
  } else if (page === "yeni") {
    el = {
      timerDisplay: q("timer-display"),
      btnStart: q("btn-timer-start"),
      btnPause: q("btn-timer-pause"),
      btnReset: q("btn-timer-reset"),
      btnUseTimer: q("btn-use-timer"),
      form: q("form-session"),
      category: q("category"),
      wrapEnDetail: q("wrap-en-detail"),
      wrapTechTopic: q("wrap-tech-topic"),
      wrapBook: q("wrap-book"),
      wrapBookNewOnly: q("wrap-book-new-only"),
      wrapInvest: q("wrap-invest"),
      bookSelect: q("book-select"),
      bookTitleNew: q("book-title-new"),
      bookAuthor: q("book-author"),
      bookPagesRead: q("book-pages-read"),
      bookTotalPages: q("book-total-pages"),
      bookFinished: q("book-finished"),
      bookDateStart: q("book-date-start"),
      bookDateEnd: q("book-date-end"),
      investAsset: q("invest-asset"),
      investAmount: q("invest-amount"),
      investSharePrice: q("invest-share-price"),
      investAction: q("invest-action"),
      investDate: q("invest-date"),
      investTime: q("invest-time"),
      wrapDuration: q("wrap-duration"),
      enSubtype: q("en-subtype"),
      wrapEnOtherMin: q("wrap-en-other-min"),
      enOtherMin: q("en-other-min"),
      enGrammarMin: q("en-grammar-min"),
      enKelimeEzberMin: q("en-kelime-ezber-min"),
      enKelimeSayisi: q("en-kelime-sayisi"),
      enQGrammar: q("en-q-grammar"),
      enQCloze: q("en-q-cloze"),
      enQTrEng: q("en-q-tr-eng"),
      enQEngTr: q("en-q-eng-tr"),
      enQPassage: q("en-q-passage"),
      enQParagraf: q("en-q-paragraf"),
      enQDeneme: q("en-q-deneme"),
      wrapEnDy: q("wrap-en-dy"),
      enDogru: q("en-dogru"),
      enYanlis: q("en-yanlis"),
      enBos: q("en-bos"),
      techTopic: q("tech-topic"),
      duration: q("duration"),
      note: q("note"),
      tags: q("tags"),
      btnExport: q("btn-export"),
      importFile: q("import-file"),
    };
  } else if (page === "gecmis") {
    el = {
      sessionList: q("session-list"),
      emptyMsg: q("empty-msg"),
      filterCategory: q("filter-category"),
      btnExport: q("btn-export"),
      importFile: q("import-file"),
    };
  } else if (page === "kitaplar" || page === "yatirim" || page === "yds") {
    el = {
      btnExport: q("btn-export"),
      importFile: q("import-file"),
    };
  }

  function formatTimer(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function updateTimerDisplay() {
    if (!el.timerDisplay) return;
    el.timerDisplay.textContent = formatTimer(timerElapsedSec);
  }

  function tick() {
    timerElapsedSec += 1;
    updateTimerDisplay();
  }

  function startTimer() {
    if (timerRunning || !el.btnStart) return;
    timerRunning = true;
    el.btnStart.disabled = true;
    el.btnPause.disabled = false;
    timerInterval = setInterval(tick, 1000);
  }

  function pauseTimer() {
    if (!timerRunning || !el.btnPause) return;
    timerRunning = false;
    clearInterval(timerInterval);
    timerInterval = null;
    el.btnStart.disabled = false;
    el.btnPause.disabled = true;
  }

  function resetTimer() {
    pauseTimer();
    timerElapsedSec = 0;
    updateTimerDisplay();
    if (el.btnPause) el.btnPause.disabled = true;
  }

  function syncEnglishSubtypeUI() {
    if (!el.wrapEnDetail || !el.enSubtype) return;
    var st = el.enSubtype.value;
    var showOther = ["cloze", "tr_eng", "eng_tr", "passage", "paragraf", "deneme"].indexOf(st) >= 0;
    var showDy = ["grammar", "cloze", "tr_eng", "eng_tr", "passage", "paragraf", "deneme"].indexOf(st) >= 0;
    el.wrapEnDetail.querySelectorAll(".form-en-panel[data-en-panel]").forEach(function (p) {
      var key = p.getAttribute("data-en-panel");
      p.classList.toggle("form-en-panel--hidden", key !== st);
    });
    if (el.wrapEnOtherMin) el.wrapEnOtherMin.classList.toggle("form-en-panel--hidden", !showOther);
    if (el.wrapEnDy) el.wrapEnDy.classList.toggle("form-en-panel--hidden", !showDy);
  }

  function syncCategoryUI() {
    if (!el.category) return;
    var cat = el.category.value;
    if (el.wrapEnDetail) el.wrapEnDetail.classList.add("form-block--hidden");
    if (el.wrapTechTopic) el.wrapTechTopic.classList.add("form__row--hidden");
    if (el.wrapBook) el.wrapBook.classList.add("form-block--hidden");
    if (el.wrapInvest) el.wrapInvest.classList.add("form-block--hidden");
    if (cat === "english" && el.wrapEnDetail) {
      el.wrapEnDetail.classList.remove("form-block--hidden");
      syncEnglishSubtypeUI();
    } else if (cat === "technical" && el.wrapTechTopic) el.wrapTechTopic.classList.remove("form__row--hidden");
    else if (cat === "book" && el.wrapBook) {
      el.wrapBook.classList.remove("form-block--hidden");
      syncBookNewFields();
      populateBookDateInputs();
    } else if (cat === "investment" && el.wrapInvest) el.wrapInvest.classList.remove("form-block--hidden");
    if (el.wrapDuration) {
      if (cat === "investment" || cat === "english") el.wrapDuration.classList.add("form__row--hidden");
      else el.wrapDuration.classList.remove("form__row--hidden");
    }
    if (el.duration) el.duration.required = false;
  }

  function syncBookNewFields() {
    if (!el.bookSelect || !el.wrapBookNewOnly) return;
    var isNew = el.bookSelect.value === "new";
    if (isNew) {
      el.wrapBookNewOnly.classList.remove("book-new-only--hidden");
    } else {
      el.wrapBookNewOnly.classList.add("book-new-only--hidden");
    }
  }

  function parseTags(str) {
    if (!str || !str.trim()) return [];
    return str
      .split(",")
      .map(function (t) {
        return t.trim();
      })
      .filter(Boolean);
  }

  function weeklyMinutes() {
    var en = 0;
    var tech = 0;
    var book = 0;
    var inv = 0;
    state.sessions.forEach(function (s) {
      if (!isInCurrentWeek(sessionEffectiveTime(s))) return;
      var dm = s.durationMinutes || 0;
      if (s.category === "english") en += dm;
      else if (s.category === "technical") tech += dm;
      else if (s.category === "book") book += dm;
      else if (s.category === "investment") inv += dm;
    });
    return { en: en, tech: tech, book: book, inv: inv, total: en + tech + book + inv };
  }

  function ensureBook(title, author, totalPages) {
    var t = (title || "").trim();
    if (!t) return null;
    var found = null;
    state.books.forEach(function (b) {
      if (b.title.toLowerCase() === t.toLowerCase()) found = b;
    });
    if (found) {
      if (author && !found.author) found.author = author.trim();
      if (totalPages && !found.totalPages) found.totalPages = totalPages;
      saveState(state);
      return found.id;
    }
    var id = "b_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
    state.books.push({
      id: id,
      title: t,
      author: (author || "").trim(),
      totalPages: totalPages || null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    });
    saveState(state);
    return id;
  }

  function markBookFinished(bookId) {
    if (!bookId) return;
    state.books.forEach(function (b) {
      if (b.id === bookId) b.finishedAt = new Date().toISOString();
    });
    saveState(state);
  }

  function bookSessionsForId(bookId) {
    return state.sessions
      .filter(function (s) {
        return s.category === "book" && s.bookId === bookId;
      })
      .sort(function (a, b) {
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
  }

  function sumPagesForBook(bookId) {
    var sum = 0;
    state.sessions.forEach(function (s) {
      if (s.category === "book" && s.bookId === bookId) sum += s.pagesRead || 0;
    });
    return sum;
  }

  function sumMinutesForBook(bookId) {
    var sum = 0;
    state.sessions.forEach(function (s) {
      if (s.category === "book" && s.bookId === bookId) sum += s.durationMinutes || 0;
    });
    return sum;
  }

  function renderStats() {
    if (el.statWeekTotal) {
      var w = weeklyMinutes();
      var su = page === "dashboard" ? "" : " dk";
      el.statWeekTotal.textContent = w.total + su;
      el.statWeekEn.textContent = w.en + su;
      el.statWeekTech.textContent = w.tech + su;
      if (el.statWeekBook) el.statWeekBook.textContent = w.book + su;
      if (el.statWeekInv) el.statWeekInv.textContent = w.inv + su;

      var maxBar = Math.max(w.en, w.tech, w.book, w.inv, 1);
      el.barEn.style.width = Math.round((w.en / maxBar) * 100) + "%";
      el.barTech.style.width = Math.round((w.tech / maxBar) * 100) + "%";
      if (el.barBook) el.barBook.style.width = Math.round((w.book / maxBar) * 100) + "%";
      if (el.barInv) el.barInv.style.width = Math.round((w.inv / maxBar) * 100) + "%";

      renderStreak();
    }
    renderDashboardCharts();
  }

  function renderStreak() {
    if (!el.streakCurrent) return;
    state.yds = mergeYds(state.yds);
    var ps = programStartDateKey(state.yds);
    var maps = dayCategoryMapsByEffectiveDate();
    var minutesMap = ps ? filterDateKeysFrom(maps.en || {}, ps) : maps.en || {};
    var current = computeCurrentStreakYds(minutesMap);
    var longest = computeLongestStreakYds(minutesMap);

    var now = new Date();
    var todayKey = dateKeyLocal(now);
    if (ps && todayKey < ps) {
      el.streakCurrent.textContent = "0";
      el.streakBest.textContent = "0 gün";
      return;
    }

    el.streakCurrent.textContent = String(current);
    el.streakBest.textContent = longest + " gün";
  }

  function formatSessionDate(iso) {
    var d = new Date(iso);
    return d.toLocaleString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDateOnly(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function isoToDateInputValue(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1);
    if (m.length < 2) m = "0" + m;
    var day = String(d.getDate());
    if (day.length < 2) day = "0" + day;
    return y + "-" + m + "-" + day;
  }

  function dateInputToIsoLocal(dateStr) {
    if (!dateStr || !String(dateStr).trim()) return null;
    var p = String(dateStr).split("-");
    if (p.length !== 3) return null;
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 12, 0, 0);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function investDateTimeFromInputs(dateInput, timeInput) {
    var ds = dateInput && dateInput.value ? String(dateInput.value).trim() : "";
    if (!ds) return null;
    var p = ds.split("-");
    if (p.length !== 3) return null;
    var y = parseInt(p[0], 10);
    var mo = parseInt(p[1], 10) - 1;
    var d = parseInt(p[2], 10);
    var h = 12;
    var mi = 0;
    if (timeInput && timeInput.value && String(timeInput.value).trim()) {
      var tp = String(timeInput.value).trim().split(":");
      h = parseInt(tp[0], 10);
      mi = parseInt(tp[1], 10) || 0;
      if (isNaN(h)) h = 12;
    }
    var dt = new Date(y, mo, d, h, mi, 0, 0);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }

  function sessionEffectiveTime(s) {
    if (!s) return "";
    if (s.category === "investment" && s.transactionAt) return s.transactionAt;
    return s.createdAt;
  }

  function applyBookDatesToBook(bookId, startVal, endVal) {
    if (!bookId) return;
    var sv = startVal && String(startVal).trim();
    var ev = endVal && String(endVal).trim();
    state.books.forEach(function (b) {
      if (b.id !== bookId) return;
      if (sv) b.startedAt = dateInputToIsoLocal(sv);
      if (ev) b.finishedAt = dateInputToIsoLocal(ev);
    });
    saveState(state);
  }

  function applyBookMetaEdit(bookId, title, author, totalPagesRaw) {
    if (!bookId) return false;
    var t = (title || "").trim();
    if (!t) {
      alert("Kitap adı boş olamaz.");
      return false;
    }
    var auth = (author || "").trim() || null;
    var tp = null;
    if (totalPagesRaw !== undefined && totalPagesRaw !== null && String(totalPagesRaw).trim() !== "") {
      var n = parseInt(totalPagesRaw, 10);
      tp = isNaN(n) || n < 1 ? null : n;
    }
    var found = false;
    state.books.forEach(function (b) {
      if (b.id !== bookId) return;
      found = true;
      b.title = t;
      b.author = auth;
      if (totalPagesRaw !== undefined && totalPagesRaw !== null) {
        b.totalPages = tp;
      }
    });
    if (!found) return false;
    state.sessions.forEach(function (s) {
      if (s.category === "book" && s.bookId === bookId) {
        s.bookTitle = t;
      }
    });
    saveState(state);
    renderStats();
    renderList();
    refreshBookInvestPages();
    if (page === "yeni" && el.bookSelect) populateBookSelect();
    return true;
  }

  function syncMissingBookStartDates() {
    var changed = false;
    state.books.forEach(function (b) {
      var subs = bookSessionsForId(b.id);
      if (subs.length > 0 && !b.startedAt) {
        b.startedAt = subs[0].createdAt;
        changed = true;
      }
    });
    if (changed) saveState(state);
  }

  function renderList() {
    if (!el.sessionList) return;
    var filter = el.filterCategory.value;
    var list = state.sessions.slice().sort(function (a, b) {
      return new Date(sessionEffectiveTime(b)) - new Date(sessionEffectiveTime(a));
    });
    if (filter) {
      list = list.filter(function (s) {
        return s.category === filter;
      });
    }

    el.sessionList.innerHTML = "";
    if (list.length === 0) {
      el.emptyMsg.classList.add("is-visible");
      return;
    }
    el.emptyMsg.classList.remove("is-visible");

    list.forEach(function (s) {
      var li = document.createElement("li");
      li.className = "session-item";
      li.dataset.id = s.id;

      var badgeClass = "session-item__badge--tech";
      if (s.category === "english") badgeClass = "session-item__badge--en";
      else if (s.category === "book") badgeClass = "session-item__badge--book";
      else if (s.category === "investment") badgeClass = "session-item__badge--inv";
      var badgeText = categoryLabels[s.category] || s.category;

      var metaParts = [];
      if (s.category === "english") {
        var enMeta = formatEnglishSessionMeta(s);
        if (enMeta) metaParts.push(enMeta);
      }
      if (s.category === "technical" && s.techTopic) {
        metaParts.push(s.techTopic);
      }
      if (s.category === "book") {
        if (s.bookTitle) metaParts.push(s.bookTitle);
        if (s.pagesRead != null) metaParts.push(s.pagesRead + " syf");
      }
      if (s.category === "investment") {
        if (s.assetName) metaParts.push(s.assetName);
        if (s.sharePrice != null && !isNaN(s.sharePrice)) metaParts.push(String(s.sharePrice) + " ₺/adet");
        else if (s.shareQuantity != null && !isNaN(s.shareQuantity))
          metaParts.push(String(s.shareQuantity) + " adet (eski kayıt)");
        if (s.amount != null && !isNaN(s.amount)) metaParts.push(String(s.amount) + " " + (s.currency || "TRY"));
        if (s.investAction && investActionLabels[s.investAction]) metaParts.push(investActionLabels[s.investAction]);
      }
      if (s.tags && s.tags.length) {
        metaParts.push(s.tags.join(", "));
      }

      var top = document.createElement("div");
      top.className = "session-item__top";
      top.innerHTML =
        '<span class="session-item__badge ' +
        badgeClass +
        '">' +
        escapeHtml(badgeText) +
        "</span>" +
        '<span class="session-item__time">' +
        (s.category === "investment" ? "—" : String(s.durationMinutes || 0) + " dk") +
        "</span>" +
        '<span class="session-item__date">' +
        escapeHtml(formatSessionDate(sessionEffectiveTime(s))) +
        "</span>";

      li.appendChild(top);

      if (metaParts.length) {
        var meta = document.createElement("div");
        meta.className = "session-item__meta";
        meta.textContent = metaParts.join(" · ");
        li.appendChild(meta);
      }

      if (s.note) {
        var p = document.createElement("p");
        p.className = "session-item__note";
        p.textContent = s.note;
        li.appendChild(p);
      }

      var actions = document.createElement("div");
      actions.className = "session-item__actions";
      var del = document.createElement("button");
      del.type = "button";
      del.textContent = "Sil";
      del.addEventListener("click", function () {
        deleteSession(s.id);
      });
      actions.appendChild(del);
      li.appendChild(actions);

      el.sessionList.appendChild(li);
    });
  }

  function populateBookSelect() {
    if (!el.bookSelect) return;
    var sel = el.bookSelect;
    var cur = sel.value;
    sel.innerHTML = '<option value="new">+ Yeni kitap ekle (başlık aşağıda)</option>';
    state.books.forEach(function (b) {
      var opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.title + (b.author ? " — " + b.author : "");
      sel.appendChild(opt);
    });
    var ok = false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === cur) ok = true;
    }
    if (ok) sel.value = cur;
    syncBookNewFields();
    populateBookDateInputs();
  }

  function populateBookDateInputs() {
    if (!el.bookDateStart || !el.bookDateEnd || !el.bookSelect) return;
    var bid = el.bookSelect.value;
    if (bid === "new") {
      el.bookDateStart.value = "";
      el.bookDateEnd.value = "";
      return;
    }
    var bf = null;
    state.books.forEach(function (b) {
      if (b.id === bid) bf = b;
    });
    if (bf) {
      el.bookDateStart.value = isoToDateInputValue(bf.startedAt);
      el.bookDateEnd.value = isoToDateInputValue(bf.finishedAt);
    }
  }

  function deleteFinishedBook(bookId) {
    if (!bookId) return;
    if (!confirm("Bu kitabı ve bu kitaba ait tüm okuma oturumlarını silmek istediğine emin misin?")) return;
    state.books = state.books.filter(function (b) {
      return b.id !== bookId;
    });
    state.sessions = state.sessions.filter(function (s) {
      return !(s.category === "book" && s.bookId === bookId);
    });
    saveState(state);
    renderKitaplarPage();
    renderStats();
    renderList();
    refreshBookInvestPages();
    if (page === "yeni" && el.bookSelect) populateBookSelect();
  }

  var BOOK_ICON_SAVE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';

  var BOOK_ICON_CALENDAR_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

  var BOOK_ICON_TRASH_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

  var BOOK_ICON_INLINE_TITLE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

  var BOOK_ICON_INLINE_AUTHOR_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  var BOOK_ICON_INLINE_PAGES_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';

  var BOOK_ICON_INLINE_DATE_FROM_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

  var BOOK_ICON_INLINE_DATE_TO_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

  var BOOK_ICON_PENCIL_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

  function renderKitaplarStats() {
    var grid = document.getElementById("kitaplar-stats-grid");
    if (!grid) return;

    function aggregateBookRange(sessions, start, end) {
      var pages = 0;
      var minutes = 0;
      var bookIds = {};
      sessions.forEach(function (s) {
        if (s.category !== "book") return;
        var t = new Date(sessionEffectiveTime(s));
        if (isNaN(t.getTime()) || t < start || t >= end) return;
        pages += s.pagesRead || 0;
        minutes += s.durationMinutes || 0;
        if (s.bookId) bookIds[s.bookId] = true;
      });
      return {
        pages: pages,
        minutes: minutes,
        bookCount: Object.keys(bookIds).length,
      };
    }

    var now = new Date();
    var wStart = startOfWeekMonday(now);
    var wEnd = new Date(wStart);
    wEnd.setDate(wEnd.getDate() + 7);
    var mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    var mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    var yStart = new Date(now.getFullYear(), 0, 1);
    var yEnd = new Date(now.getFullYear() + 1, 0, 1);

    var sessions = state.sessions;
    var w = aggregateBookRange(sessions, wStart, wEnd);
    var mo = aggregateBookRange(sessions, mStart, mEnd);
    var y = aggregateBookRange(sessions, yStart, yEnd);

    function formatKitaplarWeekRange(mondayStart) {
      var sun = new Date(mondayStart);
      sun.setDate(sun.getDate() + 6);
      var d0 = mondayStart.getDate();
      var d1 = sun.getDate();
      var m0 = mondayStart.getMonth();
      var m1 = sun.getMonth();
      var y0 = mondayStart.getFullYear();
      var y1 = sun.getFullYear();
      if (m0 === m1 && y0 === y1) {
        return d0 + "–" + d1 + " " + MONTH_NAMES_TR[m0] + " " + y0;
      }
      if (y0 === y1) {
        return (
          d0 +
          " " +
          MONTH_NAMES_TR[m0] +
          " – " +
          d1 +
          " " +
          MONTH_NAMES_TR[m1] +
          " " +
          y0
        );
      }
      return (
        d0 +
        " " +
        MONTH_NAMES_TR[m0] +
        " " +
        y0 +
        " – " +
        d1 +
        " " +
        MONTH_NAMES_TR[m1] +
        " " +
        y1
      );
    }

    var monthWhen = MONTH_NAMES_TR[now.getMonth()] + " " + now.getFullYear();
    var yearWhen = String(now.getFullYear());
    var weekWhen = formatKitaplarWeekRange(wStart);

    function statCard(periodClass, kindLine, whenLine, d) {
      var aria = kindLine + ": " + whenLine;
      var al = escapeHtml(aria);
      return (
        '<article class="kitaplar-stat-card kitaplar-stat-card--' +
        periodClass +
        '" role="listitem">' +
        '<div class="kitaplar-stat-card__period">' +
        '<span class="kitaplar-period-badge kitaplar-period-badge--' +
        periodClass +
        '" aria-label="' +
        al +
        '">' +
        '<span class="kitaplar-period-badge__kind">' +
        escapeHtml(kindLine) +
        "</span>" +
        '<span class="kitaplar-period-badge__when">' +
        escapeHtml(whenLine) +
        "</span></span></div>" +
        '<dl class="kitaplar-stat-card__metrics">' +
        '<div class="kitaplar-stat-metric"><dt>Sayfa</dt><dd>' +
        d.pages +
        "</dd></div>" +
        '<div class="kitaplar-stat-metric"><dt>Süre</dt><dd>' +
        d.minutes +
        " dk</dd></div>" +
        '<div class="kitaplar-stat-metric"><dt>Kitap</dt><dd>' +
        d.bookCount +
        "</dd></div>" +
        "</dl></article>"
      );
    }

    grid.innerHTML =
      statCard("week", "Hafta", weekWhen, w) +
      statCard("month", "Ay", monthWhen, mo) +
      statCard("year", "Yıl", yearWhen, y);
  }

  function renderKitaplarPage() {
    var finishedEl = document.getElementById("kitaplar-finished-body");
    var timelineEl = document.getElementById("kitaplar-timeline");
    if (!finishedEl || !timelineEl) return;
    state = loadState();
    syncMissingBookStartDates();
    renderKitaplarStats();

    var finished = state.books
      .filter(function (b) {
        return b.finishedAt;
      })
      .sort(function (a, b) {
        return new Date(b.finishedAt) - new Date(a.finishedAt);
      });

    if (finished.length === 0) {
      finishedEl.innerHTML =
        '<tr><td colspan="10" class="kitaplar-empty-cell"><p class="kitaplar-empty-msg">Kayıt yok. <a href="yeni-kayit.html">Okuma ekle</a></p></td></tr>';
    } else {
      finishedEl.innerHTML = finished
        .map(function (b) {
          var mins = sumMinutesForBook(b.id);
          var pages = sumPagesForBook(b.id);
          var days = "";
          if (b.startedAt && b.finishedAt) {
            var d0 = new Date(b.startedAt);
            var d1 = new Date(b.finishedAt);
            days = String(Math.max(1, Math.ceil((d1 - d0) / 86400000))) + " gün";
          }
          return (
            "<tr><td>" +
            '<input type="text" class="book-edit-title" data-book-id="' +
            escapeHtml(b.id) +
            '" value="' +
            escapeHtml(b.title) +
            '" />' +
            "</td><td>" +
            '<input type="text" class="book-edit-author" data-book-id="' +
            escapeHtml(b.id) +
            '" value="' +
            escapeHtml(b.author || "") +
            '" />' +
            "</td><td>" +
            formatDateOnly(b.startedAt) +
            "</td><td>" +
            formatDateOnly(b.finishedAt) +
            "</td><td>" +
            mins +
            " dk</td><td>" +
            pages +
            " syf</td><td>" +
            '<input type="number" min="1" class="book-edit-pages" data-book-id="' +
            escapeHtml(b.id) +
            '" value="' +
            (b.totalPages ? String(b.totalPages) : "") +
            '" />' +
            "</td><td>" +
            days +
            '</td><td class="kitaplar-td--icon">' +
            '<button type="button" class="btn-icon btn-icon--save book-meta-save" data-book-id="' +
            escapeHtml(b.id) +
            '" aria-label="Bilgileri kaydet">' +
            BOOK_ICON_SAVE_SVG +
            "</button></td><td class=\"kitaplar-td--icon\">" +
            '<button type="button" class="btn-icon btn-icon--danger" data-book-delete="' +
            escapeHtml(b.id) +
            '" aria-label="Kitabı ve okuma kayıtlarını sil">' +
            BOOK_ICON_TRASH_SVG +
            "</button></td></tr>"
          );
        })
        .join("");
    }

    var ids = {};
    state.books.forEach(function (b) {
      ids[b.id] = b.title;
    });
    state.sessions.forEach(function (s) {
      if (s.category === "book" && s.bookId) {
        ids[s.bookId] = ids[s.bookId] || s.bookTitle || "Kitap";
      }
    });

    var bookIdList = Object.keys(ids);
    if (bookIdList.length === 0) {
      timelineEl.innerHTML =
        '<p class="kitaplar-timeline-empty">Kayıt yok. <a href="yeni-kayit.html">Okuma ekle</a></p>';
      return;
    }

    timelineEl.innerHTML = bookIdList
      .map(function (bid) {
        var title = ids[bid];
        var meta = state.books.filter(function (b) {
          return b.id === bid;
        })[0];
        var subs = bookSessionsForId(bid);
        if (subs.length === 0) {
          return (
            '<div class="book-block book-block--card"><h3 class="book-block__title">' +
            escapeHtml(title) +
            "</h3><p class=\"table-muted\">Oturum yok.</p></div>"
          );
        }
        var totalP = sumPagesForBook(bid);
        var totalM = sumMinutesForBook(bid);
        var startShow = meta && meta.startedAt ? meta.startedAt : subs[0] ? subs[0].createdAt : null;
        var endShow = meta && meta.finishedAt ? meta.finishedAt : null;
        var metaEdit =
          meta ?
            '<div class="book-meta-edit book-dates-edit book-dates-edit--inline">' +
            '<label class="book-dates-edit__field book-dates-edit__field--title">' +
            '<span class="book-dates-edit__ic">' +
            BOOK_ICON_INLINE_TITLE_SVG +
            '</span><input type="text" class="book-edit-title" data-book-id="' +
            escapeHtml(bid) +
            '" value="' +
            escapeHtml(meta.title) +
            '" aria-label="Kitap adı" title="Kitap adı" />' +
            "</label>" +
            '<label class="book-dates-edit__field">' +
            '<span class="book-dates-edit__ic">' +
            BOOK_ICON_INLINE_AUTHOR_SVG +
            '</span><input type="text" class="book-edit-author" data-book-id="' +
            escapeHtml(bid) +
            '" value="' +
            escapeHtml(meta.author || "") +
            '" aria-label="Yazar" title="Yazar" />' +
            "</label>" +
            '<label class="book-dates-edit__field book-dates-edit__field--narrow">' +
            '<span class="book-dates-edit__ic">' +
            BOOK_ICON_INLINE_PAGES_SVG +
            '</span><input type="number" min="1" class="book-edit-pages" data-book-id="' +
            escapeHtml(bid) +
            '" value="' +
            (meta.totalPages ? String(meta.totalPages) : "") +
            '" aria-label="Toplam sayfa" title="Toplam sayfa" />' +
            "</label>" +
            '<button type="button" class="btn-icon btn-icon--save book-meta-save" data-book-id="' +
            escapeHtml(bid) +
            '" aria-label="Bilgileri kaydet" title="Kaydet">' +
            BOOK_ICON_SAVE_SVG +
            "</button>" +
            "</div>"
          : "";
        var datesEdit =
          meta ?
            '<div class="book-dates-edit book-dates-edit--inline">' +
            '<label class="book-dates-edit__field">' +
            '<span class="book-dates-edit__ic">' +
            BOOK_ICON_INLINE_DATE_FROM_SVG +
            '</span><input type="date" class="book-date-start" data-book-id="' +
            escapeHtml(bid) +
            '" value="' +
            isoToDateInputValue(meta.startedAt || (subs[0] ? subs[0].createdAt : "")) +
            '" aria-label="Başlangıç tarihi" title="Başlangıç" />' +
            "</label>" +
            '<label class="book-dates-edit__field">' +
            '<span class="book-dates-edit__ic">' +
            BOOK_ICON_INLINE_DATE_TO_SVG +
            '</span><input type="date" class="book-date-end" data-book-id="' +
            escapeHtml(bid) +
            '" value="' +
            isoToDateInputValue(meta.finishedAt || "") +
            '" aria-label="Bitiş tarihi" title="Bitiş" />' +
            "</label>" +
            '<button type="button" class="btn-icon btn-icon--dates book-date-save" data-book-id="' +
            escapeHtml(bid) +
            '" aria-label="Tarihleri uygula" title="Tarihleri uygula">' +
            BOOK_ICON_CALENDAR_SVG +
            "</button>" +
            "</div>"
          : '<p class="book-block__dates">Başlangıç: ' +
            formatDateOnly(startShow) +
            " · Bitiş: " +
            formatDateOnly(endShow) +
            "</p>";
        var dateRangeLine =
          (startShow ? formatDateOnly(startShow) : "—") +
          " → " +
          (endShow ? formatDateOnly(endShow) : "—");
        var head;
        if (meta) {
          head =
            '<div class="book-block book-block--card" data-book-id="' +
            escapeHtml(bid) +
            '">' +
            '<div class="book-block__record">' +
            '<div class="book-block__record-main">' +
            '<div class="book-block__record-title">' +
            escapeHtml(meta.title) +
            "</div>" +
            (meta.author
              ? '<div class="book-block__record-meta">' + escapeHtml(meta.author) + "</div>"
              : "") +
            '<div class="book-block__record-meta">' +
            "<strong>" +
            totalP +
            "</strong> syf · <strong>" +
            totalM +
            "</strong> dk · " +
            dateRangeLine +
            "</div>" +
            "</div>" +
            '<button type="button" class="book-block__edit-toggle" data-book-toggle-edit="' +
            escapeHtml(bid) +
            '" aria-label="Kitabı düzenle" title="Düzenle" aria-expanded="false">' +
            BOOK_ICON_PENCIL_SVG +
            "</button>" +
            "</div>" +
            '<div class="book-block__editor" hidden>' +
            metaEdit +
            datesEdit +
            "</div>" +
            '<ul class="book-timeline">';
        } else {
          head =
            '<div class="book-block book-block--card"><h3 class="book-block__title">' +
            escapeHtml(title) +
            "</h3>" +
            '<p class="book-block__sum">Toplam: <strong>' +
            totalP +
            "</strong> sayfa · <strong>" +
            totalM +
            "</strong> dk</p>" +
            datesEdit +
            '<ul class="book-timeline">';
        }
        var rows = subs
          .map(function (s) {
            return (
              '<li class="book-timeline__item"><span class="book-timeline__date">' +
              escapeHtml(formatSessionDate(s.createdAt)) +
              "</span><span class=\"book-timeline__meta\">" +
              (s.pagesRead || 0) +
              " syf · " +
              (s.durationMinutes || 0) +
              " dk" +
              (s.finishedBook ? " · <em>bitirdi</em>" : "") +
              "</span>" +
              (s.note ? '<span class="book-timeline__note">' + escapeHtml(String(s.note)) + "</span>" : "") +
              "</li>"
            );
          })
          .join("");
        return head + rows + "</ul></div>";
      })
      .join("");
  }

  function renderYatirimDashboard() {
    var netEl = document.getElementById("yatirim-net");
    var volEl = document.getElementById("yatirim-volume");
    var donutBg = document.getElementById("yatirim-donut-bg");
    var donutSvg = document.getElementById("yatirim-donut-labels");
    var legendEl = document.getElementById("yatirim-legend");
    var barsEl = document.getElementById("yatirim-daily-bars");
    var dash = document.getElementById("yatirim-dashboard");
    if (!netEl || !volEl || !legendEl || !barsEl) return;

    var pr = getYatirimPeriodRange();
    if (dash) {
      var pm = pr.mode;
      dash.querySelectorAll("[data-yatirim-mode]").forEach(function (b) {
        b.classList.toggle("yatirim-period-btn--active", b.getAttribute("data-yatirim-mode") === pm);
      });
    }

    var barsTitle = document.getElementById("yatirim-bars-title");
    var sumEl = document.getElementById("yatirim-period-summary");
    if (sumEl) sumEl.textContent = pr.label || "";

    fillYatirimYearSelect(document.getElementById("yatirim-select-year"));
    fillYatirimMonthSelect(document.getElementById("yatirim-select-month"));
    var sy = document.getElementById("yatirim-select-year");
    var sm = document.getElementById("yatirim-select-month");
    var wr = document.getElementById("yatirim-week-ref");
    var mw = document.getElementById("yatirim-month-wrap");
    var pickWeek = document.getElementById("yatirim-pick-week");
    var pickMy = document.getElementById("yatirim-pick-my");
    if (sy) sy.value = sessionStorage.getItem("yatirimYear") || String(new Date().getFullYear());
    if (sm) sm.value = sessionStorage.getItem("yatirimMonth") || "1";
    if (wr) wr.value = sessionStorage.getItem("yatirimWeekRef") || "";
    if (pickWeek) {
      if (pr.mode === "week") pickWeek.removeAttribute("hidden");
      else pickWeek.setAttribute("hidden", "");
    }
    if (pickMy) {
      if (pr.mode === "week") pickMy.setAttribute("hidden", "");
      else pickMy.removeAttribute("hidden");
    }
    if (mw) mw.style.display = pr.mode === "month" ? "" : "none";

    var inv = state.sessions.filter(function (s) {
      return s.category === "investment";
    });
    var periodSessions = inv.filter(function (s) {
      return sessionInRange(sessionEffectiveTime(s), pr.start, pr.end);
    });

    var net = 0;
    var volume = 0;
    var byAsset = {};
    periodSessions.forEach(function (s) {
      net += investmentSignedAmount(s);
      var vol = investmentVolumeAmount(s);
      volume += vol;
      var ak = investmentAssetLabel(s);
      byAsset[ak] = (byAsset[ak] || 0) + vol;
    });

    netEl.textContent = formatMoneyTR(net);
    volEl.textContent = formatMoneyTR(volume);

    var entries = Object.keys(byAsset)
      .map(function (k) {
        return { label: k, value: byAsset[k] };
      })
      .filter(function (e) {
        return e.value > 0;
      })
      .sort(function (a, b) {
        return b.value - a.value;
      });

    legendEl.innerHTML = "";
    var gradParts = entries.map(function (e, i) {
      return { value: e.value, color: INV_CHART_COLORS[i % INV_CHART_COLORS.length] };
    });
    var grad = buildConicGradient(gradParts);

    entries.forEach(function (e, i) {
      var pct = volume > 0 ? Math.round((e.value / volume) * 100) : 0;
      var li = document.createElement("li");
      li.className = "yatirim-legend__item";
      li.innerHTML =
        '<span class="yatirim-legend__pct">' +
        pct +
        '%</span>' +
        '<span class="yatirim-legend__sw" style="background:' +
        INV_CHART_COLORS[i % INV_CHART_COLORS.length] +
        '"></span>' +
        '<span class="yatirim-legend__name">' +
        escapeHtml(e.label) +
        "</span>" +
        '<span class="yatirim-legend__amt">' +
        escapeHtml(formatMoneyTR(e.value)) +
        "</span>";
      legendEl.appendChild(li);
    });

    if (donutBg) {
      donutBg.style.background = grad ? grad : "var(--surface2)";
    }
    drawDonutPercentLabels(donutSvg, entries, volume);
    var donutStack = document.querySelector(".yatirim-donut-stack");
    if (donutStack) {
      donutStack.setAttribute(
        "aria-label",
        volume > 0 ? "Kalem dağılımı, toplam " + formatMoneyTR(volume) : "Veri yok"
      );
    }

    var barsBlock = barsEl.closest(".yatirim-chart-block");
    if (pr.mode !== "year") {
      if (barsBlock) barsBlock.setAttribute("hidden", "");
      barsEl.innerHTML = "";
      return;
    }
    if (barsBlock) barsBlock.removeAttribute("hidden");
    if (barsTitle) barsTitle.textContent = "Aylık net tutar (₺)";

    var YATIRIM_BAR_TRACK_PX = 88;

    barsEl.innerHTML = "";
    var barsWrap = document.createElement("div");
    barsWrap.className = "yatirim-bars-inner yatirim-bars-inner--year";

    var yNum = pr.start.getFullYear();
    var monthNet = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    periodSessions.forEach(function (s) {
      var d = new Date(sessionEffectiveTime(s));
      if (d.getFullYear() === yNum) monthNet[d.getMonth()] += investmentSignedAmount(s);
    });
    var maxAbsY = 1;
    var mx;
    for (mx = 0; mx < 12; mx++) {
      var av = Math.abs(monthNet[mx]);
      if (av > maxAbsY) maxAbsY = av;
    }
    for (mx = 0; mx < 12; mx++) {
      var vM = monthNet[mx];
      var hMPx =
        maxAbsY > 0 ? Math.round((Math.abs(vM) / maxAbsY) * YATIRIM_BAR_TRACK_PX) : 0;
      if (vM !== 0 && hMPx < 2) hMPx = 2;
      var colM = document.createElement("div");
      colM.className = "yatirim-bar-col";
      var trackM = document.createElement("div");
      trackM.className = "yatirim-bar-col__track";
      var barM = document.createElement("div");
      barM.className =
        "yatirim-bar " + (vM >= 0 ? "yatirim-bar--pos" : "yatirim-bar--neg");
      barM.style.height = hMPx + "px";
      barM.title = MONTH_NAMES_TR[mx] + " " + yNum + ": " + formatMoneyTR(vM);
      var lblM = document.createElement("span");
      lblM.className = "yatirim-bar-col__lbl";
      lblM.textContent = MONTH_SHORT_TR[mx];
      var valM = document.createElement("span");
      valM.className = "yatirim-bar-val";
      valM.textContent = formatYatirimBarAmount(vM);
      colM.appendChild(valM);
      trackM.appendChild(barM);
      colM.appendChild(trackM);
      colM.appendChild(lblM);
      barsWrap.appendChild(colM);
    }
    barsEl.appendChild(barsWrap);
  }

  function yatirimTableRowHtml(s) {
    return (
      "<tr><td>" +
      escapeHtml(formatSessionDate(sessionEffectiveTime(s))) +
      "</td><td>" +
      escapeHtml(s.assetName || "—") +
      "</td><td>" +
      escapeHtml((s.investAction && investActionLabels[s.investAction]) || s.investAction || "—") +
      "</td><td>" +
      (s.sharePrice != null && !isNaN(s.sharePrice)
        ? escapeHtml(String(s.sharePrice)) + " ₺"
        : s.shareQuantity != null && !isNaN(s.shareQuantity)
          ? escapeHtml(String(s.shareQuantity)) + " adet (eski)"
          : "—") +
      "</td><td>" +
      (s.amount != null && !isNaN(s.amount) ? escapeHtml(String(s.amount)) + " " + (s.currency || "TRY") : "—") +
      "</td><td>" +
      escapeHtml(s.note || "") +
      "</td></tr>"
    );
  }

  function renderYatirimTable() {
    state = loadState();
    var tbody = document.getElementById("yatirim-table-body");
    var wrap = document.getElementById("yatirim-records-wrap");
    var emptyAll = document.getElementById("yatirim-empty-all");
    var emptyFilter = document.getElementById("yatirim-empty-filter");
    if (!tbody) return;

    var all = state.sessions.filter(function (s) {
      return s.category === "investment";
    });

    if (all.length === 0) {
      if (emptyAll) emptyAll.hidden = false;
      if (wrap) wrap.hidden = true;
      if (emptyFilter) emptyFilter.hidden = true;
      return;
    }
    if (emptyAll) emptyAll.hidden = true;
    if (wrap) wrap.hidden = false;

    var filtered = applyYatirimFilters(all);
    var sort = getYatirimTableSort();
    var rows = sortYatirimRows(filtered, sort.col, sort.dir);

    if (rows.length === 0) {
      tbody.innerHTML = "";
      if (emptyFilter) emptyFilter.hidden = false;
    } else {
      tbody.innerHTML = rows.map(yatirimTableRowHtml).join("");
      if (emptyFilter) emptyFilter.hidden = true;
    }
    updateYatirimSortHeaders();
  }

  function renderYatirimPage() {
    if (!document.getElementById("yatirim-list")) return;
    state = loadState();
    renderYatirimDashboard();
    renderYatirimTable();
  }

  function refreshBookInvestPages() {
    if (page === "kitaplar") renderKitaplarPage();
    if (page === "yatirim") renderYatirimPage();
    if (page === "yds") renderYdsPage();
  }

  function rollupAddScore(aggRow, s) {
    var sc = s.enScore;
    if (!sc || typeof sc !== "object") return;
    aggRow.dogru += parseNonNegInt(sc.dogru);
    aggRow.yanlis += parseNonNegInt(sc.yanlis);
    aggRow.bos += parseNonNegInt(sc.bos);
  }

  function englishSessionQuestionCount(s) {
    if (!s || s.category !== "english") return 0;
    var c = s.enCounts || {};
    var st = s.enSubtype;
    if (st === "grammar") return parseNonNegInt(c.grammar);
    if (st === "cloze") return parseNonNegInt(c.cloze);
    if (st === "tr_eng") return parseNonNegInt(c.trEng);
    if (st === "eng_tr") return parseNonNegInt(c.engTr);
    if (st === "passage") return parseNonNegInt(c.passage);
    if (st === "paragraf") return parseNonNegInt(c.paragrafAtama);
    if (st === "deneme") return parseNonNegInt(c.deneme);
    if (st === "kelime") return 0;
    return (
      parseNonNegInt(c.grammar) +
      parseNonNegInt(c.cloze) +
      parseNonNegInt(c.trEng) +
      parseNonNegInt(c.engTr) +
      parseNonNegInt(c.passage) +
      parseNonNegInt(c.paragrafAtama) +
      parseNonNegInt(c.deneme)
    );
  }

  function englishDayAggregatesFromState() {
    var min = {};
    var qTot = {};
    var dogru = {};
    var yanlis = {};
    var bos = {};
    state.sessions.forEach(function (s) {
      if (s.category !== "english") return;
      var iso = sessionEffectiveTime(s);
      if (!iso) return;
      var k = dateKeyLocal(new Date(iso));
      var dm = s.durationMinutes || 0;
      min[k] = (min[k] || 0) + dm;
      qTot[k] = (qTot[k] || 0) + englishSessionQuestionCount(s);
      var sc = s.enScore;
      if (sc && typeof sc === "object") {
        dogru[k] = (dogru[k] || 0) + parseNonNegInt(sc.dogru);
        yanlis[k] = (yanlis[k] || 0) + parseNonNegInt(sc.yanlis);
        bos[k] = (bos[k] || 0) + parseNonNegInt(sc.bos);
      }
    });
    return { min: min, q: qTot, dogru: dogru, yanlis: yanlis, bos: bos };
  }

  function ydsChartShouldUseMonthly(chartStartRaw) {
    if (!chartStartRaw || !/^\d{4}-\d{2}-\d{2}$/.test(chartStartRaw)) return false;
    var todayKey = dateKeyLocal(new Date());
    if (chartStartRaw > todayKey) return false;
    var a = parseDateKey(chartStartRaw);
    var b = parseDateKey(todayKey);
    a.setHours(0, 0, 0, 0);
    b.setHours(0, 0, 0, 0);
    var diffDays = Math.round((b - a) / 86400000);
    return diffDays > 30;
  }

  function ydsChartMonthlySeries(agg, startKey, endKey) {
    var labels = [];
    var dataMin = [];
    var dataQ = [];
    var dataD = [];
    var start = parseDateKey(startKey);
    var end = parseDateKey(endKey);
    var cur = new Date(start.getFullYear(), start.getMonth(), 1);
    var endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= endMonth) {
      var y = cur.getFullYear();
      var m = cur.getMonth();
      var lastDay = new Date(y, m + 1, 0).getDate();
      var si = 0;
      var sq = 0;
      var sd = 0;
      var d;
      for (d = 1; d <= lastDay; d++) {
        var dk = dateKeyLocal(new Date(y, m, d));
        if (dk < startKey || dk > endKey) continue;
        si += agg.min[dk] || 0;
        sq += agg.q[dk] || 0;
        sd += agg.dogru[dk] || 0;
      }
      labels.push(MONTH_SHORT_TR[m] + " " + y);
      dataMin.push(si);
      dataQ.push(sq);
      dataD.push(sd);
      cur.setMonth(cur.getMonth() + 1);
    }
    return { labels: labels, dataMin: dataMin, dataQ: dataQ, dataD: dataD };
  }

  function destroyYdsTrendChart() {
    if (typeof Chart === "undefined") return;
    if (ydsTrendChart) {
      ydsTrendChart.destroy();
      ydsTrendChart = null;
    }
  }

  function destroyYdsDenemeChart() {
    if (typeof Chart === "undefined") return;
    if (ydsDenemeChart) {
      ydsDenemeChart.destroy();
      ydsDenemeChart = null;
    }
  }

  function denemeSessionsFromState() {
    var out = [];
    state.sessions.forEach(function (s) {
      if (s.category !== "english" || s.enSubtype !== "deneme") return;
      var iso = sessionEffectiveTime(s);
      if (!iso) return;
      var c = s.enCounts || {};
      var totalQ = parseNonNegInt(c.deneme);
      var sc = s.enScore;
      var d = 0;
      var y = 0;
      var b = 0;
      if (sc && typeof sc === "object") {
        d = parseNonNegInt(sc.dogru);
        y = parseNonNegInt(sc.yanlis);
        b = parseNonNegInt(sc.bos);
      }
      var net = null;
      if (d + y + b > 0) {
        net = d - y / 4;
      }
      out.push({
        t: new Date(iso).getTime(),
        iso: iso,
        totalQ: totalQ,
        dogru: d,
        yanlis: y,
        bos: b,
        net: net,
      });
    });
    out.sort(function (a, b2) {
      return a.t - b2.t;
    });
    return out;
  }

  function renderYdsDenemeChartPanel() {
    var canvas = document.getElementById("yds-chart-deneme");
    var emptyEl = document.getElementById("yds-deneme-empty");
    var wrap = document.getElementById("yds-deneme-canvas-wrap");
    destroyYdsDenemeChart();
    if (!canvas || typeof Chart === "undefined") return;

    state = loadState();
    var list = denemeSessionsFromState();
    var plotable = list.filter(function (row) {
      return row.dogru + row.yanlis + row.bos > 0;
    });

    if (list.length === 0) {
      if (emptyEl) {
        emptyEl.textContent = "Kayıt yok.";
        emptyEl.hidden = false;
      }
      if (wrap) wrap.hidden = true;
      return;
    }
    if (plotable.length === 0) {
      if (emptyEl) {
        emptyEl.textContent = "Net için doğru / yanlış / boş gir.";
        emptyEl.hidden = false;
      }
      if (wrap) wrap.hidden = true;
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (wrap) wrap.hidden = false;

    var labels = [];
    var nets = [];
    var i;
    for (i = 0; i < plotable.length; i++) {
      var row = plotable[i];
      var dt = new Date(row.iso);
      labels.push(dt.getDate() + " " + MONTH_SHORT_TR[dt.getMonth()]);
      nets.push(row.net != null ? row.net : row.dogru - row.yanlis / 4);
    }

    canvas.setAttribute("aria-label", "Deneme netleri (kronolojik)");

    ydsDenemeChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Net (D − Y/4)",
            data: nets,
            borderColor: "#0d9488",
            backgroundColor: "rgba(13, 148, 136, 0.12)",
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: "#0f766e",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 45, minRotation: 0, autoSkip: true },
          },
          y: {
            beginAtZero: false,
            title: { display: true, text: "Net" },
            ticks: {
              callback: function (v) {
                return Number.isInteger(v) ? v : v.toFixed(1);
              },
            },
          },
        },
        plugins: {
          legend: { display: true, position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var idx = ctx.dataIndex;
                var r = plotable[idx];
                if (!r) return "";
                return (
                  "Net: " +
                  (r.net != null ? r.net.toFixed(2) : "—") +
                  " · D:" +
                  r.dogru +
                  " Y:" +
                  r.yanlis +
                  " B:" +
                  r.bos +
                  (r.totalQ ? " · Soru:" + r.totalQ : "")
                );
              },
            },
          },
        },
      },
    });
  }

  function renderYdsCalendarMonthHtml(y, m, enMap) {
    var first = new Date(y, m, 1);
    var startOffset = (first.getDay() + 6) % 7;
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var cells = [];
    var i;
    for (i = 0; i < startOffset; i++) cells.push({ pad: true });
    for (i = 1; i <= daysInMonth; i++) cells.push({ pad: false, d: i });
    var raw = startOffset + daysInMonth;
    var rows = Math.ceil(raw / 7);
    var totalCells = rows * 7;
    while (cells.length < totalCells) cells.push({ pad: true });

    var weekdays = ["Pz", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"];
    var todayKey = dateKeyLocal(new Date());
    var html = [];
    html.push('<div class="calendar-grid">');
    html.push('<div class="calendar-grid__weekdays" aria-hidden="true">');
    weekdays.forEach(function (w) {
      html.push('<div class="calendar-grid__wd">' + w + "</div>");
    });
    html.push("</div>");
    html.push('<div class="calendar-grid__cells">');

    cells.forEach(function (cell) {
      if (cell.pad) {
        html.push('<div class="calendar-cell calendar-cell--pad"></div>');
        return;
      }
      var d = cell.d;
      var key = dateKeyLocal(new Date(y, m, d));
      var enM = enMap[key] || 0;
      var isToday = key === todayKey;
      var cls = "calendar-cell";
      if (isToday) cls += " calendar-cell--today";
      if (enM > 0) cls += " calendar-cell--streak";
      if (enM === 0) cls += " calendar-cell--zero";

      html.push(
        '<div class="' +
          cls +
          '" title="' +
          key +
          ": " +
          enM +
          ' dk YDS"><span class="calendar-cell__num">' +
          d +
          "</span>"
      );

      if (enM > 0) {
        html.push('<div class="calendar-cell__bar">');
        html.push(
          '<span class="calendar-cell__seg calendar-cell__seg--en" style="width:100%"></span>'
        );
        html.push("</div>");
        html.push('<span class="calendar-cell__total">' + enM + " dk</span>");
      } else {
        html.push('<span class="calendar-cell__dash">—</span>');
      }

      html.push("</div>");
    });

    html.push("</div></div>");
    return html.join("");
  }

  function renderYdsStreakCalendarCharts() {
    if (!document.getElementById("yds-dashboard")) return;

    state = loadState();
    state.yds = mergeYds(state.yds);
    var ps = programStartDateKey(state.yds);
    var maps = dayCategoryMapsByEffectiveDate();
    var enMap = ps ? filterDateKeysFrom(maps.en || {}, ps) : maps.en || {};

    var cur = computeCurrentStreakYds(enMap);
    var best = computeLongestStreakYds(enMap);
    var elCur = document.getElementById("yds-streak-current");
    var elBest = document.getElementById("yds-streak-best");
    var elMsg = document.getElementById("yds-streak-today-msg");
    if (elCur) elCur.textContent = String(cur);
    if (elBest) elBest.textContent = best + " gün";

    var todayKey = dateKeyLocal(new Date());
    var todayM = enMap[todayKey] || 0;
    var yDay = new Date();
    yDay.setHours(0, 0, 0, 0);
    yDay.setDate(yDay.getDate() - 1);
    var yesterdayKey = dateKeyLocal(yDay);
    var yesterdayM = enMap[yesterdayKey] || 0;
    if (elMsg) {
      if (ps && todayKey < ps) {
        elMsg.textContent = "";
        elMsg.className = "yds-streak-today";
      } else if (todayM > 0) {
        elMsg.textContent = "Bugün: " + todayM + " dk";
        elMsg.className = "yds-streak-today yds-streak-today--ok";
      } else if (yesterdayM > 0) {
        elMsg.textContent = "Bugün kayıt yok.";
        elMsg.className = "yds-streak-today yds-streak-today--warn";
      } else {
        elMsg.textContent = "";
        elMsg.className = "yds-streak-today";
      }
    }

    var chainEl = document.getElementById("yds-chain-row");
    if (chainEl) {
      var parts = [];
      var j;
      for (j = 6; j >= 0; j--) {
        var day = new Date();
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - j);
        var k = dateKeyLocal(day);
        var em = enMap[k] || 0;
        var ok = em > 0;
        var isToday = k === todayKey;
        var c = "yds-chain-dot";
        if (ok) c += " yds-chain-dot--ok";
        else c += " yds-chain-dot--empty";
        if (isToday) c += " yds-chain-dot--today";
        var wd = ["Pz", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"][(day.getDay() + 6) % 7];
        parts.push(
          '<div class="' +
            c +
            '" title="' +
            k +
            ": " +
            em +
            ' dk"><span class="yds-chain-dot__wd">' +
            wd +
            "</span></div>"
        );
      }
      chainEl.innerHTML = parts.join("");
    }

    var calRoot = document.getElementById("yds-cal-root");
    var calLabel = document.getElementById("yds-cal-label");
    if (calLabel) {
      calLabel.textContent = new Date(ydsCalView.y, ydsCalView.m, 1).toLocaleDateString("tr-TR", {
        month: "long",
        year: "numeric",
      });
    }
    if (calRoot) {
      calRoot.innerHTML = renderYdsCalendarMonthHtml(ydsCalView.y, ydsCalView.m, enMap);
    }

    var canvas = document.getElementById("yds-chart-trend");
    var emptyEl = document.getElementById("yds-chart-empty");
    var wrap = document.getElementById("yds-chart-canvas-wrap");
    destroyYdsTrendChart();
    if (!canvas || typeof Chart === "undefined") return;

    state = loadState();
    state.yds = mergeYds(state.yds);
    var chartStartRaw = (state.yds.chartStartDate && String(state.yds.chartStartDate).trim()) || "";
    var chartStartOk = /^\d{4}-\d{2}-\d{2}$/.test(chartStartRaw);

    var agg = englishDayAggregatesFromState();
    var useMonthly = chartStartOk && ydsChartShouldUseMonthly(chartStartRaw);
    var labels = [];
    var dataMin = [];
    var dataQ = [];
    var dataD = [];
    var sumTotal = 0;
    var t;
    var ii;

    if (useMonthly) {
      var todayKey = dateKeyLocal(new Date());
      var ms = ydsChartMonthlySeries(agg, chartStartRaw, todayKey);
      labels = ms.labels;
      dataMin = ms.dataMin;
      dataQ = ms.dataQ;
      dataD = ms.dataD;
      for (ii = 0; ii < labels.length; ii++) {
        sumTotal += dataMin[ii] + dataQ[ii] + dataD[ii];
      }
    } else {
      for (t = 13; t >= 0; t--) {
        var dt = new Date();
        dt.setHours(0, 0, 0, 0);
        dt.setDate(dt.getDate() - t);
        var dk = dateKeyLocal(dt);
        if (chartStartOk && dk < chartStartRaw) continue;
        labels.push(dt.getDate() + " " + MONTH_SHORT_TR[dt.getMonth()]);
        var m0 = agg.min[dk] || 0;
        var q0 = agg.q[dk] || 0;
        var d0 = agg.dogru[dk] || 0;
        dataMin.push(m0);
        dataQ.push(q0);
        dataD.push(d0);
        sumTotal += m0 + q0 + d0;
      }
    }

    if (sumTotal <= 0) {
      if (emptyEl) emptyEl.hidden = false;
      if (wrap) wrap.hidden = true;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    if (wrap) wrap.hidden = false;

    if (canvas) {
      canvas.setAttribute(
        "aria-label",
        useMonthly ? "Aylık YDS özeti (dakika, soru, doğru)" : "Son on dört gün YDS özeti"
      );
    }

    var xScaleOpts = { grid: { display: false } };
    if (useMonthly) {
      xScaleOpts.ticks = { maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 36 };
    }

    ydsTrendChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Dakika",
            data: dataMin,
            backgroundColor: "rgba(13, 148, 136, 0.55)",
            borderColor: "#0d9488",
            borderWidth: 1,
            yAxisID: "y",
          },
          {
            label: "Soru",
            data: dataQ,
            backgroundColor: "rgba(30, 58, 95, 0.45)",
            borderColor: "#1e3a5f",
            borderWidth: 1,
            yAxisID: "y1",
          },
          {
            label: "Doğru",
            data: dataD,
            backgroundColor: "rgba(34, 197, 94, 0.5)",
            borderColor: "#16a34a",
            borderWidth: 1,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: xScaleOpts,
          y: {
            position: "left",
            beginAtZero: true,
            title: { display: true, text: "Dakika" },
            ticks: { callback: function (v) { return v + " dk"; } },
          },
          y1: {
            position: "right",
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            title: { display: true, text: "Soru / doğru" },
          },
        },
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
        },
      },
    });
  }

  function rollupEnglishSessionsWeek(state) {
    function emptyRow() {
      return { q: 0, min: 0, dogru: 0, yanlis: 0, bos: 0 };
    }
    var agg = {
      grammar: emptyRow(),
      cloze: emptyRow(),
      tr_eng: emptyRow(),
      eng_tr: emptyRow(),
      passage: emptyRow(),
      paragraf: emptyRow(),
      deneme: emptyRow(),
      kelime: { min: 0, kelimeSay: 0 },
    };
    state.sessions.forEach(function (s) {
      if (s.category !== "english") return;
      if (!isInCurrentWeek(sessionEffectiveTime(s))) return;
      var dm = s.durationMinutes || 0;
      var c = s.enCounts || {};
      var st = s.enSubtype;
      if (st === "grammar") {
        agg.grammar.q += parseNonNegInt(c.grammar);
        agg.grammar.min += s.enGrammarMinutes || 0;
        rollupAddScore(agg.grammar, s);
      } else if (st === "cloze") {
        agg.cloze.q += parseNonNegInt(c.cloze);
        agg.cloze.min += dm;
        rollupAddScore(agg.cloze, s);
      } else if (st === "tr_eng") {
        agg.tr_eng.q += parseNonNegInt(c.trEng);
        agg.tr_eng.min += dm;
        rollupAddScore(agg.tr_eng, s);
      } else if (st === "eng_tr") {
        agg.eng_tr.q += parseNonNegInt(c.engTr);
        agg.eng_tr.min += dm;
        rollupAddScore(agg.eng_tr, s);
      } else if (st === "passage") {
        agg.passage.q += parseNonNegInt(c.passage);
        agg.passage.min += dm;
        rollupAddScore(agg.passage, s);
      } else if (st === "paragraf") {
        agg.paragraf.q += parseNonNegInt(c.paragrafAtama);
        agg.paragraf.min += dm;
        rollupAddScore(agg.paragraf, s);
      } else if (st === "deneme") {
        agg.deneme.q += parseNonNegInt(c.deneme);
        agg.deneme.min += dm;
        rollupAddScore(agg.deneme, s);
      } else if (st === "kelime") {
        agg.kelime.min += s.enKelimeEzberMinutes || 0;
        agg.kelime.kelimeSay += parseNonNegInt(s.enKelimeSayisi);
      } else {
        agg.grammar.q += parseNonNegInt(c.grammar);
        agg.cloze.q += parseNonNegInt(c.cloze);
        agg.tr_eng.q += parseNonNegInt(c.trEng);
        agg.eng_tr.q += parseNonNegInt(c.engTr);
        agg.passage.q += parseNonNegInt(c.passage);
        agg.paragraf.q += parseNonNegInt(c.paragrafAtama);
        agg.deneme.q += parseNonNegInt(c.deneme);
        agg.grammar.min += s.enGrammarMinutes || 0;
        agg.kelime.min += s.enKelimeEzberMinutes || 0;
        agg.kelime.kelimeSay += parseNonNegInt(s.enKelimeSayisi);
        rollupAddScore(agg.grammar, s);
      }
    });
    return agg;
  }

  function renderYdsRollupHtml(agg) {
    var parts = [];
    function row(label, rowAgg, kelimeExtra) {
      var q = rowAgg.q;
      var min = rowAgg.min;
      var d = rowAgg.dogru;
      var y = rowAgg.yanlis;
      var b = rowAgg.bos;
      if (q > 0 || min > 0 || d > 0 || y > 0 || b > 0 || (kelimeExtra != null && kelimeExtra > 0)) {
        var bits = [];
        if (q > 0) bits.push(escapeHtml(String(q)) + " soru");
        if (min > 0) bits.push(escapeHtml(String(min)) + " dk");
        if (d > 0 || y > 0 || b > 0) {
          bits.push("D:" + escapeHtml(String(d)) + " Y:" + escapeHtml(String(y)) + (b > 0 ? " B:" + escapeHtml(String(b)) : ""));
        }
        if (kelimeExtra != null && kelimeExtra > 0) bits.push(escapeHtml(String(kelimeExtra)) + " kelime");
        parts.push(
          "<li class=\"yds-rollup-list__item\"><span class=\"yds-rollup-list__label\">" +
            escapeHtml(label) +
            "</span> " +
            bits.join(" · ") +
            "</li>"
        );
      }
    }
    row("Grammar", agg.grammar, null);
    row("Cloze", agg.cloze, null);
    row("TR → ENG", agg.tr_eng, null);
    row("ENG → TR", agg.eng_tr, null);
    row("Passage", agg.passage, null);
    row("Paragraf atama", agg.paragraf, null);
    row("Deneme", agg.deneme, null);
    if (agg.kelime.min > 0 || agg.kelime.kelimeSay > 0) {
      var krow = { q: 0, min: agg.kelime.min, dogru: 0, yanlis: 0, bos: 0 };
      row("Kelime ezber", krow, agg.kelime.kelimeSay);
    }
    if (parts.length === 0) {
      return '<p class="yds-rollup-empty">Bu hafta kayıt yok. <a href="yeni-kayit.html">Ekle</a></p>';
    }
    return '<ul class="yds-rollup-list">' + parts.join("") + "</ul>";
  }

  function renderYdsBasvuruAlert(banner, iso) {
    if (!banner) return;
    banner.textContent = "";
    banner.className = "yds-basvuru-alert";
    banner.hidden = true;
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso).trim())) return;
    var app = parseDateKey(String(iso).trim());
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    app.setHours(0, 0, 0, 0);
    var diff = Math.round((app - today) / (24 * 60 * 60 * 1000));
    banner.hidden = false;
    if (diff < 0) {
      banner.classList.add("yds-basvuru-alert--past");
      banner.textContent = "Başvuru tarihi geçmiş.";
    } else if (diff === 0) {
      banner.classList.add("yds-basvuru-alert--critical");
      banner.textContent = "Bugün son gün olabilir.";
    } else if (diff <= 3) {
      banner.classList.add("yds-basvuru-alert--critical");
      banner.textContent = diff + " gün kaldı.";
    } else if (diff <= 7) {
      banner.classList.add("yds-basvuru-alert--soon");
      banner.textContent = diff + " gün kaldı.";
    } else if (diff <= 14) {
      banner.classList.add("yds-basvuru-alert--warn");
      banner.textContent = diff + " gün kaldı.";
    } else {
      banner.classList.add("yds-basvuru-alert--info");
      banner.textContent = diff + " gün var.";
    }
  }

  function renderYdsPage() {
    if (!document.getElementById("yds-dashboard")) return;
    state = loadState();
    state.yds = mergeYds(state.yds);
    var yds = state.yds;

    var examIn = document.getElementById("yds-exam-date");
    var examEditBlock = document.getElementById("yds-exam-date-edit-block");
    var scoreEditBlock = document.getElementById("yds-score-edit-block");
    var appEditBlock = document.getElementById("yds-application-date-edit-block");
    var summaryRow = document.getElementById("yds-hero-summary-row");
    var examSummary = document.getElementById("yds-exam-date-summary");
    var scoreSummary = document.getElementById("yds-target-score-summary");
    var applicationSummary = document.getElementById("yds-application-summary");
    var edRaw = (yds.examDate && String(yds.examDate).trim()) || "";
    var hasExamDate = /^\d{4}-\d{2}-\d{2}$/.test(edRaw);
    var scoreRaw = (yds.targetScore && String(yds.targetScore).trim()) || "";
    var hasScore = scoreRaw.length > 0;
    var appRaw = (yds.applicationDate && String(yds.applicationDate).trim()) || "";
    var hasApplicationDate = /^\d{4}-\d{2}-\d{2}$/.test(appRaw);
    var showExamEdit = !hasExamDate || ydsExamDateEditing;
    var showScoreInput = !hasExamDate || ydsExamDateEditing || ydsScoreEditing;
    var showApplicationEdit = !hasApplicationDate || ydsApplicationEditing;
    var showSummaryRow =
      (hasExamDate && !ydsExamDateEditing) ||
      (hasApplicationDate && !ydsApplicationEditing && !ydsExamDateEditing);
    if (examIn) examIn.value = edRaw;
    if (examEditBlock) examEditBlock.hidden = !showExamEdit;
    if (scoreEditBlock) scoreEditBlock.hidden = !showScoreInput;
    if (appEditBlock) appEditBlock.hidden = !showApplicationEdit;
    if (summaryRow) summaryRow.hidden = !showSummaryRow;
    if (examSummary) {
      if (hasExamDate) {
        var examD = parseDateKey(edRaw);
        examSummary.textContent = "Hedef sınav: " + examD.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
      } else if (showSummaryRow) examSummary.textContent = "Hedef sınav: —";
      else examSummary.textContent = "";
    }

    if (scoreSummary) {
      if (ydsScoreEditing) scoreSummary.textContent = "";
      else if (hasScore) scoreSummary.textContent = "Hedef puan: " + scoreRaw;
      else scoreSummary.textContent = "Hedef puan: —";
    }

    if (applicationSummary) {
      if (ydsApplicationEditing) applicationSummary.textContent = "";
      else if (hasApplicationDate) {
        var appD = parseDateKey(appRaw);
        applicationSummary.textContent =
          "Başvuru son: " + appD.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
      } else if (showSummaryRow) applicationSummary.textContent = "Başvuru son: —";
      else applicationSummary.textContent = "";
    }

    var summaryCard = document.getElementById("yds-hero-summary-line");
    if (summaryCard) {
      summaryCard.classList.toggle("yds-hero-summary-card--editing-score", !!ydsScoreEditing);
      summaryCard.classList.toggle("yds-hero-summary-card--editing-application", !!ydsApplicationEditing);
    }

    var scoreIn = document.getElementById("yds-target-score");
    if (scoreIn) scoreIn.value = yds.targetScore || "";

    var appIn = document.getElementById("yds-application-date");
    if (appIn) appIn.value = yds.applicationDate || "";

    var chartStartIn = document.getElementById("yds-chart-start-date");
    if (chartStartIn) chartStartIn.value = yds.chartStartDate || "";

    var programStartIn = document.getElementById("yds-program-start-date");
    if (programStartIn) programStartIn.value = yds.programStartDate || "";

    var csRawChart = (yds.chartStartDate && String(yds.chartStartDate).trim()) || "";
    var chartMonthly = ydsChartShouldUseMonthly(csRawChart);

    var chartTitleEl = document.getElementById("yds-chart-title");
    if (chartTitleEl) {
      chartTitleEl.textContent = chartMonthly ? "Aylık özet" : "Son 14 gün";
    }

    var basvuruBanner = document.getElementById("yds-basvuru-alert");
    renderYdsBasvuruAlert(basvuruBanner, yds.applicationDate);

    var daysEl = document.getElementById("yds-days-left");
    if (daysEl) {
      var ed = yds.examDate;
      if (ed && /^\d{4}-\d{2}-\d{2}$/.test(ed)) {
        var exam = parseDateKey(ed);
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        exam.setHours(0, 0, 0, 0);
        var diff = Math.round((exam - today) / (24 * 60 * 60 * 1000));
        if (diff > 0) daysEl.textContent = "Sınava " + diff + " gün.";
        else if (diff === 0) daysEl.textContent = "Sınav günü.";
        else daysEl.textContent = "Tarih geçmiş.";
      } else {
        daysEl.textContent = "Sınav tarihi yok.";
      }
    }

    var rollupEl = document.getElementById("yds-rollup");
    if (rollupEl) rollupEl.innerHTML = renderYdsRollupHtml(rollupEnglishSessionsWeek(state));

    renderYdsStreakCalendarCharts();
    renderYdsDenemeChartPanel();
  }

  function initYdsPage() {
    var root = document.getElementById("yds-dashboard");
    if (!root || root.dataset.ydsBound) return;
    root.dataset.ydsBound = "1";

    function persistField() {
      state = loadState();
      state.yds = mergeYds(state.yds);
      var y = state.yds;
      var examIn = document.getElementById("yds-exam-date");
      if (examIn) y.examDate = examIn.value.trim();
      var scoreIn = document.getElementById("yds-target-score");
      if (scoreIn) y.targetScore = scoreIn.value.trim();
      var appIn = document.getElementById("yds-application-date");
      if (appIn) y.applicationDate = appIn.value.trim();
      var chartStartIn = document.getElementById("yds-chart-start-date");
      if (chartStartIn) y.chartStartDate = chartStartIn.value.trim();
      var programStartIn = document.getElementById("yds-program-start-date");
      if (programStartIn) y.programStartDate = programStartIn.value.trim();
      state.yds = y;
      saveState(state);
      ydsExamDateEditing = false;
      ydsScoreEditing = false;
      ydsApplicationEditing = false;
      renderYdsPage();
    }

    ["yds-exam-date", "yds-target-score", "yds-application-date", "yds-chart-start-date", "yds-program-start-date"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", persistField);
        el.addEventListener("blur", persistField);
      }
    });

    var btnExamEdit = document.getElementById("btn-yds-exam-edit");
    if (btnExamEdit) {
      btnExamEdit.addEventListener("click", function () {
        ydsExamDateEditing = true;
        ydsScoreEditing = false;
        ydsApplicationEditing = false;
        renderYdsPage();
        var inp = document.getElementById("yds-exam-date");
        if (inp) {
          setTimeout(function () {
            inp.focus();
            if (inp.showPicker) try { inp.showPicker(); } catch (e) {}
          }, 0);
        }
      });
    }

    var btnScoreEdit = document.getElementById("btn-yds-score-edit");
    if (btnScoreEdit) {
      btnScoreEdit.addEventListener("click", function () {
        ydsScoreEditing = true;
        ydsExamDateEditing = false;
        ydsApplicationEditing = false;
        renderYdsPage();
        var inp = document.getElementById("yds-target-score");
        if (inp) {
          setTimeout(function () {
            inp.focus();
            inp.select();
          }, 0);
        }
      });
    }

    var btnApplicationEdit = document.getElementById("btn-yds-application-edit");
    if (btnApplicationEdit) {
      btnApplicationEdit.addEventListener("click", function () {
        ydsApplicationEditing = true;
        ydsExamDateEditing = false;
        ydsScoreEditing = false;
        renderYdsPage();
        var inp = document.getElementById("yds-application-date");
        if (inp) {
          setTimeout(function () {
            inp.focus();
            if (inp.showPicker) try { inp.showPicker(); } catch (e) {}
          }, 0);
        }
      });
    }

    if (!root.dataset.ydsCalNavBound) {
      root.dataset.ydsCalNavBound = "1";
      root.addEventListener("click", function (e) {
        var tdy = e.target.closest("#yds-cal-today,[data-yds-cal-today]");
        if (tdy) {
          var n = new Date();
          ydsCalView.y = n.getFullYear();
          ydsCalView.m = n.getMonth();
          renderYdsPage();
          return;
        }
        var pr = e.target.closest("[data-yds-cal-prev]");
        var nx = e.target.closest("[data-yds-cal-next]");
        if (!pr && !nx) return;
        if (pr) {
          ydsCalView.m -= 1;
          if (ydsCalView.m < 0) {
            ydsCalView.m = 11;
            ydsCalView.y -= 1;
          }
        } else {
          ydsCalView.m += 1;
          if (ydsCalView.m > 11) {
            ydsCalView.m = 0;
            ydsCalView.y += 1;
          }
        }
        renderYdsPage();
      });
    }

    renderYdsPage();
  }

  function escapeHtml(text) {
    if (text == null || text === "") return "";
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function deleteSession(id) {
    state.sessions = state.sessions.filter(function (s) {
      return s.id !== id;
    });
    saveState(state);
    renderStats();
    renderList();
    refreshBookInvestPages();
  }

  function addSession(payload) {
    state.sessions.push(payload);
    if (payload.category === "book" && payload.bookId) {
      state.books.forEach(function (b) {
        if (b.id === payload.bookId && !b.startedAt) {
          b.startedAt = payload.createdAt;
        }
      });
    }
    saveState(state);
    renderStats();
    renderList();
    refreshBookInvestPages();
    if (page === "yeni" && el.bookSelect) populateBookSelect();
  }

  function bindExportClick() {
    if (!el.btnExport) return;
    el.btnExport.addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "calisma-takip-yedek.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  function attachStandardImport() {
    if (!el.importFile) return;
    el.importFile.addEventListener("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var reader = new FileReader();
      var input = this;
      reader.onload = function () {
        try {
          onImportFileLoaded(reader.result);
        } catch (err) {
          alert("Dosya okunamadı veya format uyumsuz.");
        }
        input.value = "";
      };
      reader.readAsText(file);
    });
  }

  function onImportFileLoaded(readerResult) {
    var data = JSON.parse(readerResult);
    if (!data.sessions || !Array.isArray(data.sessions)) throw new Error("Geçersiz dosya");
    if (!data.goals) data.goals = { weeklyMinutesEnglish: 0, weeklyMinutesTechnical: 0 };
    if (data.goals.streakMinMinutesPerDay == null) data.goals.streakMinMinutesPerDay = 15;
    if (!data.books || !Array.isArray(data.books)) data.books = [];
    state = data;
    state.yds = mergeYds(state.yds);
    saveState(state);
    renderStats();
    renderList();
    refreshBookInvestPages();
    if (page === "yeni" && el.bookSelect) populateBookSelect();
  }

  function initCalendarPage() {
    var calView = {
      y: new Date().getFullYear(),
      m: new Date().getMonth(),
    };
    var root = document.getElementById("calendar-root");
    var label = document.getElementById("cal-month-label");

    function renderMonth() {
      state = loadState();
      var y = calView.y;
      var m = calView.m;
      label.textContent = new Date(y, m, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
      var min = getStreakMin();

      var agg = dayAggregates();
      var tot = agg.tot;

      var first = new Date(y, m, 1);
      var startOffset = (first.getDay() + 6) % 7;
      var daysInMonth = new Date(y, m + 1, 0).getDate();
      var cells = [];
      var i;
      for (i = 0; i < startOffset; i++) cells.push({ pad: true });
      for (i = 1; i <= daysInMonth; i++) cells.push({ pad: false, d: i });
      var raw = startOffset + daysInMonth;
      var rows = Math.ceil(raw / 7);
      var totalCells = rows * 7;
      while (cells.length < totalCells) cells.push({ pad: true });

      var weekdays = ["Pz", "Sa", "Ça", "Pe", "Cu", "Ct", "Pa"];
      var html = [];
      html.push('<div class="calendar-grid">');
      html.push('<div class="calendar-grid__weekdays" aria-hidden="true">');
      weekdays.forEach(function (w) {
        html.push('<div class="calendar-grid__wd">' + w + "</div>");
      });
      html.push("</div>");
      html.push('<div class="calendar-grid__cells">');

      var todayKey = dateKeyLocal(new Date());

      cells.forEach(function (cell) {
        if (cell.pad) {
          html.push('<div class="calendar-cell calendar-cell--pad"></div>');
          return;
        }
        var d = cell.d;
        var key = dateKeyLocal(new Date(y, m, d));
        var total = tot[key] || 0;
        var enM = agg.en[key] || 0;
        var techM = agg.tech[key] || 0;
        var streak = isDayActive(tot, key, min);
        var isToday = key === todayKey;

        var cls = "calendar-cell";
        if (isToday) cls += " calendar-cell--today";
        if (streak) cls += " calendar-cell--streak";
        if (total === 0) cls += " calendar-cell--zero";

        html.push(
          '<div class="' +
            cls +
            '" title="' +
            key +
            ": " +
            total +
            ' dk"><span class="calendar-cell__num">' +
            d +
            "</span>"
        );

        var bookM = agg.book[key] || 0;
        var invM = agg.inv[key] || 0;
        if (total > 0) {
          html.push('<div class="calendar-cell__bar">');
          if (enM > 0) {
            html.push(
              '<span class="calendar-cell__seg calendar-cell__seg--en" style="width:' +
                (total > 0 ? (enM / total) * 100 : 0) +
                '%"></span>'
            );
          }
          if (techM > 0) {
            html.push(
              '<span class="calendar-cell__seg calendar-cell__seg--tech" style="width:' +
                (total > 0 ? (techM / total) * 100 : 0) +
                '%"></span>'
            );
          }
          if (bookM > 0) {
            html.push(
              '<span class="calendar-cell__seg calendar-cell__seg--book" style="width:' +
                (total > 0 ? (bookM / total) * 100 : 0) +
                '%"></span>'
            );
          }
          if (invM > 0) {
            html.push(
              '<span class="calendar-cell__seg calendar-cell__seg--inv" style="width:' +
                (total > 0 ? (invM / total) * 100 : 0) +
                '%"></span>'
            );
          }
          html.push("</div>");
          html.push('<span class="calendar-cell__total">' + total + " dk</span>");
        } else {
          html.push('<span class="calendar-cell__dash">—</span>');
        }

        html.push("</div>");
      });

      html.push("</div></div>");
      root.innerHTML = html.join("");
    }

    document.getElementById("cal-prev").addEventListener("click", function () {
      calView.m -= 1;
      if (calView.m < 0) {
        calView.m = 11;
        calView.y -= 1;
      }
      renderMonth();
    });
    document.getElementById("cal-next").addEventListener("click", function () {
      calView.m += 1;
      if (calView.m > 11) {
        calView.m = 0;
        calView.y += 1;
      }
      renderMonth();
    });
    document.getElementById("cal-today").addEventListener("click", function () {
      var n = new Date();
      calView.y = n.getFullYear();
      calView.m = n.getMonth();
      renderMonth();
    });

    document.getElementById("btn-export-cal").addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "calisma-takip-yedek.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    document.getElementById("import-file-cal").addEventListener("change", function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var reader = new FileReader();
      var input = this;
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!data.sessions || !Array.isArray(data.sessions)) throw new Error("Geçersiz dosya");
          if (!data.goals) data.goals = { weeklyMinutesEnglish: 0, weeklyMinutesTechnical: 0 };
          if (data.goals.streakMinMinutesPerDay == null) data.goals.streakMinMinutesPerDay = 15;
          if (!data.books || !Array.isArray(data.books)) data.books = [];
          state = data;
          state.yds = mergeYds(state.yds);
          saveState(state);
          renderMonth();
        } catch (err) {
          alert("Dosya okunamadı veya format uyumsuz.");
        }
        input.value = "";
      };
      reader.readAsText(file);
    });

    if (typeof window !== "undefined") window.__calismaCalendarRefresh = renderMonth;

    renderMonth();
  }

  if (page === "dashboard") {
    bindExportClick();
    attachStandardImport();
    renderStats();
  } else if (page === "yeni") {
    el.btnStart.addEventListener("click", startTimer);
    el.btnPause.addEventListener("click", pauseTimer);
    el.btnReset.addEventListener("click", resetTimer);

    el.btnUseTimer.addEventListener("click", function () {
      var mins = Math.ceil(timerElapsedSec / 60);
      if (mins < 1 && timerElapsedSec > 0) mins = 1;
      if (el.category.value === "english") {
        var stT = el.enSubtype && el.enSubtype.value;
        if (!stT) {
          alert("Önce YDS çalışma türü seç.");
          return;
        }
        if (stT === "grammar" && el.enGrammarMin) {
          el.enGrammarMin.value = mins > 0 ? String(mins) : "";
          el.enGrammarMin.focus();
        } else if (stT === "kelime" && el.enKelimeEzberMin) {
          el.enKelimeEzberMin.value = mins > 0 ? String(mins) : "";
          el.enKelimeEzberMin.focus();
        } else if (["cloze", "tr_eng", "eng_tr", "passage", "paragraf", "deneme"].indexOf(stT) >= 0 && el.enOtherMin) {
          el.enOtherMin.value = mins > 0 ? String(mins) : "";
          el.enOtherMin.focus();
        }
      } else if (el.duration) {
        el.duration.value = mins > 0 ? String(mins) : "";
        el.duration.focus();
      }
    });

    el.category.addEventListener("change", function () {
      syncCategoryUI();
      if (el.category.value === "investment") setInvestDateDefaults();
    });
    if (el.enSubtype) el.enSubtype.addEventListener("change", syncEnglishSubtypeUI);
    if (el.bookSelect) {
      el.bookSelect.addEventListener("change", function () {
        syncBookNewFields();
        populateBookDateInputs();
      });
    }

    function setInvestDateDefaults() {
      if (!el.investDate) return;
      var n = new Date();
      var y = n.getFullYear();
      var m = String(n.getMonth() + 1);
      if (m.length < 2) m = "0" + m;
      var day = String(n.getDate());
      if (day.length < 2) day = "0" + day;
      el.investDate.value = y + "-" + m + "-" + day;
      if (el.investTime) el.investTime.value = "";
    }

    function clearEnglishFormFields() {
      if (el.enSubtype) el.enSubtype.value = "";
      if (el.enQGrammar) el.enQGrammar.value = "";
      if (el.enQCloze) el.enQCloze.value = "";
      if (el.enQTrEng) el.enQTrEng.value = "";
      if (el.enQEngTr) el.enQEngTr.value = "";
      if (el.enQPassage) el.enQPassage.value = "";
      if (el.enQParagraf) el.enQParagraf.value = "";
      if (el.enQDeneme) el.enQDeneme.value = "";
      if (el.enGrammarMin) el.enGrammarMin.value = "";
      if (el.enOtherMin) el.enOtherMin.value = "";
      if (el.enDogru) el.enDogru.value = "";
      if (el.enYanlis) el.enYanlis.value = "";
      if (el.enBos) el.enBos.value = "";
      if (el.enKelimeEzberMin) el.enKelimeEzberMin.value = "";
      if (el.enKelimeSayisi) el.enKelimeSayisi.value = "";
      syncEnglishSubtypeUI();
    }

    el.form.addEventListener("submit", function (e) {
      e.preventDefault();
      var cat = el.category.value;
      var duration = parseInt(el.duration.value, 10);

      if (cat === "english") {
        var st = el.enSubtype && el.enSubtype.value;
        if (!st) {
          alert("YDS çalışma türü seç.");
          return;
        }
        var gMin = el.enGrammarMin ? parseNonNegInt(el.enGrammarMin.value) : 0;
        var kEz = el.enKelimeEzberMin ? parseNonNegInt(el.enKelimeEzberMin.value) : 0;
        var kSay = el.enKelimeSayisi ? parseNonNegInt(el.enKelimeSayisi.value) : 0;
        var oMin = el.enOtherMin ? parseNonNegInt(el.enOtherMin.value) : 0;
        var qG = el.enQGrammar ? parseNonNegInt(el.enQGrammar.value) : 0;
        var qC = el.enQCloze ? parseNonNegInt(el.enQCloze.value) : 0;
        var qTe = el.enQTrEng ? parseNonNegInt(el.enQTrEng.value) : 0;
        var qEt = el.enQEngTr ? parseNonNegInt(el.enQEngTr.value) : 0;
        var qPa = el.enQPassage ? parseNonNegInt(el.enQPassage.value) : 0;
        var qPar = el.enQParagraf ? parseNonNegInt(el.enQParagraf.value) : 0;
        var qDen = el.enQDeneme ? parseNonNegInt(el.enQDeneme.value) : 0;
        var scForm = readEnScoreFromForm(el);
        var qFor = 0;
        if (st === "grammar") qFor = qG;
        else if (st === "cloze") qFor = qC;
        else if (st === "tr_eng") qFor = qTe;
        else if (st === "eng_tr") qFor = qEt;
        else if (st === "passage") qFor = qPa;
        else if (st === "paragraf") qFor = qPar;
        else if (st === "deneme") qFor = qDen;
        if (qFor > 0 && !validateEnScoreVsQ(qFor, scForm)) return;
        var c = { grammar: 0, cloze: 0, trEng: 0, engTr: 0, passage: 0, paragrafAtama: 0, deneme: 0 };
        var ok = false;
        if (st === "grammar") {
          c.grammar = qG;
          if (gMin > 0 || qG > 0) ok = true;
          duration = gMin > 0 ? gMin : 1;
        } else if (st === "cloze") {
          c.cloze = qC;
          if (qC > 0 || oMin > 0) ok = true;
          duration = oMin > 0 ? oMin : 1;
        } else if (st === "tr_eng") {
          c.trEng = qTe;
          if (qTe > 0 || oMin > 0) ok = true;
          duration = oMin > 0 ? oMin : 1;
        } else if (st === "eng_tr") {
          c.engTr = qEt;
          if (qEt > 0 || oMin > 0) ok = true;
          duration = oMin > 0 ? oMin : 1;
        } else if (st === "passage") {
          c.passage = qPa;
          if (qPa > 0 || oMin > 0) ok = true;
          duration = oMin > 0 ? oMin : 1;
        } else if (st === "paragraf") {
          c.paragrafAtama = qPar;
          if (qPar > 0 || oMin > 0) ok = true;
          duration = oMin > 0 ? oMin : 1;
        } else if (st === "deneme") {
          c.deneme = qDen;
          if (qDen > 0 || oMin > 0) ok = true;
          duration = oMin > 0 ? oMin : 1;
        } else if (st === "kelime") {
          if (kEz > 0 || kSay > 0) ok = true;
          duration = kEz > 0 ? kEz : 1;
        }
        if (!ok) {
          alert("Seçtiğin türe uygun soru sayısı veya süre gir.");
          return;
        }
      } else if (cat !== "investment") {
        if (!duration || duration < 1) {
          alert("Lütfen geçerli bir süre (dakika) gir.");
          return;
        }
      }

      var session = {
        id: uid(),
        category: cat,
        durationMinutes: cat === "investment" ? 0 : duration,
        note: el.note.value.trim(),
        tags: parseTags(el.tags.value),
        createdAt: new Date().toISOString(),
      };

      if (cat === "english") {
        var st2 = el.enSubtype && el.enSubtype.value;
        var c2 = { grammar: 0, cloze: 0, trEng: 0, engTr: 0, passage: 0, paragrafAtama: 0, deneme: 0 };
        var gM = el.enGrammarMin ? parseNonNegInt(el.enGrammarMin.value) : 0;
        var kE = el.enKelimeEzberMin ? parseNonNegInt(el.enKelimeEzberMin.value) : 0;
        var kS = el.enKelimeSayisi ? parseNonNegInt(el.enKelimeSayisi.value) : 0;
        if (st2 === "grammar") {
          c2.grammar = el.enQGrammar ? parseNonNegInt(el.enQGrammar.value) : 0;
        } else if (st2 === "cloze") {
          c2.cloze = el.enQCloze ? parseNonNegInt(el.enQCloze.value) : 0;
        } else if (st2 === "tr_eng") {
          c2.trEng = el.enQTrEng ? parseNonNegInt(el.enQTrEng.value) : 0;
        } else if (st2 === "eng_tr") {
          c2.engTr = el.enQEngTr ? parseNonNegInt(el.enQEngTr.value) : 0;
        } else if (st2 === "passage") {
          c2.passage = el.enQPassage ? parseNonNegInt(el.enQPassage.value) : 0;
        } else if (st2 === "paragraf") {
          c2.paragrafAtama = el.enQParagraf ? parseNonNegInt(el.enQParagraf.value) : 0;
        } else if (st2 === "deneme") {
          c2.deneme = el.enQDeneme ? parseNonNegInt(el.enQDeneme.value) : 0;
        }
        session.enSubtype = st2;
        session.durationMinutes = duration;
        session.enCounts = c2;
        session.enGrammarMinutes = st2 === "grammar" ? gM : 0;
        session.enKelimeEzberMinutes = st2 === "kelime" ? kE : 0;
        session.enKelimeSayisi = st2 === "kelime" && kS > 0 ? kS : null;
        var scSave = readEnScoreFromForm(el);
        if (st2 !== "kelime") {
          session.enScore = { dogru: scSave.dogru, yanlis: scSave.yanlis, bos: scSave.bos };
        }
      } else if (cat === "technical") {
        session.techTopic = el.techTopic.value.trim() || null;
      } else if (cat === "book") {
        var pagesRead = parseInt(el.bookPagesRead.value, 10);
        if (!pagesRead || pagesRead < 1) {
          alert("Bu oturumda kaç sayfa okuduğunu gir (en az 1).");
          return;
        }
        var bid = el.bookSelect.value;
        var bookTitle;
        var bookId;
        if (bid && bid !== "new") {
          bookId = bid;
          var bf = null;
          state.books.forEach(function (b) {
            if (b.id === bid) bf = b;
          });
          bookTitle = bf ? bf.title : el.bookTitleNew.value.trim();
        } else {
          bookTitle = el.bookTitleNew.value.trim();
          if (!bookTitle) {
            alert("Kitap adı yaz veya listeden seç.");
            return;
          }
          var tp = parseInt(el.bookTotalPages.value, 10);
          bookId = ensureBook(bookTitle, el.bookAuthor.value, isNaN(tp) ? null : tp);
        }
        session.bookId = bookId;
        session.bookTitle = bookTitle;
        session.pagesRead = pagesRead;
        session.finishedBook = el.bookFinished.checked;
        var startD = el.bookDateStart && el.bookDateStart.value;
        var endD = el.bookDateEnd && el.bookDateEnd.value;
        applyBookDatesToBook(bookId, startD, endD);
        if (session.finishedBook && bookId) {
          if (!endD || !String(endD).trim()) {
            markBookFinished(bookId);
          }
        }
      } else if (cat === "investment") {
        var txIso = investDateTimeFromInputs(el.investDate, el.investTime);
        if (!txIso) {
          alert("İşlem tarihi seç.");
          return;
        }
        session.transactionAt = txIso;
        session.assetName = el.investAsset.value.trim() || "Kayıt";
        var amt = parseFloat(el.investAmount.value);
        session.amount = isNaN(amt) ? null : amt;
        var priceRaw =
          el.investSharePrice && el.investSharePrice.value ? String(el.investSharePrice.value).trim().replace(",", ".") : "";
        var sp = priceRaw === "" ? null : parseFloat(priceRaw);
        session.sharePrice = sp != null && !isNaN(sp) ? sp : null;
        session.investAction = el.investAction.value || "arastirma";
        session.currency = "TRY";
      }

      addSession(session);
      el.note.value = "";
      el.tags.value = "";
      if (cat === "english") clearEnglishFormFields();
      if (el.techTopic) el.techTopic.value = "";
      if (el.bookTitleNew) el.bookTitleNew.value = "";
      if (el.bookAuthor) el.bookAuthor.value = "";
      if (el.bookPagesRead) el.bookPagesRead.value = "";
      if (el.bookTotalPages) el.bookTotalPages.value = "";
      if (el.bookFinished) el.bookFinished.checked = false;
      if (el.bookDateStart) el.bookDateStart.value = "";
      if (el.bookDateEnd) el.bookDateEnd.value = "";
      if (el.investAsset) el.investAsset.value = "";
      if (el.investAmount) el.investAmount.value = "";
      if (el.investSharePrice) el.investSharePrice.value = "";
      setInvestDateDefaults();
    });

    bindExportClick();
    attachStandardImport();
    populateBookSelect();
    updateTimerDisplay();
    setInvestDateDefaults();
    syncCategoryUI();
    syncBookNewFields();
  } else if (page === "gecmis") {
    el.filterCategory.addEventListener("change", renderList);
    bindExportClick();
    attachStandardImport();
    renderList();
    renderDashboardCharts();
  } else if (page === "kitaplar") {
    bindExportClick();
    attachStandardImport();
    var finBody = document.getElementById("kitaplar-finished-body");
    if (finBody && !finBody.dataset.bookDeleteBound) {
      finBody.dataset.bookDeleteBound = "1";
      finBody.addEventListener("click", function (e) {
        var save = e.target.closest(".book-meta-save");
        if (save) {
          var bidSave = save.getAttribute("data-book-id");
          if (!bidSave) return;
          var tr = save.closest("tr");
          if (!tr) return;
          var ti = tr.querySelector(".book-edit-title");
          var au = tr.querySelector(".book-edit-author");
          var tp = tr.querySelector(".book-edit-pages");
          applyBookMetaEdit(bidSave, ti ? ti.value : "", au ? au.value : "", tp ? tp.value : "");
          return;
        }
        var del = e.target.closest("[data-book-delete]");
        if (!del) return;
        var bid = del.getAttribute("data-book-delete");
        if (bid) deleteFinishedBook(bid);
      });
    }
    var ktl = document.getElementById("kitaplar-timeline");
    if (ktl && !ktl.dataset.bookDatesBound) {
      ktl.dataset.bookDatesBound = "1";
      ktl.addEventListener("click", function (e) {
        var toggle = e.target.closest("[data-book-toggle-edit]");
        if (toggle) {
          var block = toggle.closest(".book-block--card");
          var editor = block ? block.querySelector(".book-block__editor") : null;
          if (editor) {
            var open = editor.hidden;
            editor.hidden = !open;
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
            toggle.classList.toggle("book-block__edit-toggle--open", open);
          }
          return;
        }
        var metaBtn = e.target.closest(".book-meta-save");
        if (metaBtn) {
          var bidMeta = metaBtn.getAttribute("data-book-id");
          if (!bidMeta) return;
          var metaRow = metaBtn.closest(".book-meta-edit");
          if (!metaRow) return;
          var tiM = metaRow.querySelector(".book-edit-title");
          var auM = metaRow.querySelector(".book-edit-author");
          var tpM = metaRow.querySelector(".book-edit-pages");
          applyBookMetaEdit(bidMeta, tiM ? tiM.value : "", auM ? auM.value : "", tpM ? tpM.value : "");
          return;
        }
        var btn = e.target.closest(".book-date-save");
        if (!btn) return;
        var bid = btn.getAttribute("data-book-id");
        if (!bid) return;
        var row = btn.closest(".book-dates-edit");
        if (!row || row.classList.contains("book-meta-edit")) return;
        var si = row.querySelector(".book-date-start");
        var ei = row.querySelector(".book-date-end");
        applyBookDatesToBook(bid, si ? si.value : "", ei ? ei.value : "");
        renderKitaplarPage();
      });
    }
    renderKitaplarPage();
  } else if (page === "yatirim") {
    bindExportClick();
    attachStandardImport();
    var ydash = document.getElementById("yatirim-dashboard");
    if (ydash && !ydash.dataset.yatirimDashBound) {
      ydash.dataset.yatirimDashBound = "1";
      ydash.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-yatirim-mode]");
        if (!btn) return;
        sessionStorage.setItem("yatirimMode", btn.getAttribute("data-yatirim-mode"));
        renderYatirimPage();
      });
      ydash.addEventListener("change", function (e) {
        var t = e.target;
        if (t.id === "yatirim-week-ref") {
          sessionStorage.setItem("yatirimWeekRef", t.value);
          renderYatirimPage();
        } else if (t.id === "yatirim-select-year") {
          sessionStorage.setItem("yatirimYear", t.value);
          renderYatirimPage();
        } else if (t.id === "yatirim-select-month") {
          sessionStorage.setItem("yatirimMonth", t.value);
          renderYatirimPage();
        }
      });
    }
    var ytoolbar = document.getElementById("yatirim-table-toolbar");
    if (ytoolbar && !ytoolbar.dataset.bound) {
      ytoolbar.dataset.bound = "1";
      var rerenderTable = function () {
        renderYatirimTable();
      };
      var fq = document.getElementById("yatirim-filter-q");
      var fa = document.getElementById("yatirim-filter-action");
      var ff = document.getElementById("yatirim-filter-from");
      var ft = document.getElementById("yatirim-filter-to");
      if (fq) fq.addEventListener("input", rerenderTable);
      if (fa) fa.addEventListener("change", rerenderTable);
      if (ff) ff.addEventListener("change", rerenderTable);
      if (ft) ft.addEventListener("change", rerenderTable);
    }
    var ytbl = document.querySelector("#yatirim-list table.data-table");
    if (ytbl && !ytbl.dataset.sortBound) {
      ytbl.dataset.sortBound = "1";
      ytbl.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-yatirim-sort]");
        if (!btn || !ytbl.contains(btn)) return;
        var col = btn.getAttribute("data-yatirim-sort");
        if (!col) return;
        var prevCol = sessionStorage.getItem("yatirimSortCol") || "date";
        var prevDir = sessionStorage.getItem("yatirimSortDir") || "desc";
        if (col === prevCol) {
          sessionStorage.setItem("yatirimSortDir", prevDir === "asc" ? "desc" : "asc");
        } else {
          sessionStorage.setItem("yatirimSortCol", col);
          sessionStorage.setItem("yatirimSortDir", YATIRIM_SORT_DEFAULT_DIR[col] || "asc");
        }
        renderYatirimTable();
      });
    }
    renderYatirimPage();
  } else if (page === "yds") {
    bindExportClick();
    attachStandardImport();
    initYdsPage();
  } else if (page === "calendar") {
    initCalendarPage();
  }

  function refreshAfterServerSync() {
    if (page === "dashboard") renderStats();
    else if (page === "gecmis") renderList();
    else if (page === "kitaplar") renderKitaplarPage();
    else if (page === "yatirim") renderYatirimPage();
    else if (page === "yds") renderYdsPage();
    else if (page === "calendar" && typeof window !== "undefined" && window.__calismaCalendarRefresh) {
      window.__calismaCalendarRefresh();
    }
    if (page === "yeni" && el.bookSelect) populateBookSelect();
  }

  function initServerSync() {
    if (typeof fetch === "undefined") return;
    apiFetch("/api/state", { method: "GET" })
      .then(function (r) {
        if (r.status === 401) {
          return r.text().then(function (t) {
            try {
              var j = JSON.parse(t);
              if (j && j.needLogin && typeof window !== "undefined" && window.location) {
                var ret = window.location.pathname + window.location.search;
                window.location.href = "giris.html?return=" + encodeURIComponent(ret || "index.html");
                return null;
              }
            } catch (e) {}
            throw new Error("api");
          });
        }
        if (!r.ok) throw new Error("api");
        return r.json();
      })
      .then(function (data) {
        if (data == null) return;
        var serverEmpty = data._serverEmpty === true;
        delete data._serverEmpty;
        delete data._serverUpdatedAt;
        if (serverEmpty && state.sessions && state.sessions.length > 0) {
          pushStateToServerImmediate(state);
          return;
        }
        if (!serverEmpty) {
          state = normalizeStateObject(data);
          persistStateLocal(state);
          refreshAfterServerSync();
        }
      })
      .catch(function () {});
  }

  initServerSync();
})();
