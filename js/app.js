(function () {
  "use strict";

  var STORAGE_KEY = "calismaTakip_v1";

  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      v = v && v.trim();
      return v || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function isDarkTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  /** Kategori renkleri — tüm grafiklerde tutarlı (CSS değişkenlerinden okur). */
  function chartCategoryColors() {
    return {
      en: cssVar("--accent-en", "#5cc4b7"),
      tech: cssVar("--accent-tech", "#9aa0f5"),
      book: cssVar("--accent-book", "#f6c469"),
      inv: cssVar("--accent-invest", "#5fd3aa"),
      streak: cssVar("--streak", "#f97316"),
    };
  }

  /** Ana sayfa grafikleri — yumuşak ama okunaklı kategori paleti. */
  function dashCatColors() {
    return {
      en: "#4DB6AC",
      tech: "#9588E8",
      book: "#E5B84C",
      inv: "#4EC992",
      enSoft: "rgba(77, 182, 172, 0.88)",
      techSoft: "rgba(149, 136, 232, 0.88)",
      bookSoft: "rgba(229, 184, 76, 0.88)",
      invSoft: "rgba(78, 201, 146, 0.88)",
      enHover: "rgba(56, 162, 152, 0.96)",
      techHover: "rgba(130, 116, 220, 0.96)",
      bookHover: "rgba(212, 165, 40, 0.96)",
      invHover: "rgba(60, 180, 130, 0.96)",
      enPrev: "rgba(77, 182, 172, 0.38)",
      techPrev: "rgba(149, 136, 232, 0.38)",
      bookPrev: "rgba(229, 184, 76, 0.38)",
      invPrev: "rgba(78, 201, 146, 0.38)",
      prevHover: "rgba(100, 116, 139, 0.55)",
      curPeriod: "rgba(77, 182, 172, 0.88)",
      curPeriodHover: "rgba(56, 162, 152, 0.96)",
      prevPeriod: "rgba(148, 163, 184, 0.52)",
      prevPeriodHover: "rgba(100, 116, 139, 0.68)",
      grid: "rgba(148, 163, 184, 0.14)",
    };
  }

  /** Aktif temaya göre eksen/grid/tooltip renkleri. */
  function chartTheme() {
    var dark = isDarkTheme();
    return {
      text: cssVar("--text", dark ? "#e8edf6" : "#0f172a"),
      muted: cssVar("--muted", dark ? "#94a3b8" : "#64748b"),
      grid: dark ? "rgba(148, 163, 184, 0.16)" : "rgba(100, 116, 139, 0.14)",
      tooltipBg: dark ? "rgba(2, 6, 23, 0.94)" : "rgba(15, 23, 42, 0.92)",
      surface: cssVar("--surface", dark ? "#131d31" : "#ffffff"),
    };
  }

  /** Chart.js global varsayılanlarını temaya göre ayarlar (tüm grafikler etkilenir). */
  function applyChartDefaults() {
    if (typeof Chart === "undefined") return;
    var th = chartTheme();
    Chart.defaults.font.family = '"DM Sans", system-ui, sans-serif';
    Chart.defaults.color = th.muted;
    Chart.defaults.borderColor = th.grid;
    if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
      Chart.defaults.plugins.tooltip.backgroundColor = th.tooltipBg;
      Chart.defaults.plugins.tooltip.titleColor = "#f8fafc";
      Chart.defaults.plugins.tooltip.bodyColor = "#e2e8f0";
      Chart.defaults.plugins.tooltip.padding = 12;
      Chart.defaults.plugins.tooltip.usePointStyle = true;
      Chart.defaults.plugins.tooltip.cornerRadius = 8;
      Chart.defaults.plugins.tooltip.boxPadding = 4;
    }
  }

  function defaultYds() {
    return {
      examDate: "",
      applicationDate: "",
      chartStartDate: "",
      programStartDate: "",
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
      noteCategories: [],
    };
  }

  function normalizeStateObject(data) {
    if (!data || typeof data !== "object") return defaultState();
    if (!data.sessions || !Array.isArray(data.sessions)) return defaultState();
    if (!data.goals) data.goals = { weeklyMinutesEnglish: 0, weeklyMinutesTechnical: 0 };
    if (data.goals.streakMinMinutesPerDay == null) data.goals.streakMinMinutesPerDay = 15;
    if (!data.books || !Array.isArray(data.books)) data.books = [];
    data.yds = mergeYds(data.yds);
    data.sessions.forEach(function (s) {
      if (s.category != null) s.category = String(s.category).trim();
      if (!s.category && (s.cat === "investment" || s.type === "investment")) s.category = "investment";
    });
    if (!data.noteCategories || !Array.isArray(data.noteCategories)) data.noteCategories = [];
    var _ncClean = [];
    var _nci;
    for (_nci = 0; _nci < data.noteCategories.length; _nci++) {
      var _nc = normalizeNoteCategory(data.noteCategories[_nci]);
      if (_nc) _ncClean.push(_nc);
    }
    data.noteCategories = _ncClean;
    if (repairBookSessionsInData(data)) data._persistAfterNormalize = true;
    return data;
  }

  /** Kitap oturumları: sayfa sayısını sayıya çevir, eksik bookId'yi kitap adına göre bağla. */
  function repairBookSessionsInData(data) {
    if (!data.sessions || !data.books) return false;
    var changed = false;
    data.sessions.forEach(function (s) {
      if (String(s.category || "").trim() !== "book") return;
      var pr = parseNonNegInt(s.pagesRead);
      if (pr > 0 && s.pagesRead !== pr) {
        s.pagesRead = pr;
        changed = true;
      } else if (s.pagesRead != null && String(s.pagesRead).trim() !== "" && pr === 0) {
        s.pagesRead = 0;
        changed = true;
      }
      var bookIdValid = false;
      if (s.bookId) {
        var bi;
        for (bi = 0; bi < data.books.length; bi++) {
          if (data.books[bi].id === s.bookId) {
            bookIdValid = true;
            break;
          }
        }
      }
      if (bookIdValid) return;
      var title = (s.bookTitle || "").trim();
      if (!title) return;
      var found = null;
      var bj;
      for (bj = 0; bj < data.books.length; bj++) {
        if (String(data.books[bj].title || "").trim().toLocaleLowerCase("tr") === title.toLocaleLowerCase("tr")) {
          found = data.books[bj];
          break;
        }
      }
      if (found) {
        s.bookId = found.id;
        changed = true;
        return;
      }
      var nid = uid();
      data.books.push({
        id: nid,
        title: title,
        author: null,
        totalPages: null,
        startedAt: s.createdAt || null,
        finishedAt: null,
      });
      s.bookId = nid;
      changed = true;
    });
    return changed;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var data = JSON.parse(raw);
      data = normalizeStateObject(data);
      if (data._persistAfterNormalize) {
        delete data._persistAfterNormalize;
        persistStateLocal(data);
        pushStateToServerImmediate(data);
      }
      return data;
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

  function isIsoInWeekStarting(isoStr, weekAnyDay) {
    if (!isoStr) return false;
    var t = new Date(isoStr);
    if (isNaN(t.getTime())) return false;
    var ws = startOfWeekMonday(weekAnyDay);
    var we = new Date(ws);
    we.setDate(we.getDate() + 7);
    return t >= ws && t < we;
  }

  /** Haftalık toplamlar: geçmiş grafikleriyle aynı ağırlık (yatırım = işlem başına 1). */
  function weeklyStudyWeightsMonday(monday) {
    var en = 0;
    var tech = 0;
    var book = 0;
    var inv = 0;
    state.sessions.forEach(function (s) {
      var iso = sessionEffectiveTime(s);
      if (!isIsoInWeekStarting(iso, monday)) return;
      var w = sessionChartWeight(s);
      var c = String(s.category || "").trim();
      if (c === "english") en += w;
      else if (c === "technical") tech += w;
      else if (c === "book") book += w;
      else if (c === "investment") inv += w;
    });
    return { en: en, tech: tech, book: book, inv: inv, total: en + tech + book + inv };
  }

  /** Aylık toplamlar: haftalık ile aynı ağırlık (yatırım = işlem başına 1). */
  function monthlyStudyWeights(year, monthIndex) {
    var en = 0;
    var tech = 0;
    var book = 0;
    var inv = 0;
    state.sessions.forEach(function (s) {
      var iso = sessionEffectiveTime(s);
      if (!iso) return;
      var t = new Date(iso);
      if (isNaN(t.getTime())) return;
      if (t.getFullYear() !== year || t.getMonth() !== monthIndex) return;
      var w = sessionChartWeight(s);
      var c = String(s.category || "").trim();
      if (c === "english") en += w;
      else if (c === "technical") tech += w;
      else if (c === "book") book += w;
      else if (c === "investment") inv += w;
    });
    return { en: en, tech: tech, book: book, inv: inv, total: en + tech + book + inv };
  }

  function englishSubtypeMinutesSince(cutoffDate) {
    var agg = {};
    state.sessions.forEach(function (s) {
      if (String(s.category || "").trim() !== "english") return;
      var iso = sessionEffectiveTime(s);
      if (!iso || new Date(iso) < cutoffDate) return;
      var dm = s.durationMinutes || 0;
      var st = s.enSubtype;
      function add(key, m) {
        if (m > 0) agg[key] = (agg[key] || 0) + m;
      }
      if (st === "grammar") {
        add("grammar", s.enGrammarMinutes || 0);
      } else if (st === "cloze") {
        add("cloze", dm);
      } else if (st === "tr_eng") {
        add("tr_eng", dm);
      } else if (st === "eng_tr") {
        add("eng_tr", dm);
      } else if (st === "passage") {
        add("passage", dm);
      } else if (st === "listening") {
        add("listening", dm);
      } else if (st === "paragraf") {
        add("paragraf", dm);
      } else if (st === "deneme") {
        add("deneme", dm);
      } else if (st === "kelime") {
        add("kelime", s.enKelimeEzberMinutes || 0);
      } else if (st === "calisma") {
        add("calisma", dm);
      } else {
        add("grammar", s.enGrammarMinutes || 0);
        add("kelime", s.enKelimeEzberMinutes || 0);
      }
    });
    return agg;
  }

  function cumulativeEnglishMinutesByDay(programStartKey) {
    var dayMin = {};
    state.sessions.forEach(function (s) {
      if (String(s.category || "").trim() !== "english") return;
      var iso = sessionEffectiveTime(s);
      if (!iso) return;
      var k = dateKeyLocal(new Date(iso));
      if (programStartKey && k < programStartKey) return;
      var dm = s.durationMinutes || 0;
      dayMin[k] = (dayMin[k] || 0) + dm;
    });
    var keys = Object.keys(dayMin).sort();
    var labels = [];
    var data = [];
    var cum = 0;
    var ki;
    for (ki = 0; ki < keys.length; ki++) {
      cum += dayMin[keys[ki]];
      labels.push(keys[ki].slice(5).replace("-", "/"));
      data.push(cum);
    }
    return { labels: labels, data: data, total: cum };
  }

  function cumulativeEnglishQuestionsByDay(programStartKey) {
    var dayQ = {};
    state.sessions.forEach(function (s) {
      if (String(s.category || "").trim() !== "english") return;
      var iso = sessionEffectiveTime(s);
      if (!iso) return;
      var k = dateKeyLocal(new Date(iso));
      if (programStartKey && k < programStartKey) return;
      dayQ[k] = (dayQ[k] || 0) + englishSessionQuestionCount(s);
    });
    var keys = Object.keys(dayQ).sort();
    var labels = [];
    var data = [];
    var cum = 0;
    var ki;
    for (ki = 0; ki < keys.length; ki++) {
      cum += dayQ[keys[ki]];
      labels.push(keys[ki].slice(5).replace("-", "/"));
      data.push(cum);
    }
    return { labels: labels, data: data, total: cum };
  }

  function cumulativeEnglishProgressByDay(programStartKey) {
    var dayMin = {};
    var dayQ = {};
    state.sessions.forEach(function (s) {
      if (String(s.category || "").trim() !== "english") return;
      var iso = sessionEffectiveTime(s);
      if (!iso) return;
      var k = dateKeyLocal(new Date(iso));
      if (programStartKey && k < programStartKey) return;
      var dm = s.durationMinutes || 0;
      if (dm > 0) dayMin[k] = (dayMin[k] || 0) + dm;
      var q = englishSessionQuestionCount(s);
      if (q > 0) dayQ[k] = (dayQ[k] || 0) + q;
    });
    var keySet = {};
    Object.keys(dayMin).forEach(function (k) { keySet[k] = true; });
    Object.keys(dayQ).forEach(function (k) { keySet[k] = true; });
    var keys = Object.keys(keySet).sort();
    var labels = [];
    var dataMin = [];
    var dataQ = [];
    var cumM = 0;
    var cumQ = 0;
    var ki;
    for (ki = 0; ki < keys.length; ki++) {
      cumM += dayMin[keys[ki]] || 0;
      cumQ += dayQ[keys[ki]] || 0;
      labels.push(keys[ki].slice(5).replace("-", "/"));
      dataMin.push(cumM);
      dataQ.push(cumQ);
    }
    return { labels: labels, dataMin: dataMin, dataQ: dataQ, totalMin: cumM, totalQ: cumQ };
  }

  function ydsSubtypeColorMap() {
    return {
      calisma: "#60a5fa",
      grammar: "#7dd3fc",
      cloze: "#a78bfa",
      tr_eng: "#c4b5fd",
      eng_tr: "#818cf8",
      passage: "#fbbf24",
      listening: "#22d3ee",
      paragraf: "#fb923c",
      kelime: "#34d399",
    };
  }

  function ydsSubtypeCutoffDate(period) {
    if (period === "all") return new Date(0);
    var cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    var days = period === "7" ? 7 : 28;
    cutoff.setDate(cutoff.getDate() - days);
    return cutoff;
  }

  function buildYdsSubtypeSeries(period) {
    var cutoff = ydsSubtypeCutoffDate(period);
    var rawAgg = englishSubtypeMinutesSince(cutoff);
    if (rawAgg.deneme != null) delete rawAgg.deneme;
    var colors = ydsSubtypeColorMap();
    var order = ["calisma", "grammar", "cloze", "tr_eng", "eng_tr", "passage", "listening", "paragraf", "kelime"];
    var labels = [];
    var data = [];
    var bg = [];
    var oi;
    for (oi = 0; oi < order.length; oi++) {
      var key = order[oi];
      var m = rawAgg[key] || 0;
      if (m <= 0) continue;
      labels.push(enSubtypeLabels[key] || key);
      data.push(m);
      bg.push(colors[key] || "#64748b");
    }
    Object.keys(rawAgg).forEach(function (key) {
      if (key === "deneme") return;
      if (order.indexOf(key) >= 0) return;
      var m2 = rawAgg[key] || 0;
      if (m2 <= 0) return;
      labels.push(enSubtypeLabels[key] || key);
      data.push(m2);
      bg.push(colors[key] || "#64748b");
    });
    return { labels: labels, data: data, bg: bg };
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
      sessionStorage.setItem("yatirimWeekRef", dateKeyLocal(n));
    }
  }

  function setYatirimWeekRefToLocalToday() {
    sessionStorage.setItem("yatirimWeekRef", dateKeyLocal(new Date()));
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
    var refDayKey = dateKeyLocal(ref);
    var todayKey = dateKeyLocal(new Date());
    var label =
      refDayKey === todayKey
        ? "Bugün"
        : ws.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) +
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

  var INV_CHART_COLORS = ["#5cc4b7", "#9aa0f5", "#d2814f", "#5fa777", "#5bb0d6", "#d9b14e", "#cf6f68", "#7d8ad6", "#cf7aae"];

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
  var dashboardChartWeekCompare = null;
  var gecmisChart8Week = null;

  function destroyDashboardIndexCharts() {
    if (typeof Chart === "undefined") return;
    if (dashboardChartWeekCompare) {
      dashboardChartWeekCompare.destroy();
      dashboardChartWeekCompare = null;
    }
  }

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
    if (gecmisChart8Week) {
      gecmisChart8Week.destroy();
      gecmisChart8Week = null;
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
    var canvas8 = document.getElementById("chart-weeks-8-stacked");
    if (!canvasWeek && !canvasDaily && !canvas8) return;
    state = loadState();

    destroyDashboardCharts();
    if (typeof Chart === "undefined") return;

    var dc = dashCatColors();
    var dashPeriod = sessionStorage.getItem("dashChartsPeriod") === "month" ? "month" : "week";
    var dashNow = new Date();

    var w = dashPeriod === "month"
      ? monthlyStudyWeights(dashNow.getFullYear(), dashNow.getMonth())
      : weeklyChartWeights();
    var distTitleEl = document.getElementById("dash-dist-title");
    var distTotalEl = document.getElementById("dash-dist-total");
    if (distTitleEl) distTitleEl.textContent = dashPeriod === "month" ? "Bu ay kategori dağılımı" : "Bu hafta kategori dağılımı";
    if (canvasWeek) {
      var cardW = canvasWeek.closest(".chart-card");
      if (w.total <= 0) {
        toggleChartCardEmpty(cardW, true, dashPeriod === "month" ? "Bu ay henüz kayıt yok." : "Bu hafta henüz kayıt yok.");
        if (distTotalEl) distTotalEl.hidden = true;
      } else {
        toggleChartCardEmpty(cardW, false, "");
        var studyMin = (w.en || 0) + (w.tech || 0) + (w.book || 0);
        if (distTotalEl) {
          var totalParts = [];
          if (studyMin > 0) totalParts.push(formatMinutesAsHours(studyMin));
          if (w.inv > 0) totalParts.push(w.inv + " işlem");
          distTotalEl.textContent = totalParts.length ? "Toplam · " + totalParts.join(" · ") : "";
          distTotalEl.hidden = !totalParts.length;
        }
        var labelsW = [];
        var dataW = [];
        var colorsW = [];
        if (w.en > 0) {
          labelsW.push("YDS");
          dataW.push(w.en);
          colorsW.push(dc.en);
        }
        if (w.tech > 0) {
          labelsW.push("Teknik");
          dataW.push(w.tech);
          colorsW.push(dc.tech);
        }
        if (w.book > 0) {
          labelsW.push("Kitap");
          dataW.push(w.book);
          colorsW.push(dc.book);
        }
        if (w.inv > 0) {
          labelsW.push("Yatırım");
          dataW.push(w.inv);
          colorsW.push(dc.inv);
        }
        dashboardChartWeek = new Chart(canvasWeek, {
          type: "doughnut",
          data: {
            labels: labelsW,
            datasets: [
              {
                data: dataW,
                backgroundColor: colorsW,
                borderColor: chartTheme().surface,
                borderWidth: 2,
                borderRadius: 8,
                hoverOffset: 5,
                spacing: 3,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "64%",
            layout: { padding: 6 },
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  usePointStyle: true,
                  pointStyle: "circle",
                  boxWidth: 8,
                  boxHeight: 8,
                  padding: 14,
                  font: { size: 12 },
                  color: "#94a3b8",
                  generateLabels: function (chart) {
                    var data = chart.data;
                    if (!data.labels || !data.labels.length || !data.datasets.length) {
                      return Chart.defaults.plugins.legend.labels.generateLabels(chart);
                    }
                    var dsMeta = chart.getDatasetMeta(0);
                    return data.labels.map(function (label, i) {
                      var style = dsMeta.controller.getStyle(i);
                      var val = data.datasets[0].data[i] || 0;
                      return {
                        text: label + " · " + dashDoughnutValueLabel(label, val),
                        fillStyle: style.backgroundColor,
                        strokeStyle: style.borderColor,
                        lineWidth: style.borderWidth,
                        hidden: !chart.getDataVisibility(i),
                        index: i,
                        datasetIndex: 0,
                      };
                    });
                  },
                },
              },
              tooltip: {
                usePointStyle: true,
                padding: 12,
                backgroundColor: "rgba(15,23,42,0.92)",
                titleFont: { size: 13, weight: "600" },
                bodyFont: { size: 12 },
                callbacks: {
                  label: function (ctx) {
                    var v = ctx.raw != null ? ctx.raw : 0;
                    var lb = ctx.label || "";
                    var lbls = ctx.chart.data.labels || [];
                    var arr = ctx.dataset.data || [];
                    var totals = dashDoughnutTotals(arr, lbls);
                    if (lb === "Yatırım") return "  Yatırım: " + v + " işlem";
                    var pct = totals.sumMin > 0 ? Math.round((v / totals.sumMin) * 100) : 0;
                    return "  " + lb + ": " + formatMinutesAsHours(v) + " (çalışma süresinin %" + pct + "'i)";
                  },
                },
              },
            },
          },
        });
      }
    }

    var dailyDays = dashPeriod === "month" ? 30 : 7;
    var dailyBarMax = dashPeriod === "month" ? 14 : 26;
    var trendTitleEl = document.getElementById("dash-trend-title");
    if (trendTitleEl) trendTitleEl.textContent = dashPeriod === "month" ? "Son 30 gün" : "Son 7 gün";
    if (canvasDaily) {
      var maps = dayCategoryMapsForCharts();
      var labels7 = [];
      var dEn = [];
      var dTech = [];
      var dBook = [];
      var dInv = [];
      var i;
      var dailySum = 0;
      for (i = dailyDays - 1; i >= 0; i--) {
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
        toggleChartCardEmpty(cardD, true, dashPeriod === "month" ? "Son 30 günde kayıt yok." : "Son 7 günde kayıt yok.");
      } else {
        toggleChartCardEmpty(cardD, false, "");
        dashboardChartDaily = new Chart(canvasDaily, {
          type: "bar",
          plugins: [dashStackedTotalLabelsPlugin()],
          data: {
            labels: labels7,
            datasets: [
              { label: "YDS", data: dEn, backgroundColor: dc.enSoft, borderWidth: 0, borderRadius: 4, borderSkipped: false, maxBarThickness: dailyBarMax },
              { label: "Teknik", data: dTech, backgroundColor: dc.techSoft, borderWidth: 0, borderRadius: 4, borderSkipped: false, maxBarThickness: dailyBarMax },
              { label: "Kitap", data: dBook, backgroundColor: dc.bookSoft, borderWidth: 0, borderRadius: 4, borderSkipped: false, maxBarThickness: dailyBarMax },
              { label: "Yatırım", data: dInv, backgroundColor: dc.invSoft, borderWidth: 0, borderRadius: 4, borderSkipped: false, maxBarThickness: dailyBarMax },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 16 } },
            interaction: { mode: "index", intersect: false },
            scales: {
              x: {
                stacked: true,
                grid: { display: false },
                border: { display: false },
                ticks: { font: { size: 11 }, color: "#94a3b8" },
              },
              y: {
                stacked: true,
                beginAtZero: true,
                border: { display: false },
                grid: { color: dc.grid },
                title: { display: true, text: "Saat", font: { size: 11 }, color: "#94a3b8" },
                ticks: {
                  color: "#94a3b8",
                  font: { size: 11 },
                  padding: 6,
                  maxTicksLimit: 5,
                  callback: function (val) {
                    return formatHoursAxisTick(val);
                  },
                },
              },
            },
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  usePointStyle: true,
                  pointStyle: "circle",
                  boxWidth: 8,
                  boxHeight: 8,
                  padding: 14,
                  font: { size: 12 },
                  color: "#94a3b8",
                },
              },
              tooltip: {
                usePointStyle: true,
                padding: 12,
                backgroundColor: "rgba(15,23,42,0.92)",
                titleFont: { size: 13, weight: "600" },
                bodyFont: { size: 12 },
                callbacks: {
                  label: function (context) {
                    var label = context.dataset.label || "";
                    var v = context.parsed.y != null ? context.parsed.y : 0;
                    if (v === 0) return null;
                    if (label === "Yatırım") return "  " + label + ": " + v + " işlem";
                    return "  " + label + ": " + formatMinutesAsHours(v);
                  },
                },
              },
            },
          },
        });
      }
    }

    var longTitleEl = document.getElementById("dash-long-title");
    if (longTitleEl) longTitleEl.textContent = dashPeriod === "month" ? "Son 6 ay (kategori)" : "Son 8 hafta (kategori)";
    if (canvas8) {
      if (gecmisChart8Week) {
        gecmisChart8Week.destroy();
        gecmisChart8Week = null;
      }
      var labels8 = [];
      var wEn = [];
      var wTech = [];
      var wBook = [];
      var wInv = [];
      var wi;
      if (dashPeriod === "month") {
        for (wi = 5; wi >= 0; wi--) {
          var md = new Date(dashNow.getFullYear(), dashNow.getMonth() - wi, 1);
          var tM = monthlyStudyWeights(md.getFullYear(), md.getMonth());
          labels8.push(MONTH_SHORT_TR[md.getMonth()] + " " + String(md.getFullYear()).slice(2));
          wEn.push(tM.en);
          wTech.push(tM.tech);
          wBook.push(tM.book);
          wInv.push(tM.inv);
        }
      } else {
        var endW8 = startOfWeekMonday(new Date());
        for (wi = 7; wi >= 0; wi--) {
          var mon8 = new Date(endW8);
          mon8.setDate(mon8.getDate() - wi * 7);
          var t8 = weeklyStudyWeightsMonday(mon8);
          labels8.push(mon8.getDate() + " " + MONTH_SHORT_TR[mon8.getMonth()]);
          wEn.push(t8.en);
          wTech.push(t8.tech);
          wBook.push(t8.book);
          wInv.push(t8.inv);
        }
      }
      var sum8 = 0;
      for (wi = 0; wi < wEn.length; wi++) {
        sum8 += wEn[wi] + wTech[wi] + wBook[wi] + wInv[wi];
      }
      var card8 = canvas8.closest(".chart-card");
      if (sum8 <= 0) {
        toggleChartCardEmpty(card8, true, dashPeriod === "month" ? "Son 6 ayda kayıt yok." : "Son 8 haftada kayıt yok.");
      } else {
        toggleChartCardEmpty(card8, false, "");
        gecmisChart8Week = new Chart(canvas8, {
          type: "bar",
          plugins: [dashStackedTotalLabelsPlugin()],
          data: {
            labels: labels8,
            datasets: [
              { label: "YDS", data: wEn, backgroundColor: dc.enSoft, borderWidth: 0, borderRadius: 4, borderSkipped: false, maxBarThickness: 40 },
              { label: "Teknik", data: wTech, backgroundColor: dc.techSoft, borderWidth: 0, borderRadius: 4, borderSkipped: false, maxBarThickness: 40 },
              { label: "Kitap", data: wBook, backgroundColor: dc.bookSoft, borderWidth: 0, borderRadius: 4, borderSkipped: false, maxBarThickness: 40 },
              { label: "Yatırım", data: wInv, backgroundColor: dc.invSoft, borderWidth: 0, borderRadius: 4, borderSkipped: false, maxBarThickness: 40 },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 16 } },
            interaction: { mode: "index", intersect: false },
            scales: {
              x: {
                stacked: true,
                grid: { display: false },
                border: { display: false },
                ticks: { font: { size: 11 }, color: "#94a3b8" },
              },
              y: {
                stacked: true,
                beginAtZero: true,
                border: { display: false },
                grid: { color: dc.grid },
                title: { display: true, text: "Saat", font: { size: 11 }, color: "#94a3b8" },
                ticks: {
                  color: "#94a3b8",
                  font: { size: 11 },
                  padding: 6,
                  maxTicksLimit: 6,
                  callback: function (val) {
                    return formatHoursAxisTick(val);
                  },
                },
              },
            },
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  usePointStyle: true,
                  pointStyle: "circle",
                  boxWidth: 8,
                  boxHeight: 8,
                  padding: 14,
                  font: { size: 12 },
                  color: "#94a3b8",
                },
              },
              tooltip: {
                usePointStyle: true,
                padding: 12,
                backgroundColor: "rgba(15,23,42,0.92)",
                titleFont: { size: 13, weight: "600" },
                bodyFont: { size: 12 },
                callbacks: {
                  label: function (context) {
                    var label = context.dataset.label || "";
                    var v = context.parsed.y != null ? context.parsed.y : 0;
                    if (v === 0) return null;
                    if (label === "Yatırım") return "  " + label + ": " + v + " işlem";
                    return "  " + label + ": " + formatMinutesAsHours(v);
                  },
                },
              },
            },
          },
        });
      }
    }
  }

  function renderDashboardIndexCharts() {
    if (page !== "dashboard") return;
    var cCmp = document.getElementById("dashboard-chart-week-compare");
    if (!cCmp) return;
    state = loadState();
    destroyDashboardIndexCharts();
    if (typeof Chart === "undefined") return;

    var dc = dashCatColors();
    var mode = sessionStorage.getItem("dashChartsPeriod") === "month" ? "month" : "week";
    var thisW, prevW, curLabel, prevLabel, emptyMsg;
    if (mode === "month") {
      var now = new Date();
      var prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      thisW = monthlyStudyWeights(now.getFullYear(), now.getMonth());
      prevW = monthlyStudyWeights(prevMonthDate.getFullYear(), prevMonthDate.getMonth());
      curLabel = "Bu ay";
      prevLabel = "Geçen ay";
      emptyMsg = "Bu ve geçen ay için kayıt yok.";
    } else {
      var curMon = startOfWeekMonday(new Date());
      var prevMon = new Date(curMon);
      prevMon.setDate(prevMon.getDate() - 7);
      thisW = weeklyStudyWeightsMonday(curMon);
      prevW = weeklyStudyWeightsMonday(prevMon);
      curLabel = "Bu hafta";
      prevLabel = "Geçen hafta";
      emptyMsg = "Bu ve geçen hafta için kayıt yok.";
    }

    var cmpTitle = document.getElementById("dash-compare-title");
    if (cmpTitle) cmpTitle.textContent = mode === "month" ? "Bu ay vs geçen ay" : "Bu hafta vs geçen hafta";

    if (cCmp) {
      var cardCmp = cCmp.closest(".chart-card");
      var cmpSum = thisW.total + prevW.total;
      if (cmpSum <= 0) {
        toggleChartCardEmpty(cardCmp, true, emptyMsg);
      } else {
        toggleChartCardEmpty(cardCmp, false, "");
        dashboardChartWeekCompare = new Chart(cCmp, {
          type: "bar",
          plugins: [dashGroupedBarLabelsPlugin()],
          data: {
            labels: ["YDS", "Teknik", "Kitap", "Yatırım"],
            datasets: [
              {
                label: curLabel,
                data: [thisW.en, thisW.tech, thisW.book, thisW.inv],
                backgroundColor: dc.curPeriod,
                hoverBackgroundColor: dc.curPeriodHover,
                borderWidth: 0,
                borderRadius: 6,
                borderSkipped: false,
                maxBarThickness: 34,
              },
              {
                label: prevLabel,
                data: [prevW.en, prevW.tech, prevW.book, prevW.inv],
                backgroundColor: dc.prevPeriod,
                hoverBackgroundColor: dc.prevPeriodHover,
                borderWidth: 0,
                borderRadius: 6,
                borderSkipped: false,
                maxBarThickness: 34,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 16 } },
            categoryPercentage: 0.62,
            barPercentage: 0.9,
            interaction: { mode: "index", intersect: false },
            scales: {
              x: {
                grid: { display: false },
                border: { display: false },
                ticks: { font: { size: 12, weight: "500" }, color: "#94a3b8" },
              },
              y: {
                beginAtZero: true,
                border: { display: false },
                grid: { color: dc.grid },
                title: { display: true, text: "Saat", font: { size: 11 }, color: "#94a3b8" },
                ticks: {
                  color: "#94a3b8",
                  font: { size: 11 },
                  padding: 6,
                  maxTicksLimit: 5,
                  callback: function (val) {
                    return formatHoursAxisTick(val);
                  },
                },
              },
            },
            plugins: {
              legend: {
                position: "top",
                align: "end",
                labels: {
                  usePointStyle: true,
                  pointStyle: "circle",
                  boxWidth: 8,
                  boxHeight: 8,
                  padding: 14,
                  font: { size: 12 },
                  color: "#94a3b8",
                  generateLabels: function (chart) {
                    var ds = chart.data.datasets;
                    return ds.map(function (d, i) {
                      var bg = d.backgroundColor;
                      var color = typeof bg === "string" ? bg : Array.isArray(bg) ? bg[0] : "#94a3b8";
                      return {
                        text: d.label || "",
                        fillStyle: color,
                        strokeStyle: color,
                        lineWidth: 0,
                        hidden: !chart.isDatasetVisible(i),
                        index: i,
                        datasetIndex: i,
                        pointStyle: "circle",
                      };
                    });
                  },
                },
              },
              tooltip: {
                usePointStyle: true,
                padding: 12,
                backgroundColor: "rgba(15,23,42,0.92)",
                titleFont: { size: 13, weight: "600" },
                bodyFont: { size: 12 },
                bodySpacing: 6,
                callbacks: {
                  label: function (ctx) {
                    var v = ctx.raw != null ? ctx.raw : 0;
                    var lb = ctx.dataset.label || "";
                    var cat = ctx.label || "";
                    if (cat === "Yatırım") return "  " + lb + ": " + v + " işlem";
                    return "  " + lb + ": " + formatMinutesAsHours(v);
                  },
                  footer: function (items) {
                    if (!items || !items.length) return "";
                    var idx = items[0].dataIndex;
                    var cat = items[0].label || "";
                    var cur = [thisW.en, thisW.tech, thisW.book, thisW.inv][idx] || 0;
                    var prev = [prevW.en, prevW.tech, prevW.book, prevW.inv][idx] || 0;
                    var diff = cur - prev;
                    if (cat === "Yatırım") {
                      if (diff === 0) return "Değişim yok";
                      return (diff > 0 ? "▲ +" : "▼ ") + diff + " işlem";
                    }
                    if (prev === 0 && cur === 0) return "Kayıt yok";
                    if (prev === 0) return "▲ Yeni (+" + formatMinutesAsHours(cur) + ")";
                    var pct = Math.round((diff / prev) * 100);
                    if (diff === 0) return mode === "month" ? "Geçen ayla aynı" : "Geçen haftayla aynı";
                    return (diff > 0 ? "▲ +" : "▼ ") + formatMinutesAsHours(Math.abs(diff)) + " (" + (pct > 0 ? "+" : "") + pct + "%)";
                  },
                },
              },
            },
          },
        });
      }
    }

  }

  function renderDashboardHeatmap() {
    if (page !== "dashboard") return;
    var root = document.getElementById("dashboard-activity-heatmap");
    if (!root) return;
    state = loadState();
    var map = {};
    state.sessions.forEach(function (s) {
      var iso = sessionEffectiveTime(s);
      if (!iso) return;
      var k = dateKeyLocal(new Date(iso));
      var dm = s.durationMinutes || 0;
      map[k] = (map[k] || 0) + dm;
    });
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var cols = 28;
    var startMonday = new Date(startOfWeekMonday(today));
    startMonday.setDate(startMonday.getDate() - (cols - 1) * 7);
    var maxV = 0;
    var row;
    var col;
    for (col = 0; col < cols; col++) {
      for (row = 0; row < 7; row++) {
        var day = new Date(startMonday);
        day.setDate(startMonday.getDate() + col * 7 + row);
        if (day > today) continue;
        var kk = dateKeyLocal(day);
        var v = map[kk] || 0;
        if (v > maxV) maxV = v;
      }
    }
    if (maxV < 1) maxV = 1;
    var html = ['<div class="activity-heatmap__grid" role="img" aria-label="Son 28 hafta günlük aktivite">'];
    for (row = 0; row < 7; row++) {
      for (col = 0; col < cols; col++) {
        var day2 = new Date(startMonday);
        day2.setDate(startMonday.getDate() + col * 7 + row);
        if (day2 > today) {
          html.push('<span class="activity-heatmap__cell activity-heatmap__cell--future" aria-hidden="true"></span>');
          continue;
        }
        var k2 = dateKeyLocal(day2);
        var vv = map[k2] || 0;
        var level = 0;
        if (vv > 0) {
          level = Math.min(4, Math.ceil((vv / maxV) * 4));
        }
        var title = k2 + ": " + (vv > 0 ? vv + " dk" : "boş");
        html.push(
          '<span class="activity-heatmap__cell activity-heatmap__cell--lv' +
            level +
            '" title="' +
            escapeHtml(title) +
            '"></span>'
        );
      }
    }
    html.push("</div>");
    html.push(
      '<p class="activity-heatmap__legend"><span class="activity-heatmap__hint">Düşük</span><span class="activity-heatmap__scale"></span><span class="activity-heatmap__hint">Yüksek</span></p>'
    );
    root.innerHTML = html.join("");
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

  /** Gün içinde dakika > 0 ise seriye sayılır (YDS, teknik vb.). */
  function streakDayHasAnyMinutes(minutesMap, key) {
    return (minutesMap[key] || 0) > 0;
  }

  function computeCurrentStreakConsecutive(minutesMap, isActiveFn) {
    if (!isActiveFn) {
      isActiveFn = function (k) {
        return streakDayHasAnyMinutes(minutesMap, k);
      };
    }
    var now = new Date();
    var todayKey = dateKeyLocal(now);
    var y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    var yesterdayKey = dateKeyLocal(y);

    var activeToday = isActiveFn(todayKey);
    var activeYesterday = isActiveFn(yesterdayKey);
    if (!activeToday && !activeYesterday) return 0;

    var start = activeToday ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : y;
    var count = 0;
    var cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (true) {
      var k = dateKeyLocal(cursor);
      if (isActiveFn(k)) {
        count += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }
    return count;
  }

  function computeLongestStreakConsecutive(minutesMap, isActiveFn) {
    if (!isActiveFn) {
      isActiveFn = function (k) {
        return streakDayHasAnyMinutes(minutesMap, k);
      };
    }
    var keys = Object.keys(minutesMap).filter(function (k) {
      return isActiveFn(k);
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

  /** YDS: gün içinde herhangi bir YDS dakikası (>0) varsa o gün seriye sayılır; üst üste boş gün olmamalı. */
  function ydsStreakDayActive(minutesMap, key) {
    return streakDayHasAnyMinutes(minutesMap, key);
  }

  function computeCurrentStreakYds(minutesMap) {
    return computeCurrentStreakConsecutive(minutesMap);
  }

  function computeLongestStreakYds(minutesMap) {
    return computeLongestStreakConsecutive(minutesMap);
  }

  function computeCurrentStreakTechnical(minutesMap) {
    return computeCurrentStreakConsecutive(minutesMap);
  }

  function computeLongestStreakTechnical(minutesMap) {
    return computeLongestStreakConsecutive(minutesMap);
  }

  function uid() {
    return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
  }

  function normalizeNoteItem(n) {
    if (!n || typeof n !== "object") return null;
    var body = typeof n.body === "string" ? n.body : "";
    var nid = typeof n.id === "string" && n.id.trim() ? n.id.trim() : uid();
    var createdAt = typeof n.createdAt === "string" ? n.createdAt : new Date().toISOString();
    return { id: nid, body: body, createdAt: createdAt };
  }

  function normalizeNoteCategory(cat) {
    if (!cat || typeof cat !== "object") return null;
    var cid = typeof cat.id === "string" && cat.id.trim() ? cat.id.trim() : uid();
    var title = typeof cat.title === "string" ? cat.title.trim() : "";
    if (!title) title = "Adsız";
    var notes = [];
    if (Array.isArray(cat.notes)) {
      var ni;
      for (ni = 0; ni < cat.notes.length; ni++) {
        var item = normalizeNoteItem(cat.notes[ni]);
        if (item) notes.push(item);
      }
    }
    return { id: cid, title: title, notes: notes };
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

  function sessionPagesRead(s) {
    if (!s) return 0;
    return parseNonNegInt(s.pagesRead);
  }

  /** Dakika: hem 12,5 hem 12.5 kabul eder; en fazla 1440, iki ondalık. */
  function parseNonNegMinutes(val) {
    if (val == null) return 0;
    var s = String(val).trim();
    if (s === "") return 0;
    s = s.replace(",", ".");
    var n = parseFloat(s);
    if (isNaN(n) || n < 0) return 0;
    if (n > 1440) n = 1440;
    return Math.round(n * 100) / 100;
  }

  function formatMinutesForDisplay(m) {
    var n = Number(m);
    if (isNaN(n)) return "0";
    var r = Math.round(n * 100) / 100;
    if (Math.abs(r - Math.round(r)) < 1e-6) return String(Math.round(r));
    return String(r).replace(".", ",");
  }

  /** Dakikayı grafik/tooltip için okunabilir saat metnine çevirir. */
  function formatMinutesAsHours(m) {
    var n = Number(m);
    if (isNaN(n) || n <= 0) return "0 dk";
    if (n < 60) return formatMinutesForDisplay(n) + " dk";
    var h = Math.floor(n / 60);
    var rem = Math.round(n % 60);
    if (rem === 0) return h + " sa";
    return h + " sa " + rem + " dk";
  }

  /** Y ekseni tikleri — veri dakika, gösterim saat. */
  function formatHoursAxisTick(minutes) {
    var n = Number(minutes);
    if (isNaN(n) || n === 0) return "0";
    if (n < 60) return formatMinutesForDisplay(n) + " dk";
    var h = n / 60;
    if (Math.abs(h - Math.round(h)) < 0.08) return Math.round(h) + " sa";
    return (Math.round(h * 10) / 10).toString().replace(".", ",") + " sa";
  }

  /** Grafik üzeri etiketler için kısa süre metni (45dk, 2sa, 2sa30). */
  function formatMinutesChartLabel(m) {
    var n = Number(m);
    if (isNaN(n) || n <= 0) return "";
    if (n < 60) return Math.round(n) + "dk";
    var h = Math.floor(n / 60);
    var rem = Math.round(n % 60);
    if (rem === 0) return h + "sa";
    if (rem < 8) return h + "sa";
    return h + "sa" + rem;
  }

  /** Grafik üzeri soluk süre etiketi — arka plansız, küçük punt. */
  function dashDrawSubtleLabel(ctx, text, x, y, opts) {
    if (!text) return;
    opts = opts || {};
    var dark = isDarkTheme();
    ctx.font = opts.font || "500 9px 'DM Sans', system-ui, sans-serif";
    ctx.fillStyle =
      opts.color ||
      (dark ? "rgba(148, 163, 184, 0.65)" : "rgba(100, 116, 139, 0.62)");
    ctx.textAlign = "center";
    ctx.textBaseline = opts.baseline || "bottom";
    ctx.fillText(text, x, y);
  }

  /** Halka grafik verisi — çalışma dakikası ve yatırım işlem sayısı ayrı. */
  function dashDoughnutTotals(arr, lbls) {
    var sumMin = 0;
    var invCount = 0;
    var ti;
    for (ti = 0; ti < arr.length; ti++) {
      if ((lbls[ti] || "") === "Yatırım") invCount += arr[ti] || 0;
      else sumMin += arr[ti] || 0;
    }
    return { sumMin: sumMin, invCount: invCount };
  }

  function dashDoughnutValueLabel(label, value) {
    if (label === "Yatırım") return value + " işl";
    return formatMinutesChartLabel(value);
  }

  /** Yığılmış çubuk — sütun üstünde soluk toplam. */
  function dashStackedTotalLabelsPlugin() {
    return {
      id: "dashStackedTotalLabels",
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        var datasets = chart.data.datasets;
        var lblCount = (chart.data.labels && chart.data.labels.length) || 0;
        var area = chart.chartArea;
        if (!datasets || !lblCount || !area) return;
        ctx.save();
        var xi;
        for (xi = 0; xi < lblCount; xi++) {
          var sumMin = 0;
          var invCount = 0;
          var topY = null;
          var centerX = null;
          var stackH = 0;
          var di;
          for (di = 0; di < datasets.length; di++) {
            var meta = chart.getDatasetMeta(di);
            if (meta.hidden) continue;
            var val = datasets[di].data[xi] || 0;
            var dsLabel = datasets[di].label || "";
            if (dsLabel === "Yatırım") invCount += val;
            else sumMin += val;
            if (val > 0 && meta.data[xi]) {
              var props = meta.data[xi].getProps(["x", "y", "base"], true);
              centerX = props.x;
              if (topY === null || props.y < topY) topY = props.y;
              stackH = Math.max(stackH, Math.abs(props.base - props.y));
            }
          }
          if (topY === null || (sumMin <= 0 && invCount <= 0)) continue;
          if (stackH < 18 || topY < area.top + 12) continue;
          var txt = sumMin > 0 ? formatMinutesChartLabel(sumMin) : "";
          if (invCount > 0) txt += (txt ? " · " : "") + invCount + " işl";
          dashDrawSubtleLabel(ctx, txt, centerX, topY - 2);
        }
        ctx.restore();
      },
    };
  }

  /** Gruplu çubuk — çubuk üstünde soluk süre. */
  function dashGroupedBarLabelsPlugin() {
    return {
      id: "dashGroupedBarLabels",
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        var datasets = chart.data.datasets;
        var catLabels = chart.data.labels || [];
        var area = chart.chartArea;
        if (!datasets || !area) return;
        ctx.save();
        datasets.forEach(function (ds, di) {
          var meta = chart.getDatasetMeta(di);
          if (meta.hidden) return;
          meta.data.forEach(function (bar, xi) {
            var val = ds.data[xi];
            if (!val || val <= 0) return;
            var props = bar.getProps(["x", "y", "base"], true);
            var barH = Math.abs(props.base - props.y);
            if (barH < 18 || props.y < area.top + 12) return;
            var cat = catLabels[xi] || "";
            var text = cat === "Yatırım" ? val + " işl" : formatMinutesChartLabel(val);
            dashDrawSubtleLabel(ctx, text, props.x, props.y - 2);
          });
        });
        ctx.restore();
      },
    };
  }

  var enSubtypeLabels = {
    calisma: "Çalışma",
    grammar: "Grammar",
    cloze: "Cloze",
    tr_eng: "TR→EN",
    eng_tr: "EN→TR",
    passage: "Passage",
    listening: "Listening",
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
    if (s.enGrammarMinutes != null && s.enGrammarMinutes > 0) parts.push("Gr " + formatMinutesForDisplay(s.enGrammarMinutes) + " dk");
    if (s.enKelimeEzberMinutes != null && s.enKelimeEzberMinutes > 0) parts.push("Ezber " + formatMinutesForDisplay(s.enKelimeEzberMinutes) + " dk");
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

  function flushPendingSave() {
    if (_serverSaveTimer) {
      clearTimeout(_serverSaveTimer);
      _serverSaveTimer = null;
      pushStateToServer(state);
    }
    persistStateLocal(state);
  }

  function downloadJsonBackup(filename) {
    if (typeof filename !== "string" || !filename) filename = "calisma-takip-yedek.json";
    flushPendingSave();
    var snap = loadState();
    var blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function pad2auto(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function localYmdAuto(d) {
    return d.getFullYear() + "-" + pad2auto(d.getMonth() + 1) + "-" + pad2auto(d.getDate());
  }

  function getAutoExportSettings() {
    try {
      if (localStorage.getItem("calisma_auto_export_enabled") === "0") return null;
      var t = localStorage.getItem("calisma_auto_export_time") || "23:58";
      var parts = String(t).split(":");
      var h = parseInt(parts[0], 10);
      var mi = parseInt(parts[1], 10);
      if (isNaN(h)) h = 23;
      if (isNaN(mi)) mi = 58;
      h = Math.min(23, Math.max(0, h));
      mi = Math.min(59, Math.max(0, mi));
      return { hour: h, minute: mi };
    } catch (e) {
      return { hour: 23, minute: 58 };
    }
  }

  function runAutoExportIfDue() {
    var settings = getAutoExportSettings();
    if (!settings) return;
    var now = new Date();
    var ymd = localYmdAuto(now);
    if (localStorage.getItem("calisma_auto_export_done_date") === ymd) return;
    var minutesNow = now.getHours() * 60 + now.getMinutes();
    var minutesTarget = settings.hour * 60 + settings.minute;
    if (minutesNow < minutesTarget) return;
    try {
      downloadJsonBackup("calisma-takip-yedek-" + ymd + "-otomatik.json");
      localStorage.setItem("calisma_auto_export_done_date", ymd);
    } catch (e) {}
  }

  function initAutoExportScheduler() {
    if (typeof localStorage === "undefined") return;
    runAutoExportIfDue();
    setInterval(runAutoExportIfDue, 60000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") runAutoExportIfDue();
    });
  }

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
  var ydsSubtypeChart = null;
  var ydsProgressChart = null;
  var teknikTrendChart = null;
  var teknikWeekdayChart = null;
  var teknikTopicChart = null;

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
      recordDate: q("record-date"),
      recordTime: q("record-time"),
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
      enCalismaMin: q("en-calisma-min"),
      enQGrammar: q("en-q-grammar"),
      enQCloze: q("en-q-cloze"),
      enQTrEng: q("en-q-tr-eng"),
      enQEngTr: q("en-q-eng-tr"),
      enQPassage: q("en-q-passage"),
      enListeningMin: q("en-listening-min"),
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
      gecmisRecordsCount: q("gecmis-records-count"),
      btnExport: q("btn-export"),
      importFile: q("import-file"),
    };
  } else if (page === "kitaplar" || page === "yatirim" || page === "yds" || page === "notlarim" || page === "teknik") {
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
    } else if (cat === "investment" && el.wrapInvest) {
      el.wrapInvest.classList.remove("form-block--hidden");
      populateInvestAssetSuggestions();
    }
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

  /** Yeni kayıt: yatırım varlık alanı için önceki kayıtlardan öneriler (datalist). */
  function populateInvestAssetSuggestions() {
    var dl = document.getElementById("invest-asset-suggestions");
    if (!dl) return;
    state = loadState();
    var seen = {};
    state.sessions.forEach(function (s) {
      if (s.category !== "investment") return;
      var raw = s.assetName && String(s.assetName).trim();
      if (!raw) return;
      if (raw.toLocaleLowerCase("tr") === "kayıt") return;
      var k = raw.toLocaleLowerCase("tr");
      if (!(k in seen)) seen[k] = raw;
    });
    dl.innerHTML = "";
    var names = Object.keys(seen).map(function (k) {
      return seen[k];
    });
    names.sort(function (a, b) {
      return a.localeCompare(b, "tr");
    });
    var i;
    for (i = 0; i < names.length; i++) {
      var opt = document.createElement("option");
      opt.value = names[i];
      dl.appendChild(opt);
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

  /** Bu hafta (takvim haftası) yatırım: net imzalı tutar toplamı ve hacim (mutlak). */
  function weeklyInvestmentTlStats() {
    var net = 0;
    var vol = 0;
    state.sessions.forEach(function (s) {
      if (s.category !== "investment" || !isInCurrentWeek(sessionEffectiveTime(s))) return;
      net += investmentSignedAmount(s);
      vol += investmentVolumeAmount(s);
    });
    return { net: net, vol: vol };
  }

  /** Geçmiş grafikleri: yatırımın süresi yok; işlem başına 1 birim (görünürlük için). */
  function sessionChartWeight(s) {
    if (!s) return 0;
    if (s.category === "investment") return 1;
    return s.durationMinutes || 0;
  }

  function weeklyChartWeights() {
    var en = 0;
    var tech = 0;
    var book = 0;
    var inv = 0;
    state.sessions.forEach(function (s) {
      if (!isInCurrentWeek(sessionEffectiveTime(s))) return;
      var w = sessionChartWeight(s);
      if (s.category === "english") en += w;
      else if (s.category === "technical") tech += w;
      else if (s.category === "book") book += w;
      else if (s.category === "investment") inv += w;
    });
    return { en: en, tech: tech, book: book, inv: inv, total: en + tech + book + inv };
  }

  function dayCategoryMapsForCharts() {
    var en = {};
    var tech = {};
    var book = {};
    var inv = {};
    state.sessions.forEach(function (s) {
      var iso = sessionEffectiveTime(s);
      if (!iso) return;
      var k = dateKeyLocal(new Date(iso));
      var w = sessionChartWeight(s);
      if (s.category === "english") en[k] = (en[k] || 0) + w;
      else if (s.category === "technical") tech[k] = (tech[k] || 0) + w;
      else if (s.category === "book") book[k] = (book[k] || 0) + w;
      else if (s.category === "investment") inv[k] = (inv[k] || 0) + w;
    });
    return { en: en, tech: tech, book: book, inv: inv };
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
      if (totalPages != null && totalPages >= 1 && !found.totalPages) found.totalPages = totalPages;
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
      if (s.category === "book" && s.bookId === bookId) sum += sessionPagesRead(s);
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
      el.statWeekTotal.textContent = formatMinutesForDisplay(w.total) + su;
      el.statWeekEn.textContent = formatMinutesForDisplay(w.en) + su;
      el.statWeekTech.textContent = formatMinutesForDisplay(w.tech) + su;
      if (el.statWeekBook) el.statWeekBook.textContent = formatMinutesForDisplay(w.book) + su;
      var invTl = weeklyInvestmentTlStats();
      if (el.statWeekInv) el.statWeekInv.textContent = formatMoneyTR(invTl.net);

      var maxBar = Math.max(w.en, w.tech, w.book, invTl.vol, 1);
      el.barEn.style.width = Math.round((w.en / maxBar) * 100) + "%";
      el.barTech.style.width = Math.round((w.tech / maxBar) * 100) + "%";
      if (el.barBook) el.barBook.style.width = Math.round((w.book / maxBar) * 100) + "%";
      if (el.barInv) el.barInv.style.width = Math.round((invTl.vol / maxBar) * 100) + "%";

      renderStreak();
    }
    renderDashboardIndexCharts();
    renderDashboardHeatmap();
    renderDashboardCharts();
  }

  function renderStreak() {
    var curEl = document.getElementById("streak-current");
    var bestEl = document.getElementById("streak-best");
    if (!curEl) return;
    var maps = dayCategoryMapsByEffectiveDate();
    var minutesMap = maps.en || {};
    var current = computeCurrentStreakYds(minutesMap);
    var longest = computeLongestStreakYds(minutesMap);

    curEl.textContent = String(current);
    if (bestEl) bestEl.textContent = longest + " gün";
  }

  function formatSessionDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
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

  function formatBookTimelineWhen(iso) {
    if (!iso) return { date: "—", time: "" };
    var d = new Date(iso);
    if (isNaN(d.getTime())) return { date: "—", time: "" };
    return {
      date: d.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      time: d.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }

  function renderBookTimelineSessionHtml(s) {
    var when = formatBookTimelineWhen(s.createdAt);
    var pages = sessionPagesRead(s) || 0;
    var chips =
      '<span class="book-timeline__chip book-timeline__chip--pages">' +
      pages +
      " syf</span>" +
      '<span class="book-timeline__chip book-timeline__chip--mins">' +
      formatMinutesForDisplay(s.durationMinutes || 0) +
      " dk</span>";
    if (s.finishedBook) {
      chips +=
        '<span class="book-timeline__chip book-timeline__chip--done">Kitabı bitirdi</span>';
    }
    return (
      '<li class="book-timeline__item">' +
      '<div class="book-timeline__rail" aria-hidden="true"><span class="book-timeline__dot"></span></div>' +
      '<article class="book-timeline__card">' +
      '<div class="book-timeline__head">' +
      '<time class="book-timeline__when" datetime="' +
      escapeHtml(String(s.createdAt || "")) +
      '">' +
      '<span class="book-timeline__date">' +
      escapeHtml(when.date) +
      "</span>" +
      (when.time
        ? '<span class="book-timeline__time">' + escapeHtml(when.time) + "</span>"
        : "") +
      "</time>" +
      '<div class="book-timeline__stats">' +
      chips +
      "</div>" +
      "</div>" +
      (s.note
        ? '<p class="book-timeline__note">' + escapeHtml(String(s.note)) + "</p>"
        : "") +
      "</article></li>"
    );
  }

  function bookBlockProgressHtml(meta, totalP) {
    if (!meta || meta.totalPages == null || isNaN(meta.totalPages) || meta.totalPages <= 0) {
      return "";
    }
    var pct = Math.min(100, Math.round((totalP / meta.totalPages) * 100));
    return (
      '<div class="book-block__progress" role="progressbar" aria-valuenow="' +
      pct +
      '" aria-valuemin="0" aria-valuemax="100" aria-label="Okuma ilerlemesi">' +
      '<div class="book-block__progress-bar" style="width:' +
      pct +
      '%"></div></div>'
    );
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
    var cat = String(s.category || "").trim();
    if (cat === "investment" && s.transactionAt) {
      var d = new Date(s.transactionAt);
      if (!isNaN(d.getTime())) return s.transactionAt;
    }
    return s.createdAt;
  }

  function applyBookTotalPagesIfProvided(bookId, rawValue) {
    if (!bookId) return;
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") return;
    var n = parseInt(String(rawValue).trim(), 10);
    if (isNaN(n) || n < 1) return;
    state.books.forEach(function (b) {
      if (b.id === bookId) b.totalPages = n;
    });
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

  function getGecmisFilter() {
    var active = document.querySelector(".gecmis-cat-tab--active");
    if (!active) return "";
    return active.getAttribute("data-gecmis-filter") || "";
  }

  function gecmisCatModifier(cat) {
    if (cat === "english") return "en";
    if (cat === "technical") return "tech";
    if (cat === "book") return "book";
    if (cat === "investment") return "inv";
    return "misc";
  }

  function gecmisSessionMetaParts(s, cat) {
    var metaParts = [];
    if (cat === "english") {
      var enMeta = formatEnglishSessionMeta(s);
      if (enMeta) metaParts.push(enMeta);
    }
    if (cat === "technical" && s.techTopic) {
      metaParts.push(s.techTopic);
    }
    if (cat === "book") {
      if (s.bookTitle) metaParts.push(s.bookTitle);
      if (s.pagesRead != null) metaParts.push(sessionPagesRead(s) + " syf");
    }
    if (cat === "investment") {
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
    if (cat === "investment" && !metaParts.length) metaParts.push("Yatırım kaydı");
    return metaParts;
  }

  function renderGecmisSessionItemHtml(s) {
    var cat = String(s.category || "").trim();
    var mod = gecmisCatModifier(cat);
    var when = formatBookTimelineWhen(sessionEffectiveTime(s));
    var badgeText = categoryLabels[cat] || cat;
    var metaParts = gecmisSessionMetaParts(s, cat);
    var durationChip =
      cat === "investment"
        ? '<span class="session-item__chip session-item__chip--muted">İşlem</span>'
        : '<span class="session-item__chip session-item__chip--duration">' +
          formatMinutesForDisplay(s.durationMinutes || 0) +
          " dk</span>";
    return (
      '<li class="session-item session-item--card session-item--' +
      mod +
      '" data-id="' +
      escapeHtml(s.id) +
      '">' +
      '<div class="session-item__rail" aria-hidden="true"><span class="session-item__dot"></span></div>' +
      '<article class="session-item__card">' +
      '<div class="session-item__head">' +
      '<time class="session-item__when" datetime="' +
      escapeHtml(String(sessionEffectiveTime(s) || "")) +
      '">' +
      '<span class="session-item__date">' +
      escapeHtml(when.date) +
      "</span>" +
      (when.time ? '<span class="session-item__time">' + escapeHtml(when.time) + "</span>" : "") +
      "</time>" +
      '<span class="session-item__badge session-item__badge--' +
      mod +
      '">' +
      escapeHtml(badgeText) +
      "</span>" +
      "</div>" +
      '<div class="session-item__stats">' +
      durationChip +
      "</div>" +
      (metaParts.length
        ? '<div class="session-item__meta">' + escapeHtml(metaParts.join(" · ")) + "</div>"
        : "") +
      (s.note ? '<p class="session-item__note">' + escapeHtml(String(s.note)) + "</p>" : "") +
      '<div class="session-item__actions">' +
      '<button type="button" class="session-item__del" data-session-delete="' +
      escapeHtml(s.id) +
      '">Sil</button>' +
      "</div>" +
      "</article></li>"
    );
  }

  function renderList() {
    if (!el.sessionList) return;
    state = loadState();
    var filter = getGecmisFilter();
    var list = state.sessions.slice().sort(function (a, b) {
      var ta = new Date(sessionEffectiveTime(a)).getTime();
      var tb = new Date(sessionEffectiveTime(b)).getTime();
      if (isNaN(tb) && isNaN(ta)) return 0;
      if (isNaN(tb)) return -1;
      if (isNaN(ta)) return 1;
      return tb - ta;
    });
    if (filter) {
      list = list.filter(function (s) {
        return String(s.category || "").trim() === filter;
      });
    }

    if (el.gecmisRecordsCount) {
      el.gecmisRecordsCount.textContent = String(list.length);
    }

    if (list.length === 0) {
      el.sessionList.innerHTML = "";
      el.emptyMsg.classList.add("is-visible");
      return;
    }
    el.emptyMsg.classList.remove("is-visible");
    el.sessionList.innerHTML = list.map(renderGecmisSessionItemHtml).join("");
  }

  function bindGecmisSessionDeletes() {
    var listRoot = el.sessionList;
    if (!listRoot || listRoot.dataset.deleteBound) return;
    listRoot.dataset.deleteBound = "1";
    listRoot.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-session-delete]");
      if (!btn) return;
      var sid = btn.getAttribute("data-session-delete");
      if (sid) deleteSession(sid);
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
    populateBookFieldsFromSelect();
  }

  function populateBookFieldsFromSelect() {
    if (!el.bookSelect) return;
    populateBookDateInputs();
  }

  function populateBookDateInputs() {
    if (!el.bookDateStart || !el.bookDateEnd || !el.bookSelect) return;
    var bid = el.bookSelect.value;
    if (bid === "new") {
      el.bookDateStart.value = "";
      el.bookDateEnd.value = "";
      if (el.bookTotalPages) el.bookTotalPages.value = "";
      return;
    }
    var bf = null;
    state.books.forEach(function (b) {
      if (b.id === bid) bf = b;
    });
    if (bf) {
      el.bookDateStart.value = isoToDateInputValue(bf.startedAt);
      el.bookDateEnd.value = isoToDateInputValue(bf.finishedAt);
      if (el.bookTotalPages) {
        el.bookTotalPages.value = bf.totalPages != null && !isNaN(bf.totalPages) ? String(bf.totalPages) : "";
      }
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
        pages += sessionPagesRead(s);
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

    function formatDaysEquivalent(minutes) {
      var days = minutes / 1440;
      if (days <= 0) return "0 gün";
      var rounded = Math.round(days * 10) / 10;
      var str = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1).replace(".", ",");
      return str + " gün";
    }

    function statCard(periodClass, kindLine, whenLine, d, showDaysEq) {
      var aria = kindLine + ": " + whenLine;
      var al = escapeHtml(aria);
      var daysMetric = showDaysEq
        ? '<div class="kitaplar-stat-metric"><dt>≈ Gün (24 sa)</dt><dd>' +
          formatDaysEquivalent(d.minutes) +
          "</dd></div>"
        : "";
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
        daysMetric +
        '<div class="kitaplar-stat-metric"><dt>Kitap</dt><dd>' +
        d.bookCount +
        "</dd></div>" +
        "</dl></article>"
      );
    }

    grid.innerHTML =
      statCard("week", "Hafta", weekWhen, w, false) +
      statCard("month", "Ay", monthWhen, mo, false) +
      statCard("year", "Yıl", yearWhen, y, true);
  }

  function bookSessionsTabPanelHtml(sessionCount, rowsHtml) {
    return (
      '<details class="book-block__sessions-tabpanel records-collapsible">' +
      '<summary class="book-block__sessions-tab records-collapsible__summary">' +
      '<span class="book-block__sessions-tab-label">Okuma oturumları</span>' +
      '<span class="book-block__sessions-tab-count">' +
      sessionCount +
      "</span>" +
      '<span class="records-collapsible__chev" aria-hidden="true"></span>' +
      "</summary>" +
      '<div class="book-block__sessions-body">' +
      '<ul class="book-timeline book-timeline--rail">' +
      rowsHtml +
      "</ul></div></details>"
    );
  }

  function bindRecordsCollapsible(el, storageKey) {
    if (!el || el.dataset.collapsibleBound) return;
    el.dataset.collapsibleBound = "1";
    if (storageKey && sessionStorage.getItem(storageKey) === "1") {
      el.open = true;
    }
    if (!storageKey) return;
    el.addEventListener("toggle", function () {
      sessionStorage.setItem(storageKey, el.open ? "1" : "0");
    });
  }

  function renderKitaplarBookBlockHtml(bid, ids) {
    var title = ids[bid];
    var meta = state.books.filter(function (b) {
      return b.id === bid;
    })[0];
    var subs = bookSessionsForId(bid).slice().reverse();
    if (subs.length === 0) {
      return (
        '<div class="book-block book-block--card" data-book-id="' +
        escapeHtml(bid) +
        '"><h3 class="book-block__title">' +
        escapeHtml(title) +
        '</h3><p class="table-muted">Oturum yok.</p></div>'
      );
    }
    var totalP = sumPagesForBook(bid);
    var totalM = sumMinutesForBook(bid);
    var pagesSummary =
      meta && meta.totalPages != null && !isNaN(meta.totalPages) && meta.totalPages > 0
        ? totalP + " / " + meta.totalPages + " syf"
        : totalP + " syf";
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
    var sessionCountLabel = subs.length + " oturum";
    var summaryChips =
      '<div class="book-block__chips">' +
      '<span class="book-block__chip">' +
      sessionCountLabel +
      "</span>" +
      '<span class="book-block__chip book-block__chip--pages">' +
      pagesSummary +
      "</span>" +
      '<span class="book-block__chip book-block__chip--mins">' +
      totalM +
      " dk</span>" +
      '<span class="book-block__chip book-block__chip--range">' +
      dateRangeLine +
      "</span>" +
      "</div>" +
      bookBlockProgressHtml(meta, totalP);
    var sessionsPanel = bookSessionsTabPanelHtml(
      subs.length,
      subs.map(renderBookTimelineSessionHtml).join("")
    );
    if (meta) {
      return (
        '<div class="book-block book-block--card" data-book-id="' +
        escapeHtml(bid) +
        '">' +
        '<div class="book-block__record">' +
        '<div class="book-block__record-main">' +
        '<div class="book-block__record-title">' +
        escapeHtml(meta.title) +
        "</div>" +
        (meta.author
          ? '<div class="book-block__record-meta book-block__record-meta--author">' +
            escapeHtml(meta.author) +
            "</div>"
          : "") +
        summaryChips +
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
        sessionsPanel +
        "</div>"
      );
    }
    return (
      '<div class="book-block book-block--card" data-book-id="' +
      escapeHtml(bid) +
      '"><h3 class="book-block__title">' +
      escapeHtml(title) +
      "</h3>" +
      summaryChips +
      datesEdit +
      sessionsPanel +
      "</div>"
    );
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

    var finishedIds = {};
    state.books.forEach(function (b) {
      if (b.finishedAt) finishedIds[b.id] = true;
    });

    var ids = {};
    state.books.forEach(function (b) {
      if (finishedIds[b.id]) return;
      ids[b.id] = b.title;
    });
    state.sessions.forEach(function (s) {
      if (s.category === "book" && s.bookId && !finishedIds[s.bookId]) {
        ids[s.bookId] = ids[s.bookId] || s.bookTitle || "Kitap";
      }
    });

    var bookIdList = Object.keys(ids);
    if (bookIdList.length === 0) {
      timelineEl.innerHTML =
        '<p class="kitaplar-timeline-empty">Okunmakta olan kitap yok. Bitirilen kitaplar yukarıdaki tabloda listelenir.</p>';
      return;
    }

    bookIdList.sort(function (a, b) {
      var sa = bookSessionsForId(a);
      var sb = bookSessionsForId(b);
      var ta = sa.length ? new Date(sa[sa.length - 1].createdAt).getTime() : 0;
      var tb = sb.length ? new Date(sb[sb.length - 1].createdAt).getTime() : 0;
      return tb - ta;
    });

    timelineEl.innerHTML = bookIdList
      .map(function (bid) {
        return renderKitaplarBookBlockHtml(bid, ids);
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
    var inv = state.sessions.filter(function (s) {
      return s.category === "investment";
    });
    if (pr.mode === "week") {
      var probeWeek = inv.filter(function (s) {
        return sessionInRange(sessionEffectiveTime(s), pr.start, pr.end);
      });
      if (probeWeek.length === 0) {
        var nowW = new Date();
        var wsNow = startOfWeekMonday(nowW);
        var weNow = new Date(wsNow);
        weNow.setDate(weNow.getDate() + 7);
        var hasInvestmentThisCalendarWeek = inv.some(function (s) {
          return sessionInRange(sessionEffectiveTime(s), wsNow, weNow);
        });
        if (hasInvestmentThisCalendarWeek) {
          setYatirimWeekRefToLocalToday();
          pr = getYatirimPeriodRange();
        }
      }
    }
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

    var countEl = document.getElementById("yatirim-records-count");
    if (countEl) countEl.textContent = String(all.length);

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
    if (page === "teknik") renderTeknikPage();
  }

  function destroyTeknikCharts() {
    if (typeof Chart === "undefined") return;
    if (teknikTrendChart) {
      teknikTrendChart.destroy();
      teknikTrendChart = null;
    }
    if (teknikWeekdayChart) {
      teknikWeekdayChart.destroy();
      teknikWeekdayChart = null;
    }
    if (teknikTopicChart) {
      teknikTopicChart.destroy();
      teknikTopicChart = null;
    }
  }

  function weeklyTechnicalMinutes() {
    return weeklyTechnicalStats().minutes;
  }

  function weeklyTechnicalStats() {
    var sessions = 0;
    var minutes = 0;
    state.sessions.forEach(function (s) {
      if (String(s.category || "").trim() !== "technical") return;
      var iso = sessionEffectiveTime(s);
      if (!iso || !isInCurrentWeek(iso)) return;
      sessions++;
      minutes += s.durationMinutes || 0;
    });
    return {
      sessions: sessions,
      minutes: minutes,
    };
  }

  function technicalDailySeries(days) {
    var labels = [];
    var minutes = [];
    var counts = [];
    var t;
    for (t = days - 1; t >= 0; t--) {
      var dt = new Date();
      dt.setHours(0, 0, 0, 0);
      dt.setDate(dt.getDate() - t);
      var dk = dateKeyLocal(dt);
      labels.push(dt.getDate() + " " + MONTH_SHORT_TR[dt.getMonth()]);
      var dm = 0;
      var cnt = 0;
      state.sessions.forEach(function (s) {
        if (String(s.category || "").trim() !== "technical") return;
        var iso = sessionEffectiveTime(s);
        if (!iso) return;
        if (dateKeyLocal(new Date(iso)) !== dk) return;
        cnt++;
        dm += s.durationMinutes || 0;
      });
      minutes.push(dm);
      counts.push(cnt);
    }
    return { labels: labels, minutes: minutes, counts: counts };
  }

  var teknikWeekdayPeriod = "year";

  function teknikDistributionData(period) {
    var now = new Date();
    var labels = [];
    var data = [];
    var fullLabels = [];
    var start;
    var end;
    var idxOf;

    if (period === "week") {
      labels = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
      fullLabels = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
      data = [0, 0, 0, 0, 0, 0, 0];
      start = startOfWeekMonday(now);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      idxOf = function (d) {
        return (d.getDay() + 6) % 7;
      };
    } else if (period === "month") {
      var daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      var di;
      for (di = 1; di <= daysInMonth; di++) {
        labels.push(String(di));
        fullLabels.push(di + " " + MONTH_NAMES_TR[now.getMonth()]);
        data.push(0);
      }
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      idxOf = function (d) {
        return d.getDate() - 1;
      };
    } else {
      var mi;
      for (mi = 0; mi < 12; mi++) {
        labels.push(MONTH_SHORT_TR[mi]);
        fullLabels.push(MONTH_NAMES_TR[mi] + " " + now.getFullYear());
        data.push(0);
      }
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      idxOf = function (d) {
        return d.getMonth();
      };
    }

    state.sessions.forEach(function (s) {
      if (String(s.category || "").trim() !== "technical") return;
      var iso = sessionEffectiveTime(s);
      if (!iso) return;
      var d = new Date(iso);
      if (isNaN(d.getTime()) || d < start || d >= end) return;
      var idx = idxOf(d);
      if (idx >= 0 && idx < data.length) data[idx] += s.durationMinutes || 0;
    });

    return { labels: labels, fullLabels: fullLabels, data: data };
  }

  function renderTeknikWeekdayChart(period) {
    var canvasWeekday = document.getElementById("teknik-chart-weekday");
    if (!canvasWeekday || typeof Chart === "undefined") return;
    var emptyWeekday = document.getElementById("teknik-chart-weekday-empty");
    var wrapWeekday = document.getElementById("teknik-chart-weekday-wrap");
    var subEl = document.getElementById("teknik-weekday-sub");

    if (teknikWeekdayChart) {
      teknikWeekdayChart.destroy();
      teknikWeekdayChart = null;
    }

    var subMap = {
      week: "Bu hafta — günlere göre",
      month: "Bu ay — günlere göre",
      year: "Bu yıl — aylara göre",
    };
    if (subEl) subEl.textContent = subMap[period] || subMap.year;

    var dist = teknikDistributionData(period);
    var dataArr = dist.data;
    var weekdaySum = 0;
    var wi;
    for (wi = 0; wi < dataArr.length; wi++) weekdaySum += dataArr[wi];

    if (weekdaySum <= 0) {
      if (emptyWeekday) {
        emptyWeekday.hidden = false;
        var msgMap = { week: "Bu hafta teknik kayıt yok.", month: "Bu ay teknik kayıt yok.", year: "Bu yıl teknik kayıt yok." };
        emptyWeekday.textContent = msgMap[period] || "Teknik kayıt yok.";
      }
      if (wrapWeekday) wrapWeekday.hidden = true;
      return;
    }
    if (emptyWeekday) emptyWeekday.hidden = true;
    if (wrapWeekday) wrapWeekday.hidden = false;

    teknikWeekdayChart = new Chart(canvasWeekday, {
      type: "bar",
      data: {
        labels: dist.labels,
        datasets: [
          {
            label: "Süre",
            data: dataArr,
            fullLabels: dist.fullLabels,
            backgroundColor: "rgba(138, 122, 214, 0.55)",
            hoverBackgroundColor: "rgba(138, 122, 214, 0.78)",
            borderColor: "#9aa0f5",
            borderWidth: 1,
            borderRadius: 6,
            maxBarThickness: period === "month" ? 18 : 38,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            title: { display: true, text: "Dakika" },
            ticks: {
              callback: function (v) {
                return v + " dk";
              },
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function (items) {
                if (!items || !items.length) return "";
                var ds = items[0].dataset || {};
                var fl = ds.fullLabels || [];
                return fl[items[0].dataIndex] || items[0].label || "";
              },
              label: function (ctx) {
                var v = ctx.parsed.y != null ? ctx.parsed.y : 0;
                return "Toplam: " + v + " dk";
              },
            },
          },
        },
      },
    });
  }

  function renderTeknikPage() {
    if (!document.getElementById("teknik-dashboard")) return;
    state = loadState();
    destroyTeknikCharts();

    var weekStats = weeklyTechnicalStats();
    var wk = document.getElementById("teknik-stat-week");
    if (wk) wk.textContent = formatMinutesForDisplay(weekStats.minutes);

    var wkSessionsEl = document.getElementById("teknik-stat-sessions");
    if (wkSessionsEl) wkSessionsEl.textContent = String(weekStats.sessions);

    var wkAvgEl = document.getElementById("teknik-stat-avg");
    var avgMin = weekStats.sessions > 0 ? Math.round(weekStats.minutes / weekStats.sessions) : 0;
    if (wkAvgEl) wkAvgEl.textContent = String(avgMin);

    var lastWeekAnchor = new Date();
    lastWeekAnchor.setDate(lastWeekAnchor.getDate() - 7);
    var lastWeekMin = 0;
    state.sessions.forEach(function (s) {
      if (String(s.category || "").trim() !== "technical") return;
      var iso = sessionEffectiveTime(s);
      if (!iso || !isIsoInWeekStarting(iso, lastWeekAnchor)) return;
      lastWeekMin += s.durationMinutes || 0;
    });
    var trendEl = document.getElementById("teknik-stat-trend");
    var trendHintEl = document.getElementById("teknik-stat-trend-hint");
    if (trendEl) {
      trendEl.classList.remove("teknik-hero-stat__val--up", "teknik-hero-stat__val--down");
      var trendTxt = "—";
      if (lastWeekMin <= 0) {
        if (weekStats.minutes > 0) {
          trendTxt = "▲ Yeni";
          trendEl.classList.add("teknik-hero-stat__val--up");
        }
      } else {
        var pct = Math.round(((weekStats.minutes - lastWeekMin) / lastWeekMin) * 100);
        if (pct > 0) {
          trendTxt = "▲ +" + pct + "%";
          trendEl.classList.add("teknik-hero-stat__val--up");
        } else if (pct < 0) {
          trendTxt = "▼ " + pct + "%";
          trendEl.classList.add("teknik-hero-stat__val--down");
        } else {
          trendTxt = "± %0";
        }
      }
      trendEl.textContent = trendTxt;
    }
    if (trendHintEl) trendHintEl.textContent = "Geçen hafta: " + formatMinutesForDisplay(lastWeekMin) + " dk";

    renderTeknikWeekdayChart(teknikWeekdayPeriod);

    var series30 = technicalDailySeries(30);
    var canvasTrend = document.getElementById("teknik-chart-trend");
    var emptyTrend = document.getElementById("teknik-chart-trend-empty");
    var wrapTrend = document.getElementById("teknik-chart-trend-wrap");
    var sum30 = 0;
    var si;
    for (si = 0; si < series30.minutes.length; si++) {
      sum30 += series30.minutes[si];
    }
    if (canvasTrend && typeof Chart !== "undefined") {
      if (sum30 <= 0) {
        if (emptyTrend) {
          emptyTrend.hidden = false;
          emptyTrend.textContent = "Son 30 günde teknik kayıt yok.";
        }
        if (wrapTrend) wrapTrend.hidden = true;
      } else {
        if (emptyTrend) emptyTrend.hidden = true;
        if (wrapTrend) wrapTrend.hidden = false;

        var trendWin = 7;
        var trendAvg = [];
        var activeDays30 = 0;
        var ti2;
        for (ti2 = 0; ti2 < series30.minutes.length; ti2++) {
          if (series30.minutes[ti2] > 0) activeDays30++;
          var accS = 0;
          var accC = 0;
          var tj;
          for (tj = Math.max(0, ti2 - trendWin + 1); tj <= ti2; tj++) {
            accS += series30.minutes[tj];
            accC++;
          }
          trendAvg.push(accC ? Math.round((accS / accC) * 10) / 10 : 0);
        }
        var trendSubEl = document.getElementById("teknik-trend-sub");
        if (trendSubEl) {
          var dailyAvg30 = Math.round((sum30 / series30.minutes.length) * 10) / 10;
          trendSubEl.textContent =
            "Toplam " + formatMinutesForDisplay(sum30) + " dk · " + activeDays30 + " aktif gün · günlük ort. " + dailyAvg30 + " dk";
        }

        teknikTrendChart = new Chart(canvasTrend, {
          type: "line",
          data: {
            labels: series30.labels,
            datasets: [
              {
                label: "Günlük süre",
                data: series30.minutes,
                borderColor: "#9aa0f5",
                backgroundColor: "rgba(138, 122, 214, 0.12)",
                fill: true,
                tension: 0.25,
                borderWidth: 2,
                pointRadius: 2,
                pointHoverRadius: 5,
                order: 2,
              },
              {
                label: "7 günlük ortalama",
                data: trendAvg,
                borderColor: "#f0a868",
                backgroundColor: "transparent",
                borderDash: [5, 4],
                fill: false,
                tension: 0.3,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                order: 1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            scales: {
              x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
              y: {
                beginAtZero: true,
                title: { display: true, text: "Dakika" },
                ticks: {
                  callback: function (v) {
                    return v + " dk";
                  },
                },
              },
            },
            plugins: {
              legend: { display: true, position: "bottom", labels: { boxWidth: 12, padding: 12, font: { size: 11 } } },
              tooltip: {
                callbacks: {
                  label: function (ctx) {
                    var v = ctx.parsed.y != null ? ctx.parsed.y : 0;
                    if (ctx.datasetIndex === 1) {
                      return "7 günlük ort.: " + v + " dk";
                    }
                    var cnt = series30.counts[ctx.dataIndex] || 0;
                    return ["Süre: " + v + " dk", "Oturum: " + cnt];
                  },
                },
              },
            },
          },
        });
      }
    }

    var canvasTopic = document.getElementById("teknik-chart-topics");
    var emptyTopic = document.getElementById("teknik-chart-topics-empty");
    var wrapTopic = document.getElementById("teknik-chart-topics-wrap");
    var topicAgg = {};
    state.sessions.forEach(function (s) {
      if (String(s.category || "").trim() !== "technical") return;
      var key = s.techTopic && String(s.techTopic).trim() ? String(s.techTopic).trim() : "Konu belirtilmedi";
      topicAgg[key] = (topicAgg[key] || 0) + (s.durationMinutes || 0);
    });
    var topicKeys = Object.keys(topicAgg).filter(function (k) {
      return topicAgg[k] > 0;
    });
    var topicSum = 0;
    var tk;
    for (tk = 0; tk < topicKeys.length; tk++) {
      topicSum += topicAgg[topicKeys[tk]];
    }

    if (canvasTopic && typeof Chart !== "undefined") {
      if (topicSum <= 0) {
        if (emptyTopic) {
          emptyTopic.hidden = false;
          emptyTopic.textContent = "Henüz teknik kayıt yok.";
        }
        if (wrapTopic) wrapTopic.hidden = true;
      } else {
        if (emptyTopic) emptyTopic.hidden = true;
        if (wrapTopic) wrapTopic.hidden = false;
        var topicSubEl = document.getElementById("teknik-topic-sub");
        if (topicSubEl) {
          topicSubEl.textContent =
            topicKeys.length + " konu · toplam " + formatMinutesForDisplay(topicSum) + " dk";
        }
        var colors = ["#9aa0f5", "#a99ce0", "#c4bbeb", "#9a8bdb", "#7866c9", "#6d5cbf", "#b0a3e6", "#8577cf"];
        topicKeys.sort(function (a, b) {
          return topicAgg[b] - topicAgg[a];
        });
        var labelsT = [];
        var dataT = [];
        var colorsT = [];
        var ci;
        for (ci = 0; ci < topicKeys.length; ci++) {
          var kk = topicKeys[ci];
          labelsT.push(kk);
          dataT.push(topicAgg[kk]);
          colorsT.push(colors[ci % colors.length]);
        }
        teknikTopicChart = new Chart(canvasTopic, {
          type: "doughnut",
          data: {
            labels: labelsT,
            datasets: [{ data: dataT, backgroundColor: colorsT, borderWidth: 0 }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "55%",
            plugins: {
              legend: {
                position: "bottom",
                labels: { boxWidth: 12, padding: 8, font: { size: 11 } },
              },
              tooltip: {
                callbacks: {
                  label: function (ctx) {
                    var v = ctx.raw != null ? ctx.raw : 0;
                    var pct = topicSum > 0 ? Math.round((v / topicSum) * 100) : 0;
                    return (ctx.label || "") + ": " + v + " dk (%" + pct + ")";
                  },
                },
              },
            },
          },
        });
      }
    }

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
    if (st === "calisma") return 0;
    if (st === "grammar") return parseNonNegInt(c.grammar);
    if (st === "cloze") return parseNonNegInt(c.cloze);
    if (st === "tr_eng") return parseNonNegInt(c.trEng);
    if (st === "eng_tr") return parseNonNegInt(c.engTr);
    if (st === "passage") return parseNonNegInt(c.passage);
    if (st === "listening") return 0;
    if (st === "paragraf") return parseNonNegInt(c.paragrafAtama);
    if (st === "deneme") return parseNonNegInt(c.deneme);
    if (st === "kelime") return 0;
    return (
      parseNonNegInt(c.grammar) +
      parseNonNegInt(c.cloze) +
      parseNonNegInt(c.trEng) +
      parseNonNegInt(c.engTr) +
      parseNonNegInt(c.passage) +
      parseNonNegInt(c.listening) +
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

  function destroyYdsSubtypeCumulativeCharts() {
    if (typeof Chart === "undefined") return;
    if (ydsSubtypeChart) {
      ydsSubtypeChart.destroy();
      ydsSubtypeChart = null;
    }
    if (ydsProgressChart) {
      ydsProgressChart.destroy();
      ydsProgressChart = null;
    }
  }

  function renderYdsChartKpis(agg) {
    var el = document.getElementById("yds-chart-kpis");
    if (!el) return;
    var min14 = 0;
    var q14 = 0;
    var di;
    for (di = 13; di >= 0; di--) {
      var dt = new Date();
      dt.setHours(0, 0, 0, 0);
      dt.setDate(dt.getDate() - di);
      var dk = dateKeyLocal(dt);
      min14 += agg.min[dk] || 0;
      q14 += agg.q[dk] || 0;
    }
    state.yds = mergeYds(state.yds);
    var prog = cumulativeEnglishProgressByDay(programStartDateKey(state.yds));
    var denemeList = denemeSessionsFromState();
    var plotable = denemeList.filter(function (r) {
      return r.dogru + r.yanlis + r.bos > 0;
    });
    var lastNet = "—";
    if (plotable.length) {
      var ln = plotable[plotable.length - 1].net;
      lastNet = ln != null ? ln.toFixed(1) : "—";
    }
    el.innerHTML =
      '<div class="yds-chart-kpi"><span class="yds-chart-kpi__label">Son 14 gün · dk</span><strong class="yds-chart-kpi__val">' +
      formatMinutesForDisplay(min14) +
      "</strong></div>" +
      '<div class="yds-chart-kpi"><span class="yds-chart-kpi__label">Son 14 gün · soru</span><strong class="yds-chart-kpi__val">' +
      q14 +
      "</strong></div>" +
      '<div class="yds-chart-kpi"><span class="yds-chart-kpi__label">Program · toplam soru</span><strong class="yds-chart-kpi__val">' +
      prog.totalQ +
      "</strong></div>" +
      '<div class="yds-chart-kpi"><span class="yds-chart-kpi__label">Deneme · son net</span><strong class="yds-chart-kpi__val">' +
      lastNet +
      "</strong></div>";
  }

  function renderYdsSubtypeAndProgressCharts(period) {
    var cSub = document.getElementById("yds-chart-subtype");
    var cProg = document.getElementById("yds-chart-progress");
    if (!cSub && !cProg) return;
    if (typeof Chart === "undefined") return;
    state = loadState();
    state.yds = mergeYds(state.yds);
    destroyYdsSubtypeCumulativeCharts();

    var subPeriod = period || sessionStorage.getItem("ydsSubtypePeriod") || "28";
    var subMap = { "7": "Son 7 gün · süreye göre", "28": "Son 28 gün · süreye göre", all: "Tüm zamanlar · süreye göre" };
    var subSubEl = document.getElementById("yds-subtype-sub");
    if (subSubEl) subSubEl.textContent = subMap[subPeriod] || subMap["28"];

    var series = buildYdsSubtypeSeries(subPeriod);

    if (cSub) {
      var emptyS = document.getElementById("yds-subtype-empty");
      var wrapS = document.getElementById("yds-subtype-canvas-wrap");
      if (series.labels.length === 0) {
        if (emptyS) {
          emptyS.textContent = subPeriod === "all" ? "Henüz süre kaydı yok." : "Seçilen dönemde süre kaydı yok.";
          emptyS.hidden = false;
        }
        if (wrapS) wrapS.hidden = true;
      } else {
        if (emptyS) emptyS.hidden = true;
        if (wrapS) wrapS.hidden = false;
        var subTotal = 0;
        var si;
        for (si = 0; si < series.data.length; si++) subTotal += series.data[si];
        cSub.setAttribute("aria-label", "YDS alt tür süre dağılımı");
        ydsSubtypeChart = new Chart(cSub, {
          type: "bar",
          data: {
            labels: series.labels,
            datasets: [
              {
                label: "Süre (dk)",
                data: series.data,
                backgroundColor: series.bg,
                borderWidth: 0,
                borderRadius: 4,
                maxBarThickness: 22,
              },
            ],
          },
          options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { right: 8 } },
            scales: {
              x: {
                beginAtZero: true,
                grid: { color: chartTheme().grid },
                ticks: { callback: function (v) { return v + " dk"; } },
              },
              y: { grid: { display: false } },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function (ctx) {
                    var v = ctx.parsed.x != null ? ctx.parsed.x : 0;
                    var pct = subTotal > 0 ? Math.round((v / subTotal) * 100) : 0;
                    return (ctx.label || "") + ": " + v + " dk (%" + pct + ")";
                  },
                },
              },
            },
          },
        });
      }
    }

    if (cProg) {
      var psK = programStartDateKey(state.yds);
      var prog = cumulativeEnglishProgressByDay(psK);
      var emptyP = document.getElementById("yds-progress-empty");
      var wrapP = document.getElementById("yds-progress-canvas-wrap");
      var progSubEl = document.getElementById("yds-progress-sub");
      if (progSubEl) {
        progSubEl.textContent =
          "Toplam " + formatMinutesForDisplay(prog.totalMin) + " dk · " + prog.totalQ + " soru (program başlangıcından itibaren)";
      }
      if (!prog.labels.length || (prog.totalMin <= 0 && prog.totalQ <= 0)) {
        if (emptyP) {
          emptyP.textContent = "Program ilerlemesi için YDS kaydı yok.";
          emptyP.hidden = false;
        }
        if (wrapP) wrapP.hidden = true;
      } else {
        if (emptyP) emptyP.hidden = true;
        if (wrapP) wrapP.hidden = false;
        cProg.setAttribute("aria-label", "Kümülatif YDS süre ve soru");
        ydsProgressChart = new Chart(cProg, {
          type: "line",
          data: {
            labels: prog.labels,
            datasets: [
              {
                label: "Süre (dk)",
                data: prog.dataMin,
                borderColor: "#60a5fa",
                backgroundColor: "rgba(96, 165, 250, 0.1)",
                fill: true,
                tension: 0.2,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                yAxisID: "y",
              },
              {
                label: "Soru",
                data: prog.dataQ,
                borderColor: "#a78bfa",
                backgroundColor: "transparent",
                fill: false,
                tension: 0.2,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                yAxisID: "y1",
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
                position: "left",
                beginAtZero: true,
                title: { display: true, text: "Dakika (kümülatif)" },
                ticks: { callback: function (v) { return v + " dk"; } },
              },
              y1: {
                position: "right",
                beginAtZero: true,
                grid: { drawOnChartArea: false },
                title: { display: true, text: "Soru (kümülatif)" },
                ticks: { precision: 0, callback: function (v) { return v + " soru"; } },
              },
            },
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 12, padding: 10, font: { size: 11 } } },
              tooltip: {
                callbacks: {
                  label: function (ctx) {
                    var v = ctx.parsed.y != null ? ctx.parsed.y : 0;
                    if (ctx.datasetIndex === 1) return "Soru: " + v;
                    return "Süre: " + v + " dk";
                  },
                },
              },
            },
          },
        });
      }
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
    var netSum = 0;
    var bestNet = -Infinity;
    for (i = 0; i < plotable.length; i++) {
      var row = plotable[i];
      var dt = new Date(row.iso);
      labels.push(dt.getDate() + " " + MONTH_SHORT_TR[dt.getMonth()]);
      var nVal = row.net != null ? row.net : row.dogru - row.yanlis / 4;
      nets.push(nVal);
      netSum += nVal;
      if (nVal > bestNet) bestNet = nVal;
    }
    var avgNet = plotable.length ? Math.round((netSum / plotable.length) * 10) / 10 : 0;
    var lastNetVal = nets[nets.length - 1];

    var denemeSubEl = document.getElementById("yds-deneme-sub");
    if (denemeSubEl) {
      denemeSubEl.textContent =
        plotable.length +
        " deneme · son net " +
        lastNetVal.toFixed(1) +
        " · ort. " +
        avgNet.toFixed(1) +
        " · en iyi " +
        bestNet.toFixed(1);
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
            borderColor: "#60a5fa",
            backgroundColor: "rgba(96, 165, 250, 0.12)",
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: "#60a5fa",
            pointBorderColor: chartTheme().surface,
            pointBorderWidth: 2,
            borderWidth: 2,
            order: 1,
          },
          {
            label: "Ortalama (" + avgNet.toFixed(1) + ")",
            data: nets.map(function () { return avgNet; }),
            borderColor: "#94a3b8",
            backgroundColor: "transparent",
            borderDash: [5, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            order: 2,
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

  function ydsDayActivityFromAgg(agg, dateKey) {
    var minutes = agg.min[dateKey] || 0;
    var questions = agg.q[dateKey] || 0;
    return { minutes: minutes, questions: questions, active: minutes > 0 || questions > 0 };
  }

  function ydsCalendarCellSummary(act) {
    if (!act.active) return "";
    var parts = [];
    if (act.minutes > 0) parts.push(act.minutes + " dk");
    if (act.questions > 0) parts.push(act.questions + " soru");
    return parts.join(" · ");
  }

  function renderYdsCalendarMonthHtml(y, m, agg) {
    var first = new Date(y, m, 1);
    var startOffset = (first.getDay() + 6) % 7;
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var prevMonthDate = new Date(y, m, 0);
    var prevMonthDays = prevMonthDate.getDate();
    var prevY = prevMonthDate.getFullYear();
    var prevM = prevMonthDate.getMonth();

    var cells = [];
    var i;
    for (i = 0; i < startOffset; i++) {
      cells.push({
        outside: true,
        y: prevY,
        m: prevM,
        d: prevMonthDays - startOffset + 1 + i,
      });
    }
    for (i = 1; i <= daysInMonth; i++) {
      cells.push({ outside: false, y: y, m: m, d: i });
    }
    var nextY = m === 11 ? y + 1 : y;
    var nextM = m === 11 ? 0 : m + 1;
    var nextD = 1;
    while (cells.length % 7 !== 0) {
      cells.push({ outside: true, y: nextY, m: nextM, d: nextD });
      nextD += 1;
    }

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
      var key = dateKeyLocal(new Date(cell.y, cell.m, cell.d));
      var act = ydsDayActivityFromAgg(agg, key);
      var isToday = key === todayKey;
      var cls = "calendar-cell";
      if (cell.outside) cls += " calendar-cell--outside";
      if (isToday) cls += " calendar-cell--today";
      if (act.active) cls += " calendar-cell--streak";
      if (!act.active) cls += " calendar-cell--zero";

      var title = key + ": " + (act.active ? ydsCalendarCellSummary(act) : "kayıt yok");

      html.push(
        '<div class="' +
          cls +
          '" title="' +
          escapeHtml(title) +
          '"><span class="calendar-cell__num">' +
          cell.d +
          "</span>"
      );

      if (act.active) {
        html.push('<div class="calendar-cell__bar">');
        html.push(
          '<span class="calendar-cell__seg calendar-cell__seg--en" style="width:100%"></span>'
        );
        html.push("</div>");
        html.push('<span class="calendar-cell__total">' + escapeHtml(ydsCalendarCellSummary(act)) + "</span>");
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
    var maps = dayCategoryMapsByEffectiveDate();
    var enMap = maps.en || {};
    var ydsAgg = englishDayAggregatesFromState();

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
      if (todayM > 0) {
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
        var act = ydsDayActivityFromAgg(ydsAgg, k);
        var ok = act.active;
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
            (act.active ? ydsCalendarCellSummary(act) : "kayıt yok") +
            '"><span class="yds-chain-dot__wd">' +
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
      calRoot.innerHTML = renderYdsCalendarMonthHtml(ydsCalView.y, ydsCalView.m, ydsAgg);
    }

    renderYdsChartKpis(ydsAgg);

    var canvas = document.getElementById("yds-chart-trend");
    var emptyEl = document.getElementById("yds-chart-empty");
    var wrap = document.getElementById("yds-chart-canvas-wrap");
    destroyYdsTrendChart();
    destroyYdsSubtypeCumulativeCharts();
    if (!canvas || typeof Chart === "undefined") {
      renderYdsSubtypeAndProgressCharts();
      return;
    }

    state = loadState();
    state.yds = mergeYds(state.yds);
    var chartStartRaw = (state.yds.chartStartDate && String(state.yds.chartStartDate).trim()) || "";
    var chartStartOk = /^\d{4}-\d{2}-\d{2}$/.test(chartStartRaw);

    var agg = englishDayAggregatesFromState();
    var useMonthly = chartStartOk && ydsChartShouldUseMonthly(chartStartRaw);
    var labels = [];
    var dataMin = [];
    var dataQ = [];
    var sumTotal = 0;
    var sumQ = 0;
    var t;
    var ii;

    if (useMonthly) {
      var todayKeyM = dateKeyLocal(new Date());
      var ms = ydsChartMonthlySeries(agg, chartStartRaw, todayKeyM);
      labels = ms.labels;
      dataMin = ms.dataMin;
      dataQ = ms.dataQ;
      for (ii = 0; ii < labels.length; ii++) {
        sumTotal += dataMin[ii];
        sumQ += dataQ[ii];
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
        dataMin.push(m0);
        dataQ.push(q0);
        sumTotal += m0;
        sumQ += q0;
      }
    }

    var actSubEl = document.getElementById("yds-activity-sub");
    if (actSubEl) {
      actSubEl.textContent = useMonthly
        ? "Aylık · toplam " + formatMinutesForDisplay(sumTotal) + " dk · " + sumQ + " soru"
        : "Son 14 gün · toplam " + formatMinutesForDisplay(sumTotal) + " dk · " + sumQ + " soru";
    }

    if (sumTotal <= 0 && sumQ <= 0) {
      if (emptyEl) {
        emptyEl.textContent = useMonthly ? "Seçilen aralıkta kayıt yok." : "Son 14 günde kayıt yok.";
        emptyEl.hidden = false;
      }
      if (wrap) wrap.hidden = true;
    } else {
      if (emptyEl) emptyEl.hidden = true;
      if (wrap) wrap.hidden = false;

      if (canvas) {
        canvas.setAttribute(
          "aria-label",
          useMonthly ? "Aylık YDS aktivitesi (dakika ve soru)" : "Son 14 gün YDS aktivitesi (dakika ve soru)"
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
              type: "bar",
              label: "Süre (dk)",
              data: dataMin,
              backgroundColor: "rgba(96, 165, 250, 0.55)",
              hoverBackgroundColor: "rgba(96, 165, 250, 0.78)",
              borderWidth: 0,
              borderRadius: 4,
              maxBarThickness: useMonthly ? 28 : 22,
              yAxisID: "y",
              order: 2,
            },
            {
              type: "line",
              label: "Soru",
              data: dataQ,
              borderColor: "#a78bfa",
              backgroundColor: "transparent",
              borderWidth: 2,
              tension: 0.25,
              pointRadius: 3,
              pointHoverRadius: 5,
              yAxisID: "y1",
              order: 1,
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
              title: { display: true, text: "Soru" },
              ticks: { precision: 0 },
            },
          },
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 12, padding: 10, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var v = ctx.parsed.y != null ? ctx.parsed.y : 0;
                  if (ctx.datasetIndex === 1) return "Soru: " + v;
                  return "Süre: " + v + " dk";
                },
              },
            },
          },
        },
      });
    }

    renderYdsSubtypeAndProgressCharts();
  }

  function rollupEnglishSessionsWeek(state) {
    function emptyRow() {
      return { q: 0, min: 0, dogru: 0, yanlis: 0, bos: 0 };
    }
    var agg = {
      grammar: emptyRow(),
      calisma: emptyRow(),
      cloze: emptyRow(),
      tr_eng: emptyRow(),
      eng_tr: emptyRow(),
      passage: emptyRow(),
      listening: emptyRow(),
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
      } else if (st === "listening") {
        agg.listening.q += parseNonNegInt(c.listening);
        agg.listening.min += dm;
        rollupAddScore(agg.listening, s);
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
      } else if (st === "calisma") {
        agg.calisma.min += dm;
      } else {
        agg.grammar.q += parseNonNegInt(c.grammar);
        agg.cloze.q += parseNonNegInt(c.cloze);
        agg.tr_eng.q += parseNonNegInt(c.trEng);
        agg.eng_tr.q += parseNonNegInt(c.engTr);
        agg.passage.q += parseNonNegInt(c.passage);
        agg.listening.q += parseNonNegInt(c.listening);
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
    row("Çalışma", agg.calisma, null);
    row("Cloze", agg.cloze, null);
    row("TR → ENG", agg.tr_eng, null);
    row("ENG → TR", agg.eng_tr, null);
    row("Passage", agg.passage, null);
    row("Listening", agg.listening, null);
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
      banner.textContent = "Başvuru son tarihi geçmiş.";
    } else if (diff === 0) {
      banner.classList.add("yds-basvuru-alert--critical");
      banner.textContent = "Başvuru son günü bugün.";
    } else if (diff <= 3) {
      banner.classList.add("yds-basvuru-alert--critical");
      banner.textContent = "Başvuruya " + diff + " gün kaldı.";
    } else if (diff <= 7) {
      banner.classList.add("yds-basvuru-alert--soon");
      banner.textContent = "Başvuruya " + diff + " gün kaldı.";
    } else if (diff <= 14) {
      banner.classList.add("yds-basvuru-alert--warn");
      banner.textContent = "Başvuruya " + diff + " gün kaldı.";
    } else {
      banner.classList.add("yds-basvuru-alert--info");
      banner.textContent = "Başvuruya " + diff + " gün var.";
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
        if (diff > 0) daysEl.textContent = "Sınava kalan: " + diff + " gün";
        else if (diff === 0) daysEl.textContent = "Sınav günü bugün.";
        else daysEl.textContent = "Sınav tarihi geçmiş.";
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

    function persistYdsField(fieldId) {
      state = loadState();
      state.yds = mergeYds(state.yds);
      var y = state.yds;
      if (fieldId === "yds-exam-date") {
        var examIn = document.getElementById("yds-exam-date");
        if (examIn) y.examDate = examIn.value.trim();
      } else if (fieldId === "yds-target-score") {
        var scoreIn = document.getElementById("yds-target-score");
        if (scoreIn) y.targetScore = scoreIn.value.trim();
      } else if (fieldId === "yds-application-date") {
        var appIn = document.getElementById("yds-application-date");
        if (appIn) y.applicationDate = appIn.value.trim();
      } else if (fieldId === "yds-chart-start-date") {
        var chartStartIn = document.getElementById("yds-chart-start-date");
        if (chartStartIn) y.chartStartDate = chartStartIn.value.trim();
      } else if (fieldId === "yds-program-start-date") {
        var programStartIn = document.getElementById("yds-program-start-date");
        if (programStartIn) y.programStartDate = programStartIn.value.trim();
      }
      state.yds = y;
      saveState(state);
      ydsExamDateEditing = false;
      ydsScoreEditing = false;
      ydsApplicationEditing = false;
      renderYdsPage();
      renderStreak();
    }

    ["yds-exam-date", "yds-target-score", "yds-application-date", "yds-chart-start-date", "yds-program-start-date"].forEach(function (id) {
      var elField = document.getElementById(id);
      if (elField) {
        elField.addEventListener("change", function () {
          persistYdsField(id);
        });
        elField.addEventListener("blur", function () {
          persistYdsField(id);
        });
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

    var subtypePeriodTabs = document.getElementById("yds-subtype-period");
    if (subtypePeriodTabs && !subtypePeriodTabs.dataset.bound) {
      subtypePeriodTabs.dataset.bound = "1";
      var savedPeriod = sessionStorage.getItem("ydsSubtypePeriod");
      if (savedPeriod === "7" || savedPeriod === "28" || savedPeriod === "all") {
        subtypePeriodTabs.querySelectorAll(".seg-toggle__btn").forEach(function (b) {
          var on = b.getAttribute("data-period") === savedPeriod;
          b.classList.toggle("seg-toggle__btn--active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
      }
      subtypePeriodTabs.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-period]");
        if (!btn || !subtypePeriodTabs.contains(btn)) return;
        var period = btn.getAttribute("data-period") || "28";
        sessionStorage.setItem("ydsSubtypePeriod", period);
        subtypePeriodTabs.querySelectorAll(".seg-toggle__btn").forEach(function (b) {
          var on = b === btn;
          b.classList.toggle("seg-toggle__btn--active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        state = loadState();
        renderYdsSubtypeAndProgressCharts(period);
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

  function findNoteCategoryById(state, id) {
    var i;
    for (i = 0; i < state.noteCategories.length; i++) {
      if (state.noteCategories[i].id === id) return state.noteCategories[i];
    }
    return null;
  }

  function getNotlarimSelectedCategoryId(state) {
    var sid = sessionStorage.getItem("notlarimCatId");
    if (sid && findNoteCategoryById(state, sid)) return sid;
    if (state.noteCategories.length) return state.noteCategories[0].id;
    return null;
  }

  function renderNotlarimPage() {
    var root = document.getElementById("notlarim-root");
    if (!root) return;
    state = loadState();
    if (!state.noteCategories) state.noteCategories = [];
    var listEl = document.getElementById("notes-category-list");
    var mainEl = document.getElementById("notes-main-inner");
    if (!listEl || !mainEl) return;

    var selId = getNotlarimSelectedCategoryId(state);
    if (selId) sessionStorage.setItem("notlarimCatId", selId);
    else sessionStorage.removeItem("notlarimCatId");

    var parts = [];
    var ci;
    for (ci = 0; ci < state.noteCategories.length; ci++) {
      var c = state.noteCategories[ci];
      var active = c.id === selId ? " notlarim-cat-btn--active" : "";
      var noteCount = c.notes && c.notes.length ? c.notes.length : 0;
      parts.push(
        '<li class="notlarim-cat-item"><button type="button" class="notlarim-cat-btn' +
          active +
          '" data-notes-select="' +
          escapeHtml(c.id) +
          '"><span class="notlarim-cat-btn__name">' +
          escapeHtml(c.title) +
          '</span><span class="notlarim-cat-btn__count">' +
          noteCount +
          "</span></button></li>"
      );
    }
    listEl.innerHTML = parts.length
      ? parts.join("")
      : '<li class="notlarim-cat-empty">Henüz kategori yok. Soldan ekleyin.</li>';

    var cat = selId ? findNoteCategoryById(state, selId) : null;
    if (!cat) {
      mainEl.innerHTML =
        '<p class="notlarim-placeholder">Sol taraftan kategori seçin veya yeni kategori oluşturun.</p>';
      return;
    }

    var notesHtml = [];
    var sorted = cat.notes.slice().sort(function (a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
    for (ci = 0; ci < sorted.length; ci++) {
      var n = sorted[ci];
      var dateLabel = n.createdAt ? formatDateOnly(n.createdAt) : "";
      notesHtml.push(
        '<article class="notlarim-note" data-note-id="' +
          escapeHtml(n.id) +
          '"><div class="notlarim-note__body">' +
          escapeHtml(n.body) +
          "</div>" +
          '<div class="notlarim-note__foot">' +
          (dateLabel
            ? '<span class="notlarim-note__date">' + escapeHtml(dateLabel) + "</span>"
            : "<span></span>") +
          '<button type="button" class="notlarim-note__del" data-notes-delete-note="' +
          escapeHtml(n.id) +
          '" data-notes-cat-id="' +
          escapeHtml(cat.id) +
          '" aria-label="Notu sil" title="Notu sil">Sil</button>' +
          "</div></article>"
      );
    }

    var noteCount = cat.notes ? cat.notes.length : 0;
    mainEl.innerHTML =
      '<div class="notlarim-cat-toolbar">' +
      '<div class="notlarim-cat-toolbar__head">' +
      '<h2 class="notlarim-cat-title">' +
      escapeHtml(cat.title) +
      "</h2>" +
      '<span class="notlarim-cat-meta">' +
      noteCount +
      (noteCount === 1 ? " not" : " not") +
      "</span></div>" +
      '<div class="notlarim-cat-actions">' +
      '<button type="button" class="btn btn--ghost btn--small" data-notes-rename-cat="' +
      escapeHtml(cat.id) +
      '">Adı değiştir</button>' +
      '<button type="button" class="btn btn--ghost btn--small notlarim-btn--danger" data-notes-delete-cat="' +
      escapeHtml(cat.id) +
      '">Kategoriyi sil</button>' +
      "</div></div>" +
      '<div class="notlarim-compose"><label for="notes-draft-body" class="sr-only">Yeni not</label>' +
      '<textarea id="notes-draft-body" class="notlarim-textarea" rows="4" placeholder="Bu kategoriye bir not yazın…"></textarea>' +
      '<div class="notlarim-compose__foot">' +
      '<button type="button" class="btn btn--primary btn--small" data-notes-add-note="' +
      escapeHtml(cat.id) +
      '">Not ekle</button></div></div>' +
      '<div class="notlarim-notes-list">' +
      (notesHtml.length
        ? notesHtml.join("")
        : '<p class="notlarim-notes-empty">Bu kategoride henüz not yok. Yukarıdan ilk notunuzu ekleyin.</p>') +
      "</div>";
  }

  function initNotlarimPage() {
    var root = document.getElementById("notlarim-root");
    if (!root || root.dataset.bound) return;
    root.dataset.bound = "1";

    var btnAddCat = document.getElementById("notes-add-category");
    if (btnAddCat) {
      btnAddCat.addEventListener("click", function () {
        var inp = document.getElementById("notes-new-category-title");
        var title = inp && inp.value ? String(inp.value).trim() : "";
        if (!title) {
          alert("Kategori adı girin.");
          return;
        }
        state = loadState();
        if (!state.noteCategories) state.noteCategories = [];
        var nid = uid();
        state.noteCategories.push({ id: nid, title: title, notes: [] });
        sessionStorage.setItem("notlarimCatId", nid);
        if (inp) inp.value = "";
        saveState(state);
        renderNotlarimPage();
      });
    }

    root.addEventListener("click", function (e) {
      var sel = e.target.closest("[data-notes-select]");
      if (sel) {
        var sid = sel.getAttribute("data-notes-select");
        if (sid) {
          sessionStorage.setItem("notlarimCatId", sid);
          renderNotlarimPage();
        }
        return;
      }
      var ren = e.target.closest("[data-notes-rename-cat]");
      if (ren) {
        var cid = ren.getAttribute("data-notes-rename-cat");
        state = loadState();
        var c = findNoteCategoryById(state, cid);
        if (!c) return;
        var nt = prompt("Yeni kategori adı", c.title);
        if (nt == null) return;
        nt = String(nt).trim();
        if (!nt) {
          alert("Ad boş olamaz.");
          return;
        }
        c.title = nt;
        saveState(state);
        renderNotlarimPage();
        return;
      }
      var delc = e.target.closest("[data-notes-delete-cat]");
      if (delc) {
        var cid2 = delc.getAttribute("data-notes-delete-cat");
        if (!confirm("Bu kategori ve içindeki tüm notlar silinsin mi?")) return;
        state = loadState();
        state.noteCategories = state.noteCategories.filter(function (x) {
          return x.id !== cid2;
        });
        if (sessionStorage.getItem("notlarimCatId") === cid2) {
          sessionStorage.removeItem("notlarimCatId");
        }
        saveState(state);
        renderNotlarimPage();
        return;
      }
      var deln = e.target.closest("[data-notes-delete-note]");
      if (deln) {
        var noteId = deln.getAttribute("data-notes-delete-note");
        var catId = deln.getAttribute("data-notes-cat-id");
        state = loadState();
        var c2 = findNoteCategoryById(state, catId);
        if (!c2 || !noteId) return;
        c2.notes = c2.notes.filter(function (nn) {
          return nn.id !== noteId;
        });
        saveState(state);
        renderNotlarimPage();
        return;
      }
      var addn = e.target.closest("[data-notes-add-note]");
      if (addn) {
        var catId3 = addn.getAttribute("data-notes-add-note");
        var ta = document.getElementById("notes-draft-body");
        var body = ta ? String(ta.value || "").trim() : "";
        if (!body) {
          alert("Not metni yazın.");
          return;
        }
        state = loadState();
        var c3 = findNoteCategoryById(state, catId3);
        if (!c3) return;
        c3.notes.push({ id: uid(), body: body, createdAt: new Date().toISOString() });
        saveState(state);
        renderNotlarimPage();
        return;
      }
    });
  }

  function deleteSession(id) {
    state.sessions = state.sessions.filter(function (s) {
      return s.id !== id;
    });
    saveState(state);
    renderStats();
    renderList();
    if (page === "teknik") renderTeknikPage();
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
      downloadJsonBackup("calisma-takip-yedek.json");
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
    state = normalizeStateObject(data);
    saveState(state);
    renderStats();
    renderList();
    refreshBookInvestPages();
    if (page === "notlarim") renderNotlarimPage();
    if (page === "yeni" && el.bookSelect) populateBookSelect();
  }

  var calendarMonthlyChart = null;

  function renderCalendarMonthlyChart() {
    var canvas = document.getElementById("calendar-chart-monthly");
    if (!canvas || typeof Chart === "undefined") return;
    var emptyEl = document.getElementById("calendar-chart-monthly-empty");
    var wrapEl = document.getElementById("calendar-chart-monthly-wrap");

    var labels = [];
    var minutes = [];
    var hours = [];
    var now = new Date();
    var mi;
    for (mi = 11; mi >= 0; mi--) {
      var ref = new Date(now.getFullYear(), now.getMonth() - mi, 1);
      var mStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
      var mEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
      var total = 0;
      state.sessions.forEach(function (s) {
        var cat = String(s.category || "").trim();
        if (cat !== "english" && cat !== "technical" && cat !== "book") return;
        var iso = sessionEffectiveTime(s);
        if (!iso) return;
        var t = new Date(iso);
        if (isNaN(t.getTime()) || t < mStart || t >= mEnd) return;
        total += s.durationMinutes || 0;
      });
      labels.push(MONTH_SHORT_TR[ref.getMonth()] + " " + String(ref.getFullYear()).slice(2));
      minutes.push(total);
      hours.push(Math.round((total / 60) * 10) / 10);
    }

    var sum = 0;
    for (mi = 0; mi < minutes.length; mi++) sum += minutes[mi];

    if (calendarMonthlyChart) {
      calendarMonthlyChart.destroy();
      calendarMonthlyChart = null;
    }

    if (sum <= 0) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = "Son 12 ayda çalışma kaydı yok.";
      }
      if (wrapEl) wrapEl.hidden = true;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    if (wrapEl) wrapEl.hidden = false;

    calendarMonthlyChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Çalışma",
            data: hours,
            backgroundColor: "#5cc4b7",
            hoverBackgroundColor: "#43b3a5",
            borderWidth: 0,
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 38,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8 } },
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { font: { size: 11 }, color: "#94a3b8" },
          },
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: "rgba(148,163,184,0.18)" },
            ticks: {
              color: "#94a3b8",
              font: { size: 11 },
              padding: 6,
              maxTicksLimit: 6,
              callback: function (val) {
                return val + " sa";
              },
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            usePointStyle: true,
            padding: 12,
            backgroundColor: "rgba(15,23,42,0.92)",
            titleFont: { size: 13, weight: "600" },
            bodyFont: { size: 12 },
            callbacks: {
              label: function (ctx) {
                var v = ctx.parsed.y != null ? ctx.parsed.y : 0;
                return "≈ " + v + " saat";
              },
            },
          },
        },
      },
    });
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

    function renderCalendarCharts() {
      state = loadState();
      renderCalendarMonthlyChart();
      renderDashboardCharts();
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
      downloadJsonBackup("calisma-takip-yedek.json");
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
          renderCalendarCharts();
        } catch (err) {
          alert("Dosya okunamadı veya format uyumsuz.");
        }
        input.value = "";
      };
      reader.readAsText(file);
    });

    if (typeof window !== "undefined") {
      window.__calismaCalendarRefresh = function () {
        renderMonth();
        renderCalendarCharts();
      };
    }

    renderMonth();
    renderCalendarCharts();
  }

  applyChartDefaults();

  if (page === "dashboard") {
    bindExportClick();
    attachStandardImport();
    var dashPeriodSeg = document.getElementById("dash-charts-period");
    if (dashPeriodSeg && !dashPeriodSeg.dataset.bound) {
      dashPeriodSeg.dataset.bound = "1";
      var savedPeriod = sessionStorage.getItem("dashChartsPeriod") === "month" ? "month" : "week";
      dashPeriodSeg.querySelectorAll(".seg-toggle__btn").forEach(function (b) {
        var on = b.getAttribute("data-period") === savedPeriod;
        b.classList.toggle("seg-toggle__btn--active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      dashPeriodSeg.addEventListener("click", function (e) {
        var btn = e.target.closest(".seg-toggle__btn");
        if (!btn) return;
        var mode = btn.getAttribute("data-period") === "month" ? "month" : "week";
        sessionStorage.setItem("dashChartsPeriod", mode);
        dashPeriodSeg.querySelectorAll(".seg-toggle__btn").forEach(function (b) {
          var on = b === btn;
          b.classList.toggle("seg-toggle__btn--active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        renderDashboardIndexCharts();
        renderDashboardCharts();
      });
    }
    renderStats();
  } else if (page === "yeni") {
    el.btnStart.addEventListener("click", startTimer);
    el.btnPause.addEventListener("click", pauseTimer);
    el.btnReset.addEventListener("click", resetTimer);

    el.btnUseTimer.addEventListener("click", function () {
      var mins = Math.round((timerElapsedSec / 60) * 100) / 100;
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
        } else if (stT === "calisma" && el.enCalismaMin) {
          el.enCalismaMin.value = mins > 0 ? String(mins) : "";
          el.enCalismaMin.focus();
        } else if (stT === "listening" && el.enListeningMin) {
          el.enListeningMin.value = mins > 0 ? String(mins) : "";
          el.enListeningMin.focus();
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
      if (el.enListeningMin) el.enListeningMin.value = "";
      if (el.enQParagraf) el.enQParagraf.value = "";
      if (el.enQDeneme) el.enQDeneme.value = "";
      if (el.enGrammarMin) el.enGrammarMin.value = "";
      if (el.enOtherMin) el.enOtherMin.value = "";
      if (el.enDogru) el.enDogru.value = "";
      if (el.enYanlis) el.enYanlis.value = "";
      if (el.enBos) el.enBos.value = "";
      if (el.enKelimeEzberMin) el.enKelimeEzberMin.value = "";
      if (el.enKelimeSayisi) el.enKelimeSayisi.value = "";
      if (el.enCalismaMin) el.enCalismaMin.value = "";
      syncEnglishSubtypeUI();
    }

    el.form.addEventListener("submit", function (e) {
      e.preventDefault();
      var cat = el.category.value;
      var duration = parseNonNegMinutes(el.duration && el.duration.value);

      if (cat === "english") {
        var st = el.enSubtype && el.enSubtype.value;
        if (!st) {
          alert("YDS çalışma türü seç.");
          return;
        }
        var gMin = el.enGrammarMin ? parseNonNegMinutes(el.enGrammarMin.value) : 0;
        var kEz = el.enKelimeEzberMin ? parseNonNegMinutes(el.enKelimeEzberMin.value) : 0;
        var kSay = el.enKelimeSayisi ? parseNonNegInt(el.enKelimeSayisi.value) : 0;
        var oMin = el.enOtherMin ? parseNonNegMinutes(el.enOtherMin.value) : 0;
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
        var c = { grammar: 0, cloze: 0, trEng: 0, engTr: 0, passage: 0, listening: 0, paragrafAtama: 0, deneme: 0 };
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
        } else if (st === "listening") {
          var listM = el.enListeningMin ? parseNonNegMinutes(el.enListeningMin.value) : 0;
          if (listM > 0) ok = true;
          duration = listM > 0 ? listM : 1;
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
        } else if (st === "calisma") {
          var calM = el.enCalismaMin ? parseNonNegMinutes(el.enCalismaMin.value) : 0;
          if (calM > 0) ok = true;
          duration = calM > 0 ? calM : 1;
        }
        if (!ok) {
          alert("Seçtiğin türe uygun soru sayısı veya süre gir.");
          return;
        }
      } else if (cat !== "investment") {
        if (duration <= 0 || duration > 1440) {
          alert("Lütfen geçerli bir süre (dakika) gir. 0'dan büyük, en fazla 1440; ondalık için virgül veya nokta kullanın.");
          return;
        }
      }

      var backIso = null;
      if (el.recordDate && el.recordDate.value && String(el.recordDate.value).trim()) {
        backIso = investDateTimeFromInputs(el.recordDate, el.recordTime);
        if (!backIso) {
          alert("Geçerli bir kayıt tarihi seçin (veya alanı boş bırakın).");
          return;
        }
      }

      var session = {
        id: uid(),
        category: cat,
        durationMinutes: cat === "investment" ? 0 : duration,
        note: el.note.value.trim(),
        tags: parseTags(el.tags.value),
        createdAt: backIso || new Date().toISOString(),
      };

      if (cat === "english") {
        var st2 = el.enSubtype && el.enSubtype.value;
        var c2 = { grammar: 0, cloze: 0, trEng: 0, engTr: 0, passage: 0, listening: 0, paragrafAtama: 0, deneme: 0 };
        var gM = el.enGrammarMin ? parseNonNegMinutes(el.enGrammarMin.value) : 0;
        var kE = el.enKelimeEzberMin ? parseNonNegMinutes(el.enKelimeEzberMin.value) : 0;
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
        if (st2 !== "kelime" && st2 !== "calisma" && st2 !== "listening") {
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
          applyBookTotalPagesIfProvided(bookId, el.bookTotalPages && el.bookTotalPages.value);
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
        var txIso;
        if (backIso) {
          txIso = backIso;
        } else {
          txIso = investDateTimeFromInputs(el.investDate, el.investTime);
          if (!txIso) {
            alert("İşlem tarihi seçin veya üstteki geçmiş kayıt tarihini kullanın.");
            return;
          }
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
      if (el.bookFinished) el.bookFinished.checked = false;
      if (cat === "book") populateBookFieldsFromSelect();
      else {
        if (el.bookTotalPages) el.bookTotalPages.value = "";
        if (el.bookDateStart) el.bookDateStart.value = "";
        if (el.bookDateEnd) el.bookDateEnd.value = "";
      }
      if (el.investAsset) el.investAsset.value = "";
      if (el.investAmount) el.investAmount.value = "";
      if (el.investSharePrice) el.investSharePrice.value = "";
      if (el.recordDate) el.recordDate.value = "";
      if (el.recordTime) el.recordTime.value = "";
      setInvestDateDefaults();
      if (cat === "investment") populateInvestAssetSuggestions();
    });

    bindExportClick();
    attachStandardImport();
    populateBookSelect();
    updateTimerDisplay();
    setInvestDateDefaults();
    syncCategoryUI();
    syncBookNewFields();
  } else if (page === "gecmis") {
    var gecmisTabs = document.querySelector(".gecmis-cat-tabs");
    if (gecmisTabs && !gecmisTabs.dataset.bound) {
      gecmisTabs.dataset.bound = "1";
      gecmisTabs.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-gecmis-filter]");
        if (!btn || !gecmisTabs.contains(btn)) return;
        gecmisTabs.querySelectorAll(".gecmis-cat-tab").forEach(function (tab) {
          var on = tab === btn;
          tab.classList.toggle("gecmis-cat-tab--active", on);
          tab.setAttribute("aria-selected", on ? "true" : "false");
        });
        renderList();
      });
    }
    bindGecmisSessionDeletes();
    bindRecordsCollapsible(document.getElementById("gecmis-records-panel"), "gecmisRecordsOpen");
    bindExportClick();
    attachStandardImport();
    renderList();
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
        var prevMode = sessionStorage.getItem("yatirimMode") || "month";
        var newMode = btn.getAttribute("data-yatirim-mode");
        if (newMode === "week" && prevMode !== "week") {
          setYatirimWeekRefToLocalToday();
        }
        sessionStorage.setItem("yatirimMode", newMode);
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
    bindRecordsCollapsible(document.getElementById("yatirim-records-panel"), "yatirimRecordsOpen");
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
  } else if (page === "teknik") {
    bindExportClick();
    attachStandardImport();
    var weekdayPeriodTabs = document.getElementById("teknik-weekday-period");
    if (weekdayPeriodTabs && !weekdayPeriodTabs.dataset.bound) {
      weekdayPeriodTabs.dataset.bound = "1";
      weekdayPeriodTabs.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-period]");
        if (!btn || !weekdayPeriodTabs.contains(btn)) return;
        teknikWeekdayPeriod = btn.getAttribute("data-period") || "year";
        weekdayPeriodTabs.querySelectorAll(".seg-toggle__btn").forEach(function (b) {
          var on = b === btn;
          b.classList.toggle("seg-toggle__btn--active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        state = loadState();
        renderTeknikWeekdayChart(teknikWeekdayPeriod);
      });
    }
    renderTeknikPage();
  } else if (page === "notlarim") {
    bindExportClick();
    attachStandardImport();
    initNotlarimPage();
    renderNotlarimPage();
  }

  function refreshAfterServerSync() {
    if (page === "dashboard") renderStats();
    else if (page === "gecmis") {
      renderList();
    }
    else if (page === "kitaplar") renderKitaplarPage();
    else if (page === "yatirim") renderYatirimPage();
    else if (page === "yds") renderYdsPage();
    else if (page === "notlarim") renderNotlarimPage();
    else if (page === "teknik") renderTeknikPage();
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
          var incoming = normalizeStateObject(data);
          var serverIds = Object.create(null);
          var si;
          for (si = 0; si < incoming.sessions.length; si++) {
            var sid = incoming.sessions[si] && incoming.sessions[si].id;
            if (sid) serverIds[sid] = true;
          }
          var mergedSessions = incoming.sessions.slice();
          var addedLocal = 0;
          for (si = 0; si < state.sessions.length; si++) {
            var loc = state.sessions[si];
            if (!loc || !loc.id) continue;
            if (!serverIds[loc.id]) {
              mergedSessions.push(loc);
              addedLocal++;
            }
          }
          incoming.sessions = mergedSessions;
          state = incoming;
          persistStateLocal(state);
          if (addedLocal > 0) pushStateToServerImmediate(state);
          refreshAfterServerSync();
        }
      })
      .catch(function () {});
  }

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("themechange", function () {
      applyChartDefaults();
      try {
        refreshAfterServerSync();
      } catch (e) {}
    });
  }

  initServerSync();
  initAutoExportScheduler();
})();
