(function () {

  // Version du cache : à incrémenter pour invalider toutes les entrées localStorage existantes (dans le navigateur)
  var VERSION = "v8";
  // Fuseau horaire utilisé pour l'affichage des dates et heures
  var TIMEZONE = "Europe/Paris";
  // Nombre de jours affichés dans le graphe (à partir d'aujourd'hui en remontant)
  var LOOKBACK_DAYS = 30;
  // Durée maximale du cache local (dans le navigateur) pour les données du jour (en ms) — rafraîchi au plus toutes les 15 min
  var TODAY_CACHE_MAX_MS = 15 * 60 * 1000;
  // Durée du cache local (dans le navigateur) pour les jours passés (en ms) — données immuables, conservées 24 h
  var PAST_CACHE_MS = 24 * 60 * 60 * 1000;
  // Clé localStorage utilisée pour mémoriser la préférence de thème (light / dark / auto)
  var THEME_STORAGE_KEY = "prep_theme";
  // Préfixe de toutes les entrées de cache localStorage — inclut la version pour forcer l'invalidation
  var CACHE_PREFIX = "prep_" + VERSION + ":";
  // URL de base de l'API Cloudflare Worker
  var API_BASE_URL = "https://prep-api.carbou.me/api";

  var resizeTimer = null;
  var refreshTimer = null;
  var nextRefreshAt = null;
  var latestGraphState = null;
  var themePreference = "auto";
  var themeMediaQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  // ─── localStorage timed cache ─────────────────────────────────────────────

  function cacheGetTimed(key, maxAgeMs) {
    try {
      var storageKey = CACHE_PREFIX + key;
      var raw = localStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.savedAt !== "number" || !("data" in parsed)) {
        localStorage.removeItem(storageKey);
        return null;
      }
      if (typeof parsed.expiresAt === "number" && Date.now() > parsed.expiresAt) {
        localStorage.removeItem(storageKey);
        return null;
      }
      if (Date.now() - parsed.savedAt > maxAgeMs) {
        localStorage.removeItem(storageKey);
        return null;
      }
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function cacheSetTimed(key, data, expiresAt) {
    try {
      var entry = {
        savedAt: Date.now(),
        data: data,
      };
      if (typeof expiresAt === "number") {
        entry.expiresAt = expiresAt;
      }
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (e) {
      // storage quota exceeded or unavailable — fail silently
    }
  }

  function getTodayCacheExpiry(savedAtMs) {
    var nextAlignedRefresh = nextRefreshDate(new Date(savedAtMs)).getTime();
    return Math.min(nextAlignedRefresh, savedAtMs + TODAY_CACHE_MAX_MS);
  }

  function cleanupLocalCache() {
    try {
      var now = Date.now();
      var keysToDelete = [];

      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i);
        if (typeof key !== "string") {
          continue;
        }

        if (key === THEME_STORAGE_KEY) {
          continue;
        }

        if (!key.startsWith("prep_")) {
          continue;
        }

        // Purge toutes les anciennes versions (ex: prep_v7:*) pour éviter l'accumulation.
        if (!key.startsWith(CACHE_PREFIX)) {
          keysToDelete.push(key);
          continue;
        }

        var raw = localStorage.getItem(key);
        if (!raw) {
          keysToDelete.push(key);
          continue;
        }

        var parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (_e) {
          keysToDelete.push(key);
          continue;
        }

        if (!parsed || typeof parsed.savedAt !== "number" || !("data" in parsed)) {
          keysToDelete.push(key);
          continue;
        }

        if (typeof parsed.expiresAt === "number" && now > parsed.expiresAt) {
          keysToDelete.push(key);
          continue;
        }

        var maxAgeMs = key.indexOf(":day-live:") !== -1 ? TODAY_CACHE_MAX_MS : PAST_CACHE_MS;
        if (now - parsed.savedAt > maxAgeMs) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(function (key) {
        try {
          localStorage.removeItem(key);
        } catch (_e) {
          // ignore remove errors
        }
      });
    } catch (e) {
      // localStorage unavailable — skip cleanup
    }
  }

  function todayRefreshSlotKey(now) {
    var target = nextRefreshDate(now || new Date());
    var p = partsInParis(target);
    return p.year + p.month + p.day + p.hour + p.minute;
  }

  function getSavedThemePreference() {
    try {
      var saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved === "light" || saved === "dark" || saved === "auto" ? saved : "auto";
    } catch (e) {
      return "auto";
    }
  }

  function saveThemePreference(value) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch (e) {
      // localStorage unavailable — fail silently
    }
  }

  function resolveTheme(value) {
    if (value === "dark" || value === "light") {
      return value;
    }
    return themeMediaQuery && themeMediaQuery.matches ? "dark" : "light";
  }

  function getThemePalette() {
    var styles = getComputedStyle(document.body);
    return {
      plotPaper: styles.getPropertyValue("--prep-plot-paper").trim(),
      plotPanel: styles.getPropertyValue("--prep-plot-panel").trim(),
      plotText: styles.getPropertyValue("--prep-plot-text").trim(),
      plotGrid: styles.getPropertyValue("--prep-plot-grid").trim(),
      plotZero: styles.getPropertyValue("--prep-plot-zero").trim(),
      prepPositive: styles.getPropertyValue("--prep-prep-positive").trim(),
      prepNegative: styles.getPropertyValue("--prep-prep-negative").trim(),
      spot: styles.getPropertyValue("--prep-spot").trim(),
      prd3: styles.getPropertyValue("--prep-prd3").trim(),
      estimate: styles.getPropertyValue("--prep-estimate").trim(),
      positiveText: styles.getPropertyValue("--prep-positive-text").trim(),
      negativeText: styles.getPropertyValue("--prep-negative-text").trim(),
    };
  }

  function rerenderGraph() {
    if (!latestGraphState) {
      return;
    }
    renderGraph(
      latestGraphState.day,
      latestGraphState.profileDay,
      latestGraphState.profileLabel,
      latestGraphState.merged,
      latestGraphState.estimateSeries,
      latestGraphState.estimateLast
    );
  }

  function applyThemePreference(value) {
    themePreference = value === "light" || value === "dark" ? value : "auto";
    document.body.setAttribute("data-theme", resolveTheme(themePreference));
    var selector = document.getElementById("theme-mode");
    if (selector) {
      selector.value = themePreference;
    }
    rerenderGraph();
  }

  // ─── Date / Paris timezone helpers ────────────────────────────────────────

  function partsInParis(date) {
    var formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    var parts = formatter.formatToParts(date);
    var out = {};
    parts.forEach(function (part) {
      if (part.type !== "literal") {
        out[part.type] = part.value;
      }
    });
    return out;
  }

  function parisDateString(date) {
    var p = partsInParis(date);
    return p.year + "-" + p.month + "-" + p.day;
  }

  function todayParis() {
    return parisDateString(new Date());
  }

  function slotTime(isoDate) {
    return String(isoDate || "");
  }

  function withDisplayDay(day, time) {
    return day + "T" + time + ":00";
  }

  function addDays(day, offset) {
    var utc = new Date(day + "T00:00:00Z");
    utc.setUTCDate(utc.getUTCDate() + offset);
    return utc.toISOString().slice(0, 10);
  }

  function isValidDay(day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "")) {
      return false;
    }
    var parsed = new Date(day + "T00:00:00Z");
    return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
  }

  function clampDay(day, minDate, maxDate) {
    if (!isValidDay(day)) {
      return maxDate;
    }
    if (day < minDate) {
      return minDate;
    }
    if (day > maxDate) {
      return maxDate;
    }
    return day;
  }

  function getInitialDay(minDate, maxDate) {
    try {
      var url = new URL(window.location.href);
      var fromUrl = url.searchParams.get("day");
      if (isValidDay(fromUrl)) {
        return clampDay(fromUrl, minDate, maxDate);
      }
    } catch (e) {
      // ignore malformed URL/context and fallback to today
    }
    return maxDate;
  }

  function syncDayInUrl(day) {
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.get("day") === day) {
        return;
      }
      url.searchParams.set("day", day);
      history.replaceState(null, "", url.pathname + "?" + url.searchParams.toString() + url.hash);
    } catch (e) {
      // ignore URL sync errors
    }
  }

  function shiftDay(delta) {
    var dayInput = document.getElementById("day");
    var current = dayInput.value || todayParis();
    var next = addDays(current, delta);
    var minDate = dayInput.min || addDays(todayParis(), -LOOKBACK_DAYS);
    var maxDate = dayInput.max || todayParis();

    if (next < minDate) {
      next = minDate;
    }
    if (next > maxDate) {
      next = maxDate;
    }

    dayInput.value = next;
    load();
  }

  function nextRefreshDate(now) {
    var slots = [5, 20, 35, 50];
    for (var i = 0; i < slots.length; i += 1) {
      var candidate = new Date(now.getTime());
      candidate.setMinutes(slots[i], 0, 0);
      if (candidate.getTime() > now.getTime()) {
        return candidate;
      }
    }
    var nextHour = new Date(now.getTime());
    nextHour.setHours(nextHour.getHours() + 1, slots[0], 0, 0);
    return nextHour;
  }

  function setNextRefreshInfo(targetDate) {
    var node = document.getElementById("prep-next-refresh");
    if (!node) {
      return;
    }

    if (!targetDate) {
      node.textContent = "Prochaine actualisation automatique: -";
      return;
    }

    var p = partsInParis(targetDate);
    var nextSlot = p.hour + ":" + p.minute;
    var selectedDay = (document.getElementById("day") || {}).value;
    if (selectedDay && selectedDay !== todayParis()) {
      node.textContent = "Actualisation automatique active uniquement pour aujourd'hui (prochain créneau: " + nextSlot + ")";
      return;
    }

    node.textContent = "Prochaine actualisation automatique: " + nextSlot;
  }

  function scheduleAlignedRefresh() {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    var now = new Date();
    var target = nextRefreshDate(now);
    var delay = Math.max(0, target.getTime() - now.getTime());
    nextRefreshAt = target;
    setNextRefreshInfo(nextRefreshAt);

    refreshTimer = setTimeout(function () {
      if (document.visibilityState === "visible") {
        var selectedDay = document.getElementById("day").value;
        if (selectedDay === todayParis()) {
          load();
        }
      }
      scheduleAlignedRefresh();
    }, delay);
  }

  // ─── PRD3 profile day logic ────────────────────────────────────────────────

  function getPrd3ProfileInfo(day) {
    var today = todayParis();
    var yesterday = addDays(today, -1);

    if (day === today) {
      return {
        profileDay: addDays(day, -2),
        profileLabel: "J-2"
      };
    }

    if (day === yesterday) {
      return {
        profileDay: addDays(day, -1),
        profileLabel: "J-1"
      };
    }

    return {
      profileDay: day,
      profileLabel: "J0"
    };
  }

  // ─── Formatters ────────────────────────────────────────────────────────────

  function toCentsPerKwh(prepEurPerMwh) {
    return prepEurPerMwh * 0.1;
  }

  function sentimentBadge(score) {
    if (typeof score !== "number") {
      return "";
    }
    if (score > 0) {
      return " 🙂";
    }
    if (score < 0) {
      return " ⚠️";
    }
    return "";
  }

  function formatTrend(profile) {
    if (profile === "3+") return "🟢🟢🟢";
    if (profile === "2+") return "🟢🟢";
    if (profile === "1+") return "🟢";
    if (profile === "0") return "⚠️";
    if (profile === "1-") return "⛔️";
    if (profile === "2-") return "⛔️⛔️";
    if (profile === "3-") return "⛔️⛔️⛔️";
    return "⁉️";
  }

  // ─── DOM helpers ──────────────────────────────────────────────────────────

  function setStatus(message, isError) {
    var node = document.getElementById("prep-status");
    node.textContent = message || "";
    node.style.color = isError ? "#b00020" : "inherit";
  }

  function setValueColor(node, tone) {
    node.style.color = tone || "inherit";
  }

  function setLastUpdateNow() {
    var p = partsInParis(new Date());
    document.getElementById("prep-last-update").textContent =
      "Dernière mise à jour de la page: " + p.hour + ":" + p.minute + ":" + p.second;
  }

  function formatDataFetchTime(isoString) {
    if (!isoString) {
      return "-";
    }
    var date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return "-";
    }
    var p = partsInParis(date);
    return p.year + "-" + p.month + "-" + p.day + " " + p.hour + ":" + p.minute + ":" + p.second;
  }

  function yesNo(flag) {
    return flag
      ? "<span style=\"color:#2e7d32;font-weight:700;font-family:monospace;\"> HIT</span>"
      : "<span style=\"color:#c62828;font-weight:700;font-family:monospace;\">MISS</span>";
  }

  function setTimeslotInfo({ prep, spot, prd3 }) {
    document.getElementById("prep-timeslot-info").innerHTML =
      "PREP: " + prep.count + " | " + formatDataFetchTime(prep.fetchedAt) +  " | cache: " + yesNo(prep.fromCache) +
      "<br>SPOT: " + spot.count + " | " + formatDataFetchTime(spot.fetchedAt) + " | cache: " + yesNo(spot.fromCache) +
      "<br>PRD3: " + prd3.count + " | " + formatDataFetchTime(prd3.fetchedAt) + " | cache: " + yesNo(prd3.fromCache);
  }

  // ─── Series data helpers ───────────────────────────────────────────────────

  function sortByTs(a, b) {
    var aSlot = slotTime(a.ts || "");
    var bSlot = slotTime(b.ts || "");
    return aSlot.localeCompare(bSlot);
  }

  function normalizeSeriesRows(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map(function (row) {
        return {
          ts: row && row.ts,
          value: Number(row && row.value),
        };
      })
      .filter(function (entry) {
        return typeof entry.ts === "string" && Number.isFinite(entry.value);
      })
      .sort(sortByTs);
  }

  // ─── API / cache bundle fetch ──────────────────────────────────────────────

  function fetchDayBundle(day) {
    var isToday = day === todayParis();
    var cacheKey = "day:" + day;

    if (isToday) {
      var todayCacheKey = "day-live:" + day + ":slot:" + todayRefreshSlotKey();
      var cachedToday = cacheGetTimed(todayCacheKey, TODAY_CACHE_MAX_MS);
      if (cachedToday) {
        return Promise.resolve({ data: cachedToday, fromCache: true });
      }
    } else {
      var cached = cacheGetTimed(cacheKey, PAST_CACHE_MS);
      if (cached) {
        return Promise.resolve({ data: cached, fromCache: true });
      }
    }

    var url = API_BASE_URL + "/day?day=" + encodeURIComponent(day) + "&v=" + encodeURIComponent(VERSION);
    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("DAY API error: " + response.status);
        }
        return response.json();
      })
      .then(function (payload) {
        var result = payload && typeof payload === "object" ? payload : {};

        if (isToday) {
          cacheSetTimed(todayCacheKey, result, getTodayCacheExpiry(Date.now()));
        } else {
          cacheSetTimed(cacheKey, result);
        }

        return { data: result, fromCache: false };
      });
  }

  // ─── UI updaters ───────────────────────────────────────────────────────────

  function apply3ErlStatus(data) {
    if (!data) {
      var trendNode = document.getElementById("trend");
      var bridageNode = document.getElementById("bridage");
      var bridageCdcNode = document.getElementById("bridage-cdc");
      trendNode.textContent = "Indisponible";
      bridageNode.textContent = "Indisponible";
      bridageCdcNode.textContent = "Indisponible";
      setValueColor(trendNode, "inherit");
      setValueColor(bridageNode, "inherit");
      setValueColor(bridageCdcNode, "inherit");
      return;
    }
    var trendNode = document.getElementById("trend");
    var bridageNode = document.getElementById("bridage");
    var bridageCdcNode = document.getElementById("bridage-cdc");
    var palette = getThemePalette();

    trendNode.textContent = formatTrend(data.PREP_Profile) + " (" + (data.PREP_Profile || "?") + ")";
    bridageNode.textContent = (data.Bridage ? "ON" : "OFF") + sentimentBadge(data.Bridage ? -1 : 1);
    bridageCdcNode.textContent = (data.Bridage_CDC ? "ON" : "OFF") + sentimentBadge(data.Bridage_CDC ? -1 : 1);
    setValueColor(trendNode, "inherit");
    setValueColor(bridageNode, data.Bridage ? palette.negativeText : palette.positiveText);
    setValueColor(bridageCdcNode, data.Bridage_CDC ? palette.negativeText : palette.positiveText);
  }

  function mergeByTimeslot(day, prep, spot, prd3) {
    var prepMap = new Map();
    prep.forEach(function (point) {
      prepMap.set(slotTime(point.ts), point.value);
    });

    var spotMap = new Map();
    spot.forEach(function (point) {
      spotMap.set(slotTime(point.ts), point.value);
    });

    var prd3Map = new Map();
    prd3.forEach(function (point) {
      prd3Map.set(slotTime(point.ts), point.value);
    });

    var keys = [];
    for (var minutes = 0; minutes < 24 * 60; minutes += 15) {
      var hh = String(Math.floor(minutes / 60)).padStart(2, "0");
      var mm = String(minutes % 60).padStart(2, "0");
      keys.push(hh + ":" + mm);
    }
    keys.sort();

    return keys.map(function (key) {
      return {
        key: withDisplayDay(day, key),
        prep: prepMap.has(key) ? prepMap.get(key) : null,
        spot: spotMap.has(key) ? spotMap.get(key) : null,
        prd3: prd3Map.has(key) ? prd3Map.get(key) : null,
      };
    });
  }

  function estimateDailyPrepSeries(merged) {
    var weighted = 0;
    var factors = 0;
    var series = merged.map(function (point) {
      if (typeof point.prep === "number" && typeof point.prd3 === "number") {
        weighted += point.prep * point.prd3;
        factors += point.prd3;
      }
      if (!factors) {
        return null;
      }
      return weighted / factors;
    });

    var last = null;
    for (var i = series.length - 1; i >= 0; i--) {
      if (typeof series[i] === "number") {
        last = series[i];
        break;
      }
    }

    return {
      series: series,
      last: last,
    };
  }

  // ─── Plotly graph ──────────────────────────────────────────────────────────

  function renderGraph(day, profileDay, profileLabel, merged, estimateSeriesEurPerMwh, estimateLastEurPerMwh) {
    var SLOT_MS = 15 * 60 * 1000;
    var BAR_WIDTH_MS = SLOT_MS * 0.85;
    var BAR_X_SHIFT_MS = BAR_WIDTH_MS / 2;
    var x = merged.map(function (p) {
      return p.key;
    });
    var xBars = x.map(function (timestamp) {
      return new Date(timestamp).getTime() + BAR_X_SHIFT_MS;
    });

    var isMobile = window.matchMedia("(max-width: 640px)").matches;
    var palette = getThemePalette();

    var prepValues = merged.map(function (p) {
      if (typeof p.prep !== "number") return null;
      return toCentsPerKwh(p.prep);
    });
    var prepColors = merged.map(function (p) {
      return typeof p.prep === "number" && p.prep < 0 ? palette.prepNegative : palette.prepPositive;
    });

    var prd3Values = merged.map(function (p) {
      return typeof p.prd3 === "number" ? p.prd3 : null;
    });

    var spotValues = merged.map(function (p) {
      return typeof p.spot === "number" ? toCentsPerKwh(p.spot) : null;
    });

    var estimateCentsSeries = estimateSeriesEurPerMwh.map(function (value) {
      return typeof value === "number" ? toCentsPerKwh(value) : null;
    });
    var estimateCents = typeof estimateLastEurPerMwh === "number" ? toCentsPerKwh(estimateLastEurPerMwh) : null;

    var traces = [
      {
        type: "bar",
        x: xBars,
        y: prepValues,
        name: "PRE+",
        marker: { color: prepColors },
        width: BAR_WIDTH_MS,
        hovertemplate: "PRE+: %{y:.1f}<extra></extra>",
        yaxis: "y",
      },
      {
        type: "scatter",
        mode: "lines",
        x: x,
        y: prd3Values,
        name: "PRD3",
        line: { color: palette.prd3, width: isMobile ? 1 : 2, shape: "hv" },
        hovertemplate: "PRD3: %{y:.1f}<extra></extra>",
        yaxis: "y2",
      },
      {
        type: "scatter",
        mode: "lines",
        x: x,
        y: spotValues,
        name: "SPOT",
        line: { color: palette.spot, width: isMobile ? 1 : 2, shape: "hv" },
        hovertemplate: "SPOT: %{y:.1f}<extra></extra>",
        yaxis: "y",
      },
    ];

    if (typeof estimateCents === "number") {
      traces.push({
        type: "scatter",
        mode: "lines",
        x: x,
        y: estimateCentsSeries,
        name: "PRE+ du jour estimé ",
        line: { color: palette.estimate, width: isMobile ? 2 : 4 },
        hovertemplate: "Est: %{y:.1f}<extra></extra>",
        yaxis: "y",
      });
    }

    var layout = {
      barmode: "overlay",
      bargap: 0.15,
      hovermode: "x unified",
      paper_bgcolor: palette.plotPaper,
      plot_bgcolor: palette.plotPanel,
      font: { color: palette.plotText },
      legend: {
        orientation: "h",
        x: 0.5,
        xanchor: "center",
        y: 0.94,
        yanchor: "bottom",
      },
      margin: { t: 0, r: 40, l: 40, b: 20 },
      xaxis: {
        type: "date",
        tickformat: "%H:%M",
        automargin: true,
        color: palette.plotText,
        gridcolor: palette.plotGrid,
      },
      yaxis: {
        title: "c€/kWh",
        automargin: true,
        zeroline: true,
        zerolinecolor: palette.plotZero,
        gridcolor: palette.plotGrid,
        color: palette.plotText,
        domain: [0, 0.86],
      },
      yaxis2: {
        title: "Facteur PRD3",
        automargin: true,
        overlaying: "y",
        side: "right",
        rangemode: "tozero",
        gridcolor: palette.plotGrid,
        color: palette.plotText,
      },
    };

    var config = {
      responsive: true,
      displaylogo: false,
      displayModeBar: true,
      displayModeBar: true,
    };

    Plotly.newPlot("prep-plot", traces, layout, config);
  }

  function resizeGraph() {
    var plot = document.getElementById("prep-plot");
    if (!plot || !plot.data) {
      return;
    }
    Plotly.Plots.resize(plot);
  }

  function setEstimationValue(estimateEurPerMwh) {
    var node = document.getElementById("prep-estimation");
    if (typeof estimateEurPerMwh !== "number") {
      node.textContent = "Indisponible";
      setValueColor(node, "inherit");
      return;
    }
    var cents = toCentsPerKwh(estimateEurPerMwh);
    var palette = getThemePalette();
    node.textContent = cents.toFixed(2) + " c€/kWh" + sentimentBadge(cents);
    setValueColor(node, cents < 0 ? palette.negativeText : cents > 0 ? palette.positiveText : "inherit");
  }

  // ─── Main load / init ──────────────────────────────────────────────────────

  function load() {
    var dayInput = document.getElementById("day");
    var minDate = dayInput.min || addDays(todayParis(), -LOOKBACK_DAYS);
    var maxDate = dayInput.max || todayParis();
    var day = clampDay(dayInput.value, minDate, maxDate);
    dayInput.value = day;
    setNextRefreshInfo(nextRefreshAt);
    if (!day) {
      return;
    }

    syncDayInUrl(day);

    var profileInfo = getPrd3ProfileInfo(day);
    var profileDay = profileInfo.profileDay;
    var profileLabel = profileInfo.profileLabel;

    setStatus("Chargement des données pour " + day + " avec le profil PRD3 " + profileLabel + " (" + profileDay + ")...");

    fetchDayBundle(day)
      .then(function (bundleResult) {
        var bundle = bundleResult.data || {};
        function normalizeSeriesBundle(series) {
          return Array.isArray(series)
            ? { rows: normalizeSeriesRows(series), fetchedAt: null }
            : { rows: normalizeSeriesRows(series && series.rows), fetchedAt: (series && series.fetchedAt) || null };
        }
        var prepSeries = normalizeSeriesBundle(bundle.prep);
        var spotSeries = normalizeSeriesBundle(bundle.spot);
        var prd3Series = normalizeSeriesBundle(bundle.prd3);
        var prepRows = prepSeries.rows;
        var spotRows = spotSeries.rows;
        var prd3Rows = prd3Series.rows;
        var effectiveProfileDay = bundle.profileDay || profileDay;
        var effectiveProfileLabel = bundle.profileLabel || profileLabel;
        var prepFetchedAt = prepSeries.fetchedAt;
        var spotFetchedAt = spotSeries.fetchedAt;
        var prd3FetchedAt = prd3Series.fetchedAt;

        apply3ErlStatus(bundle.erl || null);

        var merged = mergeByTimeslot(day, prepRows, spotRows, prd3Rows);
        var estimate = estimateDailyPrepSeries(merged);
        latestGraphState = {
          day: day,
          profileDay: effectiveProfileDay,
          profileLabel: effectiveProfileLabel,
          merged: merged,
          estimateSeries: estimate.series,
          estimateLast: estimate.last,
        };
        setEstimationValue(estimate.last);
        renderGraph(day, effectiveProfileDay, effectiveProfileLabel, merged, estimate.series, estimate.last);
        setLastUpdateNow();
        setTimeslotInfo({
          prep: { count: prepRows.length, fromCache: bundleResult.fromCache, fetchedAt: prepFetchedAt },
          spot: { count: spotRows.length, fromCache: bundleResult.fromCache, fetchedAt: spotFetchedAt },
          prd3: { count: prd3Rows.length, fromCache: bundleResult.fromCache, fetchedAt: prd3FetchedAt },
        });
        setStatus("");
      })
      .catch(function (error) {
        setStatus(error.message || "Échec du chargement des données", true);
      });
  }

  function init() {
    document.body.classList.add("prep-page");
    cleanupLocalCache();
    applyThemePreference(getSavedThemePreference());

    var dayInput = document.getElementById("day");
    var maxDate = todayParis();
    var minDate = addDays(maxDate, -LOOKBACK_DAYS);
    dayInput.min = minDate;
    dayInput.max = maxDate;
    dayInput.value = getInitialDay(minDate, maxDate);
    document.getElementById("theme-mode").addEventListener("change", function (event) {
      var value = event.target.value;
      saveThemePreference(value);
      applyThemePreference(value);
    });
    if (themeMediaQuery) {
      var onThemeMediaChange = function () {
        if (themePreference === "auto") {
          applyThemePreference("auto");
        }
      };
      if (typeof themeMediaQuery.addEventListener === "function") {
        themeMediaQuery.addEventListener("change", onThemeMediaChange);
      } else if (typeof themeMediaQuery.addListener === "function") {
        themeMediaQuery.addListener(onThemeMediaChange);
      }
    }

    document.getElementById("today").addEventListener("click", function () {
      var dayInput = document.getElementById("day");
      dayInput.value = todayParis();
      load();
    });
    dayInput.addEventListener("change", load);
    document.getElementById("prev-day").addEventListener("click", function () {
      shiftDay(-1);
    });
    document.getElementById("next-day").addEventListener("click", function () {
      shiftDay(1);
    });
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizeGraph, 120);
    });

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") {
        return;
      }
      var selectedDay = document.getElementById("day").value;
      if (selectedDay === todayParis()) {
        load();
      }
      scheduleAlignedRefresh();
    });

    scheduleAlignedRefresh();

    load();
  }

  init();
})();
