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
    width: 220px;
  }

  body.prep-page section {
    width: calc(100% - 255px);
  }

  #prep-page-title {
    text-align: center;
  }

  .prep-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 1rem;
  }

  .prep-controls input,
  .prep-controls select,
  .prep-controls button {
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

  #prep-footer {
    margin-top: 0.6rem;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
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
</style>

<h2 id="prep-page-title">PRE+ x PRD3 Daily View</h2>

<div class="prep-controls">
  <label for="day">Day:</label>
  <button id="prev-day" type="button" aria-label="Previous day">←</button>
  <input id="day" type="date" />
  <button id="next-day" type="button" aria-label="Next day">→</button>
  <button id="today" type="button">Today</button>
  <label for="prd3-offset">PRD3 profile day:</label>
  <select id="prd3-offset">
    <option value="-1">J-1</option>
    <option value="-2" selected>J-2</option>
    <option value="-3">J-3</option>
    <option value="-4">J-4</option>
    <option value="-5">J-5</option>
    <option value="-6">J-6</option>
    <option value="-7">J-7</option>
  </select>
</div>

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

<div id="prep-status"></div>
<div id="prep-plot"></div>
<div id="prep-footer">
  <span id="prep-last-update">Dernière mise à jour: -</span>
  <br/>
  <span id="prep-timeslot-info"></span>
  <br/>
  <button id="clear-cache" type="button">Vider le cache</button>
</div>

<script>
  (function () {
    var TIMEZONE = "Europe/Paris";
    var AUTO_REFRESH_MS = 5 * 60 * 1000;
    var PREP_TODAY_CACHE_MS = 5 * 60 * 1000;
    var CACHE_PREFIX = "prep_v1:";
    var API_BASE_URL = "https://prep-api.carbou.me/api";
    var resizeTimer = null;

    function cacheGet(key) {
      try {
        var raw = localStorage.getItem(CACHE_PREFIX + key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function cacheSet(key, data) {
      try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
      } catch (e) {
        // storage quota exceeded or unavailable — fail silently
      }
    }

    function cacheGetTimed(key, maxAgeMs) {
      try {
        var raw = localStorage.getItem(CACHE_PREFIX + key);
        if (!raw) {
          return null;
        }
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.savedAt !== "number" || !Array.isArray(parsed.data)) {
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

    function dateForRte(day) {
      var tokens = day.split("-");
      return encodeURIComponent(tokens[2] + "/" + tokens[1] + "/" + tokens[0]);
    }

    function dayKey(isoDate) {
      var p = partsInParis(new Date(isoDate));
      return p.year + "-" + p.month + "-" + p.day;
    }

    function slotTime(isoDate) {
      var p = partsInParis(new Date(isoDate));
      return p.hour + ":" + p.minute;
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

    function getInitialDay(maxDate) {
      try {
        var url = new URL(window.location.href);
        var fromUrl = url.searchParams.get("day");
        if (isValidDay(fromUrl) && fromUrl <= maxDate) {
          return fromUrl;
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
      var maxDate = dayInput.max || todayParis();

      if (next > maxDate) {
        next = maxDate;
      }

      dayInput.value = next;
      load();
    }

    function slotKey(isoDate) {
      var p = partsInParis(new Date(isoDate));
      return p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + p.minute;
    }

    function toCentsPerKwh(prepEurPerMwh) {
      return prepEurPerMwh * 0.1;
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

    function setTimeslotInfo(prepCount, prepFromCache, prd3Count, prd3FromCache, mergedCount, offsetDays) {
      var cacheTag = " <span style=\"color:#d32f2f;font-weight:700;\">✦ cache</span>";
      document.getElementById("prep-timeslot-info").innerHTML =
        mergedCount + " aligned timeslots" +
        " — PREP: " + prepCount + (prepFromCache ? cacheTag : "") +
        ", PRD3: " + prd3Count + (prd3FromCache ? cacheTag : "") +
        ", J" + offsetDays;
    }

    function fetch3ErlStatus() {
      return fetch(API_BASE_URL + "/3erl")
        .then(function (response) {
          if (!response.ok) {
            throw new Error("3ERL API error: " + response.status);
          }
          return response.json();
        })
        .then(function (data) {
          document.getElementById("trend").textContent = formatTrend(data.PREP_Profile) + " (" + (data.PREP_Profile || "?") + ")";
          document.getElementById("bridage").textContent = data.Bridage ? "ON ⚠️" : "OFF";
          document.getElementById("bridage-cdc").textContent = data.Bridage_CDC ? "ON ⚠️" : "OFF";
        })
        .catch(function () {
          document.getElementById("trend").textContent = "Unavailable";
          document.getElementById("bridage").textContent = "Unavailable";
          document.getElementById("bridage-cdc").textContent = "Unavailable";
        });
    }

    function fetchPrep(day) {
      var isToday = day === todayParis();
      var cacheKey = "prep:" + day;

      if (isToday) {
        var cachedToday = cacheGetTimed("prep-live:" + day, PREP_TODAY_CACHE_MS);
        if (cachedToday) {
          return Promise.resolve({ data: cachedToday, fromCache: true });
        }
      } else {
        var cached = cacheGet(cacheKey);
        if (cached) {
          return Promise.resolve({ data: cached, fromCache: true });
        }
      }

      var url = API_BASE_URL + "/rte?day=" + encodeURIComponent(day);
      return fetch(url)
        .then(function (response) {
          if (!response.ok) {
            throw new Error("PREP API error: " + response.status);
          }
          return response.json();
        })
        .then(function (json) {
          var entries = Array.isArray(json.values) ? json.values : [];
          var result = entries
            .map(function (entry) {
              return {
                d: entry.date,
                v: Number((entry.pre && entry.pre.positive) || 0),
              };
            })
            .filter(function (entry) {
              return dayKey(entry.d) === day;
            })
            .sort(function (a, b) {
              return new Date(a.d) - new Date(b.d);
            });
          if (isToday) {
            cacheSetTimed("prep-live:" + day, result);
          } else {
            cacheSet(cacheKey, result);
          }
          return { data: result, fromCache: false };
        });
    }

    function fetchPrd3(day, offsetDays) {
      var profileDay = addDays(day, offsetDays);
      var cacheKey = "prd3:" + profileDay;

      var cached = cacheGet(cacheKey);
      if (cached) {
        return Promise.resolve({ data: cached, fromCache: true });
      }

      var url = API_BASE_URL + "/prd3?profileDay=" + encodeURIComponent(profileDay);

      return fetch(url)
        .then(function (response) {
          if (!response.ok) {
            throw new Error("PRD3 API error: " + response.status);
          }
          return response.json();
        })
        .then(function (rows) {
          var values = Array.isArray(rows) ? rows : [];
          var result = values
            .map(function (row) {
              return {
                d: row.horodate,
                v: Number(row.coefficient_dynamique_j_1 || 0),
              };
            })
            .sort(function (a, b) {
              return new Date(a.d) - new Date(b.d);
            });
          cacheSet(cacheKey, result);
          return { data: result, fromCache: false };
        });
    }

    function mergeByTimeslot(day, prep, prd3) {
      var prepMap = new Map();
      prep.forEach(function (point) {
        prepMap.set(slotTime(point.d), point);
      });

      var prd3Map = new Map();
      prd3.forEach(function (point) {
        prd3Map.set(slotTime(point.d), point);
      });

      var keys = Array.from(prepMap.keys()).filter(function (time) {
        return prd3Map.has(time);
      });
      keys.sort();

      return keys.map(function (key) {
        var prepPoint = prepMap.get(key);
        var prd3Point = prd3Map.get(key);
        return {
          key: withDisplayDay(day, key),
          prep: prepPoint ? prepPoint.v : null,
          prd3: prd3Point ? prd3Point.v : null,
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

    function renderGraph(day, profileDay, offsetDays, merged, estimateSeriesEurPerMwh, estimateLastEurPerMwh) {
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

      var latestPositive = prepPositive.filter(function (v) { return typeof v === "number" && v > 0; }).slice(-1)[0];
      var latestNegative = prepNegative.filter(function (v) { return typeof v === "number" && v < 0; }).slice(-1)[0];
      var latestPrd3 = prd3Values.filter(function (v) { return typeof v === "number"; }).slice(-1)[0];
      var estimateCentsSeries = estimateSeriesEurPerMwh.map(function (value) {
        return typeof value === "number" ? toCentsPerKwh(value) : null;
      });
      var estimateCents = typeof estimateLastEurPerMwh === "number" ? toCentsPerKwh(estimateLastEurPerMwh) : null;

      var traces = [
        {
          type: "bar",
          x: x,
          y: prepPositive,
          name: "Last Positive PRE+" + (typeof latestPositive === "number" ? " (" + latestPositive.toFixed(2) + " c€/kWh)" : ""),
          marker: { color: "deepskyblue" },
          yaxis: "y",
        },
        {
          type: "bar",
          x: x,
          y: prepNegative,
          name: "Last Negative PRE+" + (typeof latestNegative === "number" ? " (" + latestNegative.toFixed(2) + " c€/kWh)" : ""),
          marker: { color: "red" },
          yaxis: "y",
        },
        {
          type: "scatter",
          mode: "lines",
          x: x,
          y: prd3Values,
          name: "Last PRD3 Factor" + (typeof latestPrd3 === "number" ? " (" + latestPrd3.toFixed(6) + ")" : ""),
          line: { color: "orange", width: 2, shape: "hv" },
          yaxis: "y2",
        },
      ];

      if (typeof estimateCents === "number") {
        traces.push({
          type: "scatter",
          mode: "lines",
          x: x,
          y: estimateCentsSeries,
          name: "Last PRE+ Daily Estimation" + " (" + estimateCents.toFixed(2) + " c€/kWh)" + (estimateCents < 0 ? " ⚠️" : ""),
          line: { color: "lightgreen", width: 2 },
          yaxis: "y",
        });
      }

      var layout = {
        title: {
          text: "PRE+ (" + day + ") x PRD3 (" + profileDay + ")",
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
          y: 1.12,
          yanchor: "top",
        },
        margin: { t: 90, r: 60, l: 60, b: 60 },
        xaxis: {
          title: "Timeslot",
          type: "date",
          tickformat: "%H:%M",
        },
        yaxis: {
          title: "PRE+ (c€/kWh)",
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

      var isMobile = window.matchMedia("(max-width: 640px)").matches;

      var config = {
        responsive: true,
        displaylogo: false,
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
      node.textContent = cents.toFixed(2) + " c€/kWh" + (cents < 0 ? " ⚠️" : "");
    }

    function load() {
      var day = document.getElementById("day").value;
      var offsetDays = Number(document.getElementById("prd3-offset").value || -2);
      if (!day) {
        return;
      }

      syncDayInUrl(day);

      var profileDay = addDays(day, offsetDays);
      var isToday = day === todayParis();

      setStatus("Loading data for " + day + " with PRD3 profile J" + offsetDays + " (" + profileDay + ")...");

      var fetches = [fetchPrep(day), fetchPrd3(day, offsetDays)];
      if (isToday) {
        fetches.push(fetch3ErlStatus());
      }

      Promise.all(fetches)
        .then(function (results) {
          var prepResult = results[0];
          var prd3Result = results[1];
          var merged = mergeByTimeslot(day, prepResult.data, prd3Result.data);
          var estimate = estimateDailyPrepSeries(merged);
          setEstimationValue(estimate.last);
          renderGraph(day, profileDay, offsetDays, merged, estimate.series, estimate.last);
          setLastUpdateNow();
          setTimeslotInfo(prepResult.data.length, prepResult.fromCache, prd3Result.data.length, prd3Result.fromCache, merged.length, offsetDays);
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
      dayInput.max = maxDate;
      dayInput.value = getInitialDay(maxDate);

      document.getElementById("today").addEventListener("click", function () {
        var dayInput = document.getElementById("day");
        dayInput.value = todayParis();
        load();
      });
      document.getElementById("clear-cache").addEventListener("click", function () {
        try {
          var keys = [];
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && k.indexOf(CACHE_PREFIX) === 0) {
              keys.push(k);
            }
          }
          keys.forEach(function (k) { localStorage.removeItem(k); });
          setStatus(keys.length + " entrée(s) de cache effacée(s).");
        } catch (e) {
          setStatus("Impossible d'effacer le cache.", true);
        }
      });
      dayInput.addEventListener("change", load);
      document.getElementById("prd3-offset").addEventListener("change", load);
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

      setInterval(function () {
        load();
      }, AUTO_REFRESH_MS);

      load();
    }

    init();
  })();
</script>