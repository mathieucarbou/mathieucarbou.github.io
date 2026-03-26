---
title: PREP
permalink: /prep/
---

<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>

<style>
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

  #prep-status {
    margin-bottom: 0.8rem;
    min-height: 1.25rem;
  }

  #prep-plot {
    width: 100%;
    min-height: 520px;
  }
</style>

<h2>PRE+ / PRD3 Daily View</h2>

<div class="prep-controls">
  <label for="day">Day:</label>
  <input id="day" type="date" />
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
  <button id="reload" type="button">Reload</button>
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

<script>
  (function () {
    var TIMEZONE = "Europe/Paris";

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

    function currentParisTimeslot() {
      var p = partsInParis(new Date());
      var minute = Number(p.minute);
      var roundedMinute = Math.floor(minute / 15) * 15;
      var minuteText = String(roundedMinute).padStart(2, "0");
      return p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + minuteText + ":00";
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

    function currentParisTimeHHMM() {
      var p = partsInParis(new Date());
      var roundedMinute = Math.floor(Number(p.minute) / 15) * 15;
      var minuteText = String(roundedMinute).padStart(2, "0");
      return p.hour + ":" + minuteText;
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

    function fetch3ErlStatus() {
      return fetch("https://3erl.fr/api.json")
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
      var url = "https://www.services-rte.com/cms/open_data/v1/price/table?startDate=" + dateForRte(day);
      return fetch(url)
        .then(function (response) {
          if (!response.ok) {
            throw new Error("PREP API error: " + response.status);
          }
          return response.json();
        })
        .then(function (json) {
          var entries = Array.isArray(json.values) ? json.values : [];
          return entries
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
        });
    }

    function fetchPrd3(day, offsetDays) {
      var profileDay = addDays(day, offsetDays);
      var end = day === todayParis() ? profileDay + "T" + currentParisTimeHHMM() + ":00" : profileDay + "T23:59:59";
      var where = "(sous_profil='PRD3_BASE') AND horodate >= '" + profileDay + "T00:00:00' AND horodate <= '" + end + "'";
      var body = new URLSearchParams({
        action: "exports",
        output: "exportDirect",
        format: "json",
        dataset: "koumoul://7okolrt07nor9cv103spkfzc",
        apikey: "false",
        datefield: "horodate",
        select: "horodate, coefficient_dynamique_j_1",
        where: where,
        group: "",
        order: "horodate desc",
      });

      return fetch("https://openservices.enedis.fr/php/opendata.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: body,
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("PRD3 API error: " + response.status);
          }
          return response.json();
        })
        .then(function (rows) {
          var values = Array.isArray(rows) ? rows : [];
          return values
            .map(function (row) {
              return {
                d: row.horodate,
                v: Number(row.coefficient_dynamique_j_1 || 0),
              };
            })
            .sort(function (a, b) {
              return new Date(a.d) - new Date(b.d);
            });
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

      var keys = Array.from(new Set([].concat(Array.from(prepMap.keys()), Array.from(prd3Map.keys()))));
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

    function estimateDailyPrep(merged) {
      var weighted = 0;
      var factors = 0;
      merged.forEach(function (point) {
        if (typeof point.prep === "number" && typeof point.prd3 === "number") {
          weighted += point.prep * point.prd3;
          factors += point.prd3;
        }
      });
      if (!factors) {
        return null;
      }
      return weighted / factors;
    }

    function renderGraph(day, profileDay, offsetDays, merged, estimateEurPerMwh) {
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
      var estimateCents = typeof estimateEurPerMwh === "number" ? toCentsPerKwh(estimateEurPerMwh) : null;

      var estimateLine = merged.map(function () {
        return estimateCents;
      });

      var traces = [
        {
          type: "bar",
          x: x,
          y: prepPositive,
          name: "Positive PRE+" + (typeof latestPositive === "number" ? " (" + latestPositive.toFixed(2) + " c€/kWh)" : ""),
          marker: { color: "deepskyblue" },
          yaxis: "y",
        },
        {
          type: "bar",
          x: x,
          y: prepNegative,
          name: "Negative PRE+" + (typeof latestNegative === "number" ? " (" + latestNegative.toFixed(2) + " c€/kWh)" : ""),
          marker: { color: "red" },
          yaxis: "y",
        },
        {
          type: "bar",
          x: x,
          y: prd3Values,
          name: "PRD3 Profile" + (typeof latestPrd3 === "number" ? " (" + latestPrd3.toFixed(6) + ")" : ""),
          marker: { color: "orange", opacity: 0.55 },
          yaxis: "y2",
        },
      ];

      if (typeof estimateCents === "number") {
        traces.push({
          type: "scatter",
          mode: "lines",
          x: x,
          y: estimateLine,
          name: "PRE+ Daily Est" + " (" + estimateCents.toFixed(2) + " c€/kWh)" + (estimateCents < 0 ? " ⚠️" : ""),
          line: { color: "lightgreen", width: 2 },
          yaxis: "y",
        });
      }

      var layout = {
        title: "PRE+ / PRD3 - " + day + " (PRD3 J" + offsetDays + ": " + profileDay + ")",
        barmode: "overlay",
        bargap: 0.15,
        legend: { orientation: "h", x: 0, y: 1.12 },
        margin: { t: 70, r: 60, l: 60, b: 60 },
        xaxis: {
          title: "Timeslot",
          type: "date",
          tickformat: "%H:%M",
        },
        yaxis: {
          title: "PRE+ (c€/kWh)",
          zeroline: true,
          zerolinecolor: "#999",
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
      };

      Plotly.newPlot("prep-plot", traces, layout, config);
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

      var profileDay = addDays(day, offsetDays);

      setStatus("Loading data for " + day + " with PRD3 profile J" + offsetDays + " (" + profileDay + ")...");

      Promise.all([fetchPrep(day), fetchPrd3(day, offsetDays), fetch3ErlStatus()])
        .then(function (results) {
          var prep = results[0];
          var prd3 = results[1];
          var merged = mergeByTimeslot(day, prep, prd3);
          var estimate = estimateDailyPrep(merged);
          setEstimationValue(estimate);
          renderGraph(day, profileDay, offsetDays, merged, estimate);
          setStatus("Updated: " + merged.length + " timeslots (PRD3 J" + offsetDays + ").");
        })
        .catch(function (error) {
          setStatus(error.message || "Failed to load data", true);
        });
    }

    function init() {
      var dayInput = document.getElementById("day");
      dayInput.value = todayParis();

      var maxDate = todayParis();
      dayInput.max = maxDate;

      document.getElementById("reload").addEventListener("click", load);
      dayInput.addEventListener("change", load);
      document.getElementById("prd3-offset").addEventListener("change", load);

      load();
    }

    init();
  })();
</script>