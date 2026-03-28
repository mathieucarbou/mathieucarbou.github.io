---
title: PRE+ x PRD3 Daily View
permalink: /prep/
---

<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>

<style>
  body.prep-page .wrapper {
    width: min(1800px, 96vw);
  }

  body.prep-page header {
    display: none;
  }

  body.prep-page section {
    width: 100%;
    float: none;
  }

  #prep-page-title {
    text-align: center;
  }

  .prep-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .prep-control-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
  }

  .prep-control-row input,
  .prep-control-row select,
  .prep-control-row button {
    font: inherit;
    padding: 0.35rem 0.55rem;
  }

  .prep-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .prep-card {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 0.6rem 0.75rem;
  }

  .prep-label {
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .prep-value {
    font-weight: 700;
    margin-top: 0.2rem;
  }

  #prep-plot {
    width: 100%;
    height: 520px;
    min-height: 520px;
    max-width: 100%;
    overflow: hidden;
  }

  #prep-plot .modebar {
    top: 105px !important;
    right: 8px !important;
    z-index: 20;
  }

  #prep-footer {
    margin-top: 0.6rem;
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    font-size: 0.85rem;
    opacity: 0.8;
    min-height: 1.2rem;
    text-align: center;
  }

  #prep-footer span {
    white-space: nowrap;
  }

  #prep-footer button {
    font: inherit;
    font-size: 0.8rem;
    padding: 0.15rem 0.45rem;
    cursor: pointer;
    opacity: 1;
  }

  @media screen and (max-width: 960px) {
    body.prep-page .wrapper {
      width: 96vw;
    }

    body.prep-page header,
    body.prep-page section {
      width: 100%;
      float: none;
    }
  }

  @media screen and (max-width: 640px) {
    #prep-plot {
      height: 640px;
      min-height: 640px;
    }

    #prep-plot .modebar {
      top: 200px !important;
      right: 6px !important;
      transform: scale(0.9);
      transform-origin: top right;
    }
  }
</style>

<h2 id="prep-page-title">PRE+ x PRD3 Daily View</h2>

<div class="prep-meta">
  <div class="prep-card">
    <div class="prep-label">3ERL Trend</div>
    <div id="trend" class="prep-value">-</div>
  </div>
  <div class="prep-card">
    <div class="prep-label">3ERL Bridage</div>
    <div id="bridage" class="prep-value">-</div>
  </div>
  <div class="prep-card">
    <div class="prep-label">3ERL Bridage CDC</div>
    <div id="bridage-cdc" class="prep-value">-</div>
  </div>
  <div class="prep-card">
    <div class="prep-label">PRE+ Daily Estimation</div>
    <div id="prep-estimation" class="prep-value">-</div>
  </div>
</div>

<div class="prep-controls">
  <div class="prep-control-row">
    <label for="day">Day:</label>
    <button id="prev-day" type="button" aria-label="Previous day">←</button>
    <input id="day" type="date" />
    <button id="next-day" type="button" aria-label="Next day">→</button>
    <button id="today" type="button">Today</button>
  </div>
</div>

<div id="prep-status"></div>
<div id="prep-plot"></div>
<div id="prep-footer">
  <div id="prep-last-update">Dernière mise à jour: -</div>
  <div id="prep-timeslot-info"></div>
  <div><button id="prep-clear-cache" type="button">Clear cache</button></div>
</div>

<script>
  (function () {
    var VERSION = "v8";
    var TIMEZONE = "Europe/Paris";
    var LOOKBACK_DAYS = 30;
    var AUTO_REFRESH_MS = 5 * 60 * 1000;
    var PREP_TODAY_CACHE_MS = 5 * 60 * 1000;
    var PAST_CACHE_MS = 24 * 60 * 60 * 1000;
    var CACHE_PREFIX = "prep_" + VERSION + ":";
    var API_BASE_URL = "https://prep-api-1.carbou.me/api";
    var resizeTimer = null;

    // ─── localStorage timed cache ─────────────────────────────────────────────

    function cacheGetTimed(key, maxAgeMs) {
      try {
        var raw = localStorage.getItem(CACHE_PREFIX + key);
        if (!raw) {
          return null;
        }
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.savedAt !== "number" || !("data" in parsed)) {
          return null;
        }
        if (Date.now() - parsed.savedAt > maxAgeMs) {
          return null;
        }
        return parsed.data;
      } catch (e) {
        return null;
      }
    }

    function cacheSetTimed(key, data) {
      try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
          savedAt: Date.now(),
          data: data,
        }));
      } catch (e) {
        // storage quota exceeded or unavailable — fail silently
      }
    }

    function clearPrepCache() {
      try {
        var keysToRemove = [];
        for (var i = 0; i < localStorage.length; i += 1) {
          var key = localStorage.key(i);
          if (key && key.indexOf(CACHE_PREFIX) === 0) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(function (key) {
          localStorage.removeItem(key);
        });
      } catch (e) {
        // localStorage unavailable — fail silently
      }
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

    function setLastUpdateNow() {
      var p = partsInParis(new Date());
      document.getElementById("prep-last-update").textContent =
        "Last page update: " + p.hour + ":" + p.minute + ":" + p.second;
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
        ? "<span style=\"color:#2e7d32;font-weight:700;\">yes</span>"
        : "<span style=\"color:#c62828;font-weight:700;\">no</span>";
    }

    function setTimeslotInfo({ prep, spot, prd3 }) {
      document.getElementById("prep-timeslot-info").innerHTML =
        "PREP: " + prep.count + " | local cache: " + yesNo(prep.fromCache) + " | worker: " + formatDataFetchTime(prep.fetchedAt) +
        "<br>SPOT: " + spot.count + " | local cache: " + yesNo(spot.fromCache) + " | worker: " + formatDataFetchTime(spot.fetchedAt) +
        "<br>PRD3: " + prd3.count + " | local cache: " + yesNo(prd3.fromCache) + " | worker: " + formatDataFetchTime(prd3.fetchedAt);
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
        var cachedToday = cacheGetTimed("day-live:" + day, PREP_TODAY_CACHE_MS);
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
            cacheSetTimed("day-live:" + day, result);
          } else {
            cacheSetTimed(cacheKey, result);
          }

          return { data: result, fromCache: false };
        });
    }

    // ─── UI updaters ───────────────────────────────────────────────────────────

    function apply3ErlStatus(data) {
      if (!data) {
        document.getElementById("trend").textContent = "Unavailable";
        document.getElementById("bridage").textContent = "Unavailable";
        document.getElementById("bridage-cdc").textContent = "Unavailable";
        return;
      }
      document.getElementById("trend").textContent = formatTrend(data.PREP_Profile) + " (" + (data.PREP_Profile || "?") + ")";
      document.getElementById("bridage").textContent = (data.Bridage ? "ON" : "OFF") + sentimentBadge(data.Bridage ? -1 : 1);
      document.getElementById("bridage-cdc").textContent = (data.Bridage_CDC ? "ON" : "OFF") + sentimentBadge(data.Bridage_CDC ? -1 : 1);
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
      var x = merged.map(function (p) {
        return p.key;
      });

      var prepPositive = merged.map(function (p) {
        if (typeof p.prep !== "number") return null;
        return p.prep >= 0 ? toCentsPerKwh(p.prep) : 0;
      });

      var prepNegative = merged.map(function (p) {
        if (typeof p.prep !== "number") return null;
        return p.prep < 0 ? toCentsPerKwh(p.prep) : 0;
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
      var isMobile = window.matchMedia("(max-width: 640px)").matches;

      var traces = [
        {
          type: "bar",
          x: x,
          y: prepPositive,
          name: "Positive PRE+",
          marker: { color: "deepskyblue" },
          yaxis: "y",
        },
        {
          type: "bar",
          x: x,
          y: prepNegative,
          name: "Negative PRE+",
          marker: { color: "red" },
          yaxis: "y",
        },
        {
          type: "scatter",
          mode: "lines",
          x: x,
          y: spotValues,
          name: "SPOT Prices",
          legendrank: 2,
          line: { color: "#1e3a8a", width: isMobile ? 1 : 2, shape: "hv" },
          yaxis: "y",
        },
        {
          type: "scatter",
          mode: "lines",
          x: x,
          y: prd3Values,
          name: "PRD3 Factors",
          legendrank: 1,
          line: { color: "orange", width: isMobile ? 1 : 2, shape: "hv" },
          yaxis: "y2",
        },
      ];

      if (typeof estimateCents === "number") {
        traces.push({
          type: "scatter",
          mode: "lines",
          x: x,
          y: estimateCentsSeries,
          name: "PRE+ Daily Estimation",
          line: { color: "lightgreen", width: isMobile ? 2 : 4 },
          yaxis: "y",
        });
      }

      var layout = {

        title: {
          text: "PRE+ (" + day + ") x PRD3 " + profileLabel + " (" + profileDay + ")",
          x: 0.5,
          xanchor: "center",
          y: 0.995,
          yanchor: "top",
        },
        barmode: "overlay",
        bargap: 0.15,
        legend: {
          orientation: "v",
          x: 0.5,
          xanchor: "center",
          y: isMobile ? 1.05 : 1.12,
          yanchor: "top",
        },
        margin: { t: 80, r: 60, l: 60, b: 60 },
        xaxis: {
          title: "Timeslot",
          type: "date",
          tickformat: "%H:%M",
        },
        yaxis: {
          title: "c€/kWh",
          zeroline: true,
          zerolinecolor: "#999",
          domain: [0, 0.86],
        },
        yaxis2: {
          title: "PRD3 factor",
          overlaying: "y",
          side: "right",
          rangemode: "tozero",
        },
      };

      var config = {
        responsive: true,
        displaylogo: false,
        displayModeBar: true,
        displayModeBar: !isMobile,
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
        node.textContent = "Unavailable";
        return;
      }
      var cents = toCentsPerKwh(estimateEurPerMwh);
      node.textContent = cents.toFixed(2) + " c€/kWh" + sentimentBadge(cents);
    }

    // ─── Main load / init ──────────────────────────────────────────────────────

    function load() {
      var dayInput = document.getElementById("day");
      var minDate = dayInput.min || addDays(todayParis(), -LOOKBACK_DAYS);
      var maxDate = dayInput.max || todayParis();
      var day = clampDay(dayInput.value, minDate, maxDate);
      dayInput.value = day;
      if (!day) {
        return;
      }

      syncDayInUrl(day);

      var profileInfo = getPrd3ProfileInfo(day);
      var profileDay = profileInfo.profileDay;
      var profileLabel = profileInfo.profileLabel;

      setStatus("Loading data for " + day + " with PRD3 profile " + profileLabel + " (" + profileDay + ")...");

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
          setStatus(error.message || "Failed to load data", true);
        });
    }

    function init() {
      document.body.classList.add("prep-page");

      var dayInput = document.getElementById("day");
      var maxDate = todayParis();
      var minDate = addDays(maxDate, -LOOKBACK_DAYS);
      dayInput.min = minDate;
      dayInput.max = maxDate;
      dayInput.value = getInitialDay(minDate, maxDate);

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
      document.getElementById("prep-clear-cache").addEventListener("click", function () {
        clearPrepCache();
        setStatus("Cache cleared. Reloading...");
        load();
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
      });

      setInterval(function () {
        if (document.visibilityState !== "visible") {
          return;
        }
        var selectedDay = document.getElementById("day").value;
        if (selectedDay !== todayParis()) {
          return;
        }
        load();
      }, AUTO_REFRESH_MS);

      load();
    }

    init();
  })();
</script>