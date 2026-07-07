(function () {

  // Version du cache : à incrémenter pour invalider toutes les entrées localStorage existantes (dans le navigateur)
  var VERSION = "v24";
  // Fuseau horaire utilisé pour l'affichage des dates et heures
  var TIMEZONE = "Europe/Paris";
  // Nombre de jours affichés dans le graphe (à partir d'aujourd'hui en remontant)
  var LOOKBACK_DAYS = 30;
  // Durée maximale du cache local (dans le navigateur) pour les données du jour (en ms) — rafraîchi au plus toutes les 15 min
  var TODAY_CACHE_MAX_MS = 15 * 60 * 1000;
  // Durée du cache local (dans le navigateur) pour les jours passés (en ms) — données immuables, conservées 24 h
  var PAST_CACHE_MS = 24 * 60 * 60 * 1000;
  // Durée du cache local (dans le navigateur) pour les données 3ERL (en ms) — indépendant du bundle jour, rafraîchi toutes les 5 min
  var ERL_CACHE_MS = 1 * 60 * 1000;
  // Clé localStorage utilisée pour mémoriser la préférence de thème (light / dark / auto)
  var THEME_STORAGE_KEY = "prep_theme";
  // Préfixe de toutes les entrées de cache localStorage — inclut la version pour forcer l'invalidation
  var CACHE_PREFIX = "prep_" + VERSION + ":";
  // URL de base de l'API Cloudflare Worker
  var API_BASE_URL = "https://prep-api.carbou.me/api";

  var resizeTimer = null;
  var refreshTimer = null;
  var erlRefreshTimer = null;
  var nextRefreshAt = null;
  var latestGraphState = null;
  var latestErlResult = null;
  var latestErlDay = null;
  var latestTimeslotInfo = null;
  var autoFollowToday = true;
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

        var maxAgeMs = key.indexOf(":erl:") !== -1 ? ERL_CACHE_MS : key.indexOf(":day-live:") !== -1 ? TODAY_CACHE_MAX_MS : PAST_CACHE_MS;
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

  function syncDayInputBounds(dayInput) {
    var maxDate = todayParis();
    var minDate = addDays(maxDate, -LOOKBACK_DAYS);
    dayInput.min = minDate;
    dayInput.max = maxDate;
    return {
      minDate: minDate,
      maxDate: maxDate,
    };
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
      var isToday = day === todayParis();
      var current = url.searchParams.get("day");
      if (isToday) {
        if (!current) {
          return;
        }
        url.searchParams.delete("day");
        var search = url.searchParams.toString();
        history.replaceState(null, "", url.pathname + (search ? "?" + search : "") + url.hash);
      } else {
        if (current === day) {
          return;
        }
        url.searchParams.set("day", day);
        history.replaceState(null, "", url.pathname + "?" + url.searchParams.toString() + url.hash);
      }
    } catch (e) {
      // ignore URL sync errors
    }
  }

  function shiftDay(delta) {
    var dayInput = document.getElementById("day");
    var bounds = syncDayInputBounds(dayInput);
    var current = dayInput.value || todayParis();
    var next = addDays(current, delta);
    var minDate = bounds.minDate;
    var maxDate = bounds.maxDate;

    if (next < minDate) {
      next = minDate;
    }
    if (next > maxDate) {
      next = maxDate;
    }

    dayInput.value = next;
    autoFollowToday = next >= todayParis();
    load();
  }

  function updateAutoFollowFromDay(day) {
    autoFollowToday = day >= todayParis();
  }

  function refreshSelectedDayIfNeeded() {
    var dayInput = document.getElementById("day");
    syncDayInputBounds(dayInput);
    var selectedDay = dayInput.value;
    var today = todayParis();

    if (autoFollowToday && selectedDay !== today) {
      dayInput.value = today;
      load();
      return;
    }

    if (selectedDay === today) {
      load();
    }
  }

  // Refresh only the 3ERL status (independent 5-min cache, not tied to PRE+ slots)
  function refresh3ErlIfNeeded() {
    var dayInput = document.getElementById("day");
    var selectedDay = dayInput ? dayInput.value : null;
    if (!selectedDay || selectedDay !== todayParis()) {
      return;
    }
    fetch3ErlData().then(function (erlResult) {
      var erl = erlResult.data;
      if (!erl) return;
      latestErlResult = erlResult;
      latestErlDay = selectedDay;
      apply3ErlStatus(erl.data ? erl.data : null);
      var erlInfo = {
        status: erl.cache === "ERROR" ? "Erreur" : (erl.data ? "OK" : "Vide"),
        fromCache: erlResult.fromCache,
        fromWorkerCache: erl.cache === "HIT",
        fetchedAt: erl.fetchedAt,
      };
      if (latestTimeslotInfo) {
        latestTimeslotInfo.erl = erlInfo;
        setTimeslotInfo(latestTimeslotInfo);
      } else {
        setTimeslotInfo({
          prep: { count: "-", fromCache: false, fromWorkerCache: false, fetchedAt: null },
          spot: { count: "-", fromCache: false, fromWorkerCache: false, fetchedAt: null },
          prd3: { count: "-", fromCache: false, fromWorkerCache: false, fetchedAt: null },
          erl: erlInfo,
        });
      }
    });
  }

  function scheduleErlRefresh() {
    if (erlRefreshTimer) {
      clearTimeout(erlRefreshTimer);
    }
    erlRefreshTimer = setTimeout(function () {
      if (document.visibilityState === "visible") {
        refresh3ErlIfNeeded();
      }
      scheduleErlRefresh();
    }, ERL_CACHE_MS);
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
        refreshSelectedDayIfNeeded();
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

  function setSourceWarnings(bundle, erlError) {
    var node = document.getElementById("prep-source-warnings");
    var sources = [
      { key: "prep", label: "PRE+ (RTE)" },
      { key: "spot", label: "SPOT (RTE eco2mix)" },
      { key: "prd3", label: "PRD3 (Enedis)" },
    ];
    var html = "";
    sources.forEach(function (s) {
      var series = bundle && bundle[s.key];
      if (series && series.cache === "ERROR") {
        var detail = series.error ? " (" + series.error + ")" : "";
        html += "<div class=\"prep-source-warning\">&#9888; Source " + s.label + " indisponible" + detail + "</div>";
      }
    });
    if (erlError) {
      var erlDetail = erlError ? " (" + erlError + ")" : "";
      html += "<div class=\"prep-source-warning\">&#9888; Source 3ERL indisponible" + erlDetail + "</div>";
    }
    node.innerHTML = html;
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

  // Build a cache-status label that distinguishes the origin of the HIT:
  //   HIT (local)  → served from the browser localStorage cache
  //   HIT (worker) → fetched from the API, but the worker served it from its CF cache
  //   MISS         → fetched from the API with a worker cache MISS (fresh upstream)
  // fromLocal: truthy when the browser served a cached entry (no API call)
  // fromWorker: truthy when the worker reported a cache HIT in its response
  function cacheLabel(fromLocal, fromWorker) {
    if (fromLocal) {
      return "<span style=\"color:#2e7d32;font-weight:700;font-family:monospace;\">HIT (local)</span>";
    }
    if (fromWorker) {
      return "<span style=\"color:#2e7d32;font-weight:700;font-family:monospace;\">HIT (worker)</span>";
    }
    return "<span style=\"color:#c62828;font-weight:700;font-family:monospace;\">MISS</span>";
  }

  function setTimeslotInfo({ prep, spot, prd3, erl }) {
    document.getElementById("prep-timeslot-info").innerHTML =
      "PREP: " + prep.count + " | " + formatDataFetchTime(prep.fetchedAt) + " | cache: " + cacheLabel(prep.fromCache, prep.fromWorkerCache) +
      "<br>SPOT: " + spot.count + " | " + formatDataFetchTime(spot.fetchedAt) + " | cache: " + cacheLabel(spot.fromCache, spot.fromWorkerCache) +
      "<br>PRD3: " + prd3.count + " | " + formatDataFetchTime(prd3.fetchedAt) + " | cache: " + cacheLabel(prd3.fromCache, prd3.fromWorkerCache) +
      "<br>3ERL: " + (erl ? erl.status + " | " + formatDataFetchTime(erl.fetchedAt) + " | cache: " + cacheLabel(erl.fromCache, erl.fromWorkerCache) : "-");
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

  function fetch3ErlData() {
    var cacheKey = "erl:today";
    var cached = cacheGetTimed(cacheKey, ERL_CACHE_MS);
    if (cached) {
      return Promise.resolve({ data: cached, fromCache: true });
    }

    var url = API_BASE_URL + "/erl?v=" + encodeURIComponent(VERSION);
    return fetch(url)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("API error: " + response.status);
        }
        return response.json();
      })
      .then(function (payload) {
        var result = payload && typeof payload === "object" ? payload : {};
        cacheSetTimed(cacheKey, result, Date.now() + ERL_CACHE_MS);
        return { data: result, fromCache: false };
      })
      .catch(function () {
        return { data: null, fromCache: false };
      });
  }

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
          if (response.status === 403) {
            throw new Error("Accès refusé (403) : cette API est réservée aux visiteurs situés en France. Si vous êtes à l'étranger, utilisez un VPN français pour accéder à ces données.");
          }
          throw new Error("API error: " + response.status);
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
      var bridageNode = document.getElementById("bridage-aci");
      var bridageCdcNode = document.getElementById("bridage-acc");
      trendNode.textContent = "Indisponible";
      bridageNode.textContent = "Indisponible";
      bridageCdcNode.textContent = "Indisponible";
      setValueColor(trendNode, "inherit");
      setValueColor(bridageNode, "inherit");
      setValueColor(bridageCdcNode, "inherit");
      return;
    }
    var trendNode = document.getElementById("trend");
    var bridageNode = document.getElementById("bridage-aci");
    var bridageCdcNode = document.getElementById("bridage-acc");
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

    // Break-even PRE: what constant PRE value applied to all remaining slots
    // (weighted by their PRD3) would bring the daily weighted average to 0?
    // Formula: breakEven = -weighted / remainingPrd3
    // Only meaningful when the current daily estimate is positive and future slots remain.
    var lastPrepIdx = -1;
    for (var j = merged.length - 1; j >= 0; j--) {
      if (typeof merged[j].prep === "number") {
        lastPrepIdx = j;
        break;
      }
    }
    var remainingPrd3 = 0;
    for (var j = lastPrepIdx + 1; j < merged.length; j++) {
      if (typeof merged[j].prd3 === "number") {
        remainingPrd3 += merged[j].prd3;
      }
    }
    var breakEven = null;
    if (typeof last === "number" && last > 0 && remainingPrd3 > 0) {
      breakEven = -weighted / remainingPrd3;
    }

    return {
      series: series,
      last: last,
      breakEven: breakEven,
      trend: estimationTrend(series, merged),
    };
  }

  // Returns ↑, ↓ or → based on the linear regression slope of the last
  // TREND_WINDOW slots where a real PRE+ value was received (ignoring the
  // frozen plateau that fills future slots with the last cumulative average).
  // Uses the cumulative estimation value at each of those slots (oldest→newest,
  // x=0..N-1) so a declining series yields a negative slope.
  function estimationTrend(series, merged) {
    var TREND_WINDOW = 8;
    var THRESHOLD = 1.5; // €/MWh per slot — ≈ ±1 c€/kWh over 8 slots before triggering
    // Collect latest-first, then reverse so index 0 = oldest
    var yVals = [];
    for (var i = series.length - 1; i >= 0 && yVals.length < TREND_WINDOW; i--) {
      if (typeof series[i] === "number" && typeof merged[i].prep === "number") {
        yVals.push(series[i]);
      }
    }
    yVals.reverse(); // oldest first → x=0 is oldest, x=N-1 is latest
    var n = yVals.length;
    if (n < 2) return "→";
    var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (var k = 0; k < n; k++) {
      sumX += k;
      sumY += yVals[k];
      sumXY += k * yVals[k];
      sumXX += k * k;
    }
    var denom = n * sumXX - sumX * sumX;
    if (!denom) return "→";
    var slope = (n * sumXY - sumX * sumY) / denom;
    if (slope > THRESHOLD) return "↑";
    if (slope < -THRESHOLD) return "↓";
    return "→";
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
        name: "Estimation du jour",
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

  function setEstimationValue(estimateEurPerMwh, trend) {
    var node = document.getElementById("prep-estimation");
    if (typeof estimateEurPerMwh !== "number") {
      node.textContent = "Indisponible";
      setValueColor(node, "inherit");
      return;
    }
    var cents = toCentsPerKwh(estimateEurPerMwh);
    var palette = getThemePalette();
    var priceColor = cents < 0 ? palette.negativeText : cents > 0 ? palette.positiveText : "inherit";
    var arrowColor = trend === "↑" ? palette.positiveText : trend === "↓" ? palette.negativeText : "inherit";
    var arrowHtml = trend ? ' <span style="color:' + arrowColor + '">' + trend + "</span>" : "";
    node.innerHTML = '<span style="color:' + priceColor + '">' + cents.toFixed(2) + "</span>" + arrowHtml;
    setValueColor(node, "inherit");
  }

  // Returns a risk level 0–3 based on how close the break-even PRE is to 0.
  // cents is always negative when this is called.
  // Calibrated against realistic French PRE+ range: below -3 c€/kWh is rare, below -10 is near-impossible.
  // Thresholds (c€/kWh): > -3 → 3, > -5 → 2, > -10 → 1, else → 0
  // Returns risk 0–3 for the break-even indicator.
  // breakEvenCents: what constant PRE+ on remaining slots would flip the daily
  //   average to 0 (always negative when the estimate is positive).
  // lastCents: current daily estimate (always positive when this is called).
  //
  // Key insight: remainingFraction = last / (last - breakEven)
  //   tells us how much PRD3-weighted time is still ahead.
  // Thresholds scale with remainingFraction so the indicator naturally becomes
  // more lenient late in the day (fewer / lower-PRD3 slots remaining).
  // Full sensitivity (scale=1) when >= 50% of the day remains; proportionally
  // reduced after that, reaching 0 when no solar slots are left.
  function breakEvenRisk(breakEvenCents, lastCents, trend) {
    var rf = lastCents / (lastCents - breakEvenCents); // remainingFraction ∈ (0,1)
    var scale = Math.min(1, rf * 2);
    var t3 = -3 * scale;
    var t2 = -5 * scale;
    var t1 = -10 * scale;
    var risk;
    if (breakEvenCents > t3) risk = 3;
    else if (breakEvenCents > t2) risk = 2;
    else if (breakEvenCents > t1) risk = 1;
    else risk = 0;
    // A rising trend reduces the probability of a negative flip: lower risk by 1
    if (trend === "\u2191" && risk > 0) risk -= 1;
    return risk;
  }

function setBreakEvenValue(breakEvenEurPerMwh, lastEurPerMwh, trend) {
    var node = document.getElementById("prep-breakeven");
    if (typeof breakEvenEurPerMwh !== "number") {
      node.textContent = "-";
      setValueColor(node, "inherit");
      return;
    }
    var cents = toCentsPerKwh(breakEvenEurPerMwh);
    var lastCents = toCentsPerKwh(lastEurPerMwh);
    var palette = getThemePalette();
    var risk = breakEvenRisk(cents, lastCents, trend);
    // Show only icons: ✅ when safe, ⚠️×1-3 otherwise
    node.textContent = risk === 0 ? "✅" : "⚠️".repeat(risk);
    setValueColor(node, risk === 0 ? palette.positiveText : palette.negativeText);
  }
  function findLastPrepPoint(merged) {
    for (var i = merged.length - 1; i >= 0; i -= 1) {
      if (typeof merged[i].prep === "number") {
        return merged[i];
      }
    }
    return null;
  }

  function quarterHourRangeLabel(timestamp) {
    var slot = String(timestamp || "").slice(11, 16);
    if (!/^\d{2}:\d{2}$/.test(slot)) {
      return "-";
    }

    var parts = slot.split(":");
    var hour = Number(parts[0]);
    var minute = Number(parts[1]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return "-";
    }

    var endTotalMinutes = hour * 60 + minute + 15;
    var endHour = String(Math.floor(endTotalMinutes / 60) % 24).padStart(2, "0");
    var endMinute = String(endTotalMinutes % 60).padStart(2, "0");

    return parts[0] + "h" + parts[1] + "-" + endHour + "h" + endMinute;
  }

  function setLastPrepValue(point) {
    var node = document.getElementById("prep-last");
    if (!point || typeof point.prep !== "number") {
      node.textContent = "Indisponible";
      setValueColor(node, "inherit");
      return;
    }

    var cents = toCentsPerKwh(point.prep);
    var palette = getThemePalette();
    node.textContent = quarterHourRangeLabel(point.key) + ": " + cents.toFixed(2);
    setValueColor(node, cents < 0 ? palette.negativeText : cents > 0 ? palette.positiveText : "inherit");
  }

  // ─── Main load / init ──────────────────────────────────────────────────────

  function load() {
    var dayInput = document.getElementById("day");
    var bounds = syncDayInputBounds(dayInput);
    var minDate = bounds.minDate;
    var maxDate = bounds.maxDate;
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
    setSourceWarnings({}, null);

    var isToday = day === todayParis();

    Promise.all([
      fetchDayBundle(day),
      isToday ? fetch3ErlData() : Promise.resolve({ data: null, fromCache: false }),
    ])
      .then(function (results) {
        var bundleResult = results[0];
        var erlResult = results[1];
        var bundle = bundleResult.data || {};
        var erl = erlResult.data;
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

        apply3ErlStatus(erl && erl.data ? erl.data : null);

        var merged = mergeByTimeslot(day, prepRows, spotRows, prd3Rows);
        setLastPrepValue(findLastPrepPoint(merged));
        var estimate = estimateDailyPrepSeries(merged);
        latestGraphState = {
          day: day,
          profileDay: effectiveProfileDay,
          profileLabel: effectiveProfileLabel,
          merged: merged,
          estimateSeries: estimate.series,
          estimateLast: estimate.last,
        };
        setEstimationValue(estimate.last, estimate.trend);
        setBreakEvenValue(estimate.breakEven, estimate.last, estimate.trend);
        renderGraph(day, effectiveProfileDay, effectiveProfileLabel, merged, estimate.series, estimate.last);
        setLastUpdateNow();
        // Worker cache status for each series: prep/spot/prd3 each carry their own
        // cache: "HIT"|"MISS" flag from the worker. 3ERL has no worker cache so it
        // is always MISS (or ERROR when the upstream fetch failed).
        var prepWorkerCache = bundle.prep && bundle.prep.cache === "HIT";
        var spotWorkerCache = bundle.spot && bundle.spot.cache === "HIT";
        var prd3WorkerCache = bundle.prd3 && bundle.prd3.cache === "HIT";
        var erlWorkerCache = erl && erl.cache === "HIT";
        var timeslotInfo = {
          prep: { count: prepRows.length, fromCache: bundleResult.fromCache, fromWorkerCache: prepWorkerCache, fetchedAt: prepFetchedAt },
          spot: { count: spotRows.length, fromCache: bundleResult.fromCache, fromWorkerCache: spotWorkerCache, fetchedAt: spotFetchedAt },
          prd3: { count: prd3Rows.length, fromCache: bundleResult.fromCache, fromWorkerCache: prd3WorkerCache, fetchedAt: prd3FetchedAt },
          erl: isToday && erl ? {
            status: erl.cache === "ERROR" ? "Erreur" : (erl.data ? "OK" : "Vide"),
            fromCache: erlResult.fromCache,
            fromWorkerCache: erlWorkerCache,
            fetchedAt: erl.fetchedAt,
          } : null,
        };
        latestTimeslotInfo = timeslotInfo;
        setTimeslotInfo(timeslotInfo);
        setSourceWarnings(bundle, erl && erl.cache === "ERROR" ? erl.error : null);
        setStatus("");
      })
      .catch(function (error) {
        setSourceWarnings({}, null);
        setStatus(error.message || "Échec du chargement des données", true);
      });
  }

  function init() {
    document.body.classList.add("prep-page");
    cleanupLocalCache();
    applyThemePreference(getSavedThemePreference());

    var dayInput = document.getElementById("day");
    var bounds = syncDayInputBounds(dayInput);
    var maxDate = bounds.maxDate;
    var minDate = bounds.minDate;
    dayInput.value = getInitialDay(minDate, maxDate);
    updateAutoFollowFromDay(dayInput.value);
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
      syncDayInputBounds(dayInput);
      dayInput.value = todayParis();
      autoFollowToday = true;
      load();
    });
    dayInput.addEventListener("change", function () {
      updateAutoFollowFromDay(dayInput.value);
      load();
    });
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
      refreshSelectedDayIfNeeded();
      scheduleAlignedRefresh();
      refresh3ErlIfNeeded();
      scheduleErlRefresh();
    });

    scheduleAlignedRefresh();
    scheduleErlRefresh();

    load();
  }

  init();
})();

document.querySelectorAll(".prep-card-info").forEach(function (link) {
  link.addEventListener("click", function (e) {
    e.preventDefault();
    var target = document.querySelector(this.getAttribute("href"));
    if (target) target.scrollIntoView({ behavior: "smooth" });
  });
});
