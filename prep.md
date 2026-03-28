---
title: Estimation PRE+ du jour
permalink: /prep/
---

<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>

<style>
  body.prep-page {
    --prep-bg: #ffffff;
    --prep-panel-bg: #ffffff;
    --prep-card-bg: #ffffff;
    --prep-explainer-bg: #fafafa;
    --prep-border: #d9d9d9;
    --prep-text: #444444;
    --prep-heading: #222222;
    --prep-muted: #727272;
    --prep-link: #0a4ea3;
    --prep-control-bg: #ffffff;
    --prep-control-text: #222222;
    --prep-plot-paper: #ffffff;
    --prep-plot-panel: #ffffff;
    --prep-plot-text: #444444;
    --prep-plot-grid: #e5e7eb;
    --prep-plot-zero: #9ca3af;
    --prep-prep-positive: deepskyblue;
    --prep-prep-negative: #ff0000;
    --prep-spot: #1e3a8a;
    --prep-prd3: #ff9800;
    --prep-estimate: #7ee787;
    --prep-positive-text: #2e7d32;
    --prep-negative-text: #c62828;
    background-color: var(--prep-bg);
    color: var(--prep-text);
    overflow-x: hidden;
  }

  body.prep-page[data-theme="dark"] {
    --prep-bg: #0f172a;
    --prep-panel-bg: #111827;
    --prep-card-bg: #111827;
    --prep-explainer-bg: #111827;
    --prep-border: #334155;
    --prep-text: #e5e7eb;
    --prep-heading: #f8fafc;
    --prep-muted: #94a3b8;
    --prep-link: #7dd3fc;
    --prep-control-bg: #0f172a;
    --prep-control-text: #f8fafc;
    --prep-plot-paper: #0f172a;
    --prep-plot-panel: #111827;
    --prep-plot-text: #e5e7eb;
    --prep-plot-grid: #334155;
    --prep-plot-zero: #64748b;
    --prep-prep-positive: #38bdf8;
    --prep-prep-negative: #f87171;
    --prep-spot: #93c5fd;
    --prep-prd3: #fbbf24;
    --prep-estimate: #86efac;
    --prep-positive-text: #86efac;
    --prep-negative-text: #fca5a5;
  }

  body.prep-page .wrapper,
  body.prep-page section,
  .prep-meta,
  .prep-card,
  #prep-plot,
  #prep-footer,
  #prep-explainer {
    box-sizing: border-box;
    min-width: 0;
  }

  body.prep-page .wrapper {
    width: 100%;
    max-width: 1800px;
    margin-left: auto;
    margin-right: auto;
  }

  body.prep-page header {
    display: none;
  }

  body.prep-page section {
    width: 100%;
    max-width: 100%;
    float: none;
  }

  #prep-page-title {
    margin: 0;
    text-align: center;
    color: var(--prep-heading);
  }

  .prep-page-topbar {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2.1rem;
    margin-bottom: 0.75rem;
  }

  .prep-theme-floating {
    position: absolute;
    top: 50%;
    right: 0;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.4rem;
    border: 1px solid var(--prep-border);
    border-radius: 999px;
    background: color-mix(in srgb, var(--prep-panel-bg) 88%, transparent);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
  }

  .prep-theme-floating label {
    font-size: 0.72rem;
    line-height: 1;
    color: var(--prep-muted);
  }

  .prep-theme-floating select {
    font-size: 0.72rem;
    line-height: 1;
    padding: 0.2rem 1.2rem 0.2rem 0.35rem;
    min-height: 1.7rem;
    max-width: 5.5rem;
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
    color: var(--prep-control-text);
    background: var(--prep-control-bg);
    border: 1px solid var(--prep-border);
    border-radius: 6px;
  }

  .prep-meta {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .prep-card {
    border: 1px solid var(--prep-border);
    border-radius: 6px;
    padding: 0.6rem 0.75rem;
    background: var(--prep-card-bg);
  }

  .prep-label {
    font-size: 0.85rem;
    opacity: 0.8;
    color: var(--prep-muted);
  }

  .prep-value {
    font-weight: 700;
    margin-top: 0.2rem;
  }

  #prep-plot {
    width: 100%;
    height: clamp(400px, 75vh, 1200px);
    min-height: clamp(400px, 75vh, 1200px);
    max-width: 100%;
    overflow: hidden;
  }

  #prep-plot .js-plotly-plot,
  #prep-plot .plot-container,
  #prep-plot .svg-container {
    width: 100% !important;
    max-width: 100% !important;
  }

  #prep-plot .modebar {
    top: 105px !important;
    right: 8px !important;
    z-index: 20;
  }

  #prep-footer {
    width: 100%;
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
    color: var(--prep-muted);
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

  #prep-explainer {
    width: 100%;
    margin-top: 0.6rem;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--prep-border);
    border-radius: 8px;
    background: var(--prep-explainer-bg);
    font-size: 0.86rem;
    line-height: 1.45;
    text-align: left;
    max-width: 1000px;
    color: var(--prep-text);
  }

  #prep-explainer h3 {
    margin: 0 0 0.45rem;
    font-size: 0.95rem;
    color: var(--prep-heading);
  }

  #prep-explainer p {
    margin: 0.45rem 0;
  }

  #prep-explainer ul {
    margin: 0.4rem 0 0.6rem 1.1rem;
    padding: 0;
  }

  #prep-explainer li {
    margin: 0.25rem 0;
  }

  #prep-explainer a {
    color: var(--prep-link);
  }

  #prep-explainer strong {
    color: var(--prep-heading);
  }

  @media screen and (max-width: 960px) {
    body.prep-page .wrapper {
      width: 100%;
      max-width: 100%;
    }

    body.prep-page header,
    body.prep-page section {
      width: 100%;
      float: none;
    }
  }

  @media screen and (max-width: 480px) {
    body.prep-page {
      padding: 12px;
    }
  }

  @media screen and (max-width: 640px) {
    .prep-page-topbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      column-gap: 0.5rem;
      align-items: start;
      min-height: 0;
      padding-right: 0;
    }

    #prep-page-title {
      width: auto;
      max-width: none;
      font-size: 1.45rem;
      line-height: 1.15;
      white-space: normal;
      overflow-wrap: anywhere;
      text-align: center;
    }

    .prep-theme-floating {
      position: static;
      top: auto;
      right: auto;
      transform: none;
      justify-self: end;
      max-width: 4.8rem;
      padding: 0.2rem 0.35rem;
    }

    .prep-theme-floating label {
      display: none;
    }

    .prep-theme-floating select {
      width: 100%;
      font-size: 0.68rem;
      min-height: 1.55rem;
      padding-right: 1rem;
    }

    #prep-plot {
      height: clamp(350px, 70vh, 900px);
      min-height: clamp(350px, 70vh, 900px);
    }

    #prep-plot .modebar {
      top: 200px !important;
      right: 6px !important;
      transform: scale(0.9);
      transform-origin: top right;
    }
  }
</style>

<div class="prep-page-topbar">
  <h2 id="prep-page-title">Estimation PRE+ du jour</h2>
  <div class="prep-theme-floating">
    <label for="theme-mode">Thème</label>
    <select id="theme-mode" aria-label="Choix du thème">
      <option value="auto">Auto</option>
      <option value="light">Clair</option>
      <option value="dark">Sombre</option>
    </select>
  </div>
</div>

<div class="prep-meta">
  <div class="prep-card">
    <div class="prep-label">Tendance 3ERL</div>
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
    <div class="prep-label">Estimation PRE+ du jour</div>
    <div id="prep-estimation" class="prep-value">-</div>
  </div>
</div>

<div class="prep-controls">
  <div class="prep-control-row">
    <label for="day">Jour:</label>
    <button id="prev-day" type="button" aria-label="Jour précédent">←</button>
    <input id="day" type="date" />
    <button id="next-day" type="button" aria-label="Jour suivant">→</button>
    <button id="today" type="button">Aujourd'hui</button>
  </div>
</div>

<div id="prep-status"></div>
<div id="prep-plot"></div>
<div id="prep-footer">
  <div id="prep-last-update">Dernière mise à jour: -</div>
  <div id="prep-next-refresh">Prochaine actualisation automatique: -</div>
  <div id="prep-timeslot-info"></div>
  <div id="prep-explainer">
    <h3>Comment lire ce graphe</h3>
    <p>Le graphe superpose 3 signaux quart-horaires et une estimation journalière:</p>
    <ul>
      <li><strong>PRE+</strong> (barres bleu/rouge): prix de règlement des écarts positifs en €/MWh (converti ici en c€/kWh). Bleu = prix positif, rouge = prix négatif. Source: <a href="https://www.services-rte.com/fr/visualisez-les-donnees-publiees-par-rte/equilibrage.html" target="_blank" rel="noopener noreferrer">Infos PRE+ (RTE)</a>.</li>
      <li><strong>SPOT</strong> (courbe bleue): prix marché day-ahead FR (€/MWh, converti en c€/kWh). Source: <a href="https://www.rte-france.com/donnees-publications/eco2mix-donnees-temps-reel/donnees-marche" target="_blank" rel="noopener noreferrer">Prix SPOT (RTE eco2mix)</a>.</li>
      <li><strong>PRD3</strong> (courbe orange): coefficient dynamique d'ensoleillement utilisé comme facteur de pondération. Source: <a href="https://data.enedis.fr/pages/coefficients-de-profils-dynamiques-jplus1-contenu/" target="_blank" rel="noopener noreferrer">Profil PRD3 (Enedis)</a>.</li>
      <li><strong>Statut 3ERL</strong> (cartes en haut): indicateurs de contexte du marché (tendance/bridage). Source: <a href="https://3erl.fr/PREP_Profile.php" target="_blank" rel="noopener noreferrer">Statut 3ERL</a>.</li>
    </ul>
    <p><strong>Estimation journalière PRE+</strong> (courbe verte) est calculée en moyenne pondérée cumulative par PRD3:</p>
    <p><em>estimation(t) = sum(PRE+(i) * PRD3(i)) / sum(PRD3(i))</em>, pour tous les points disponibles jusqu'au créneau <em>t</em>.</p>
    <p>La valeur affichée dans la carte « Estimation journalière PRE+ » correspond au dernier point disponible de cette série. C'est cette valeur journalière qui sert de référence de valorisation du surplus en ACI (autoconsommation individuelle) utilisée par Enedis.</p>
    <p><strong>Cette valeur reste une estimation</strong>, car la courbe PRD3 du jour n'est pas encore connue en temps réel, et les prix PRE+ peuvent être ajustés a posteriori par Enedis.</p>
    <p>Règle PRD3 utilisée dans ce graphe:</p>
    <ul>
      <li>pour le jour actuel: profil PRD3 de J-2;</li>
      <li>pour hier: profil PRD3 de J-1 (ce qui revient aussi a J-2 par rapport à aujourd'hui);</li>
      <li>pour avant-hier et les jours antérieurs: profil PRD3 du jour (J0).</li>
    </ul>
    <p>Cette logique vient du fait que la courbe PRD3 de la veille n'est disponible que le matin.</p>
  </div>
</div>

<script>
  (function () {
    var VERSION = "v8";
    var TIMEZONE = "Europe/Paris";
    var LOOKBACK_DAYS = 30;
    var TODAY_CACHE_MAX_MS = 15 * 60 * 1000;
    var PAST_CACHE_MS = 24 * 60 * 60 * 1000;
    var THEME_STORAGE_KEY = "prep_theme";
    var CACHE_PREFIX = "prep_" + VERSION + ":";
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
        var raw = localStorage.getItem(CACHE_PREFIX + key);
        if (!raw) {
          return null;
        }
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.savedAt !== "number" || !("data" in parsed)) {
          return null;
        }
        if (typeof parsed.expiresAt === "number" && Date.now() > parsed.expiresAt) {
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
      var palette = getThemePalette();

      var traces = [
        {
          type: "bar",
          x: x,
          y: prepPositive,
          name: "PRE+ positif",
          marker: { color: palette.prepPositive },
          yaxis: "y",
        },
        {
          type: "bar",
          x: x,
          y: prepNegative,
          name: "PRE+ négatif",
          marker: { color: palette.prepNegative },
          yaxis: "y",
        },
        {
          type: "scatter",
          mode: "lines",
          x: x,
          y: spotValues,
          name: "Prix SPOT",
          legendrank: 2,
          line: { color: palette.spot, width: isMobile ? 1 : 2, shape: "hv" },
          yaxis: "y",
        },
        {
          type: "scatter",
          mode: "lines",
          x: x,
          y: prd3Values,
          name: "Facteurs PRD3",
          legendrank: 1,
          line: { color: palette.prd3, width: isMobile ? 1 : 2, shape: "hv" },
          yaxis: "y2",
        },
      ];

      if (typeof estimateCents === "number") {
        traces.push({
          type: "scatter",
          mode: "lines",
          x: x,
          y: estimateCentsSeries,
          name: "Estimation PRE+ du jour",
          line: { color: palette.estimate, width: isMobile ? 2 : 4 },
          yaxis: "y",
        });
      }

      var layout = {
        barmode: "overlay",
        bargap: 0.15,
        paper_bgcolor: palette.plotPaper,
        plot_bgcolor: palette.plotPanel,
        font: { color: palette.plotText },
        legend: {
          orientation: "v",
          x: 0.5,
          xanchor: "center",
          y: isMobile ? 1.1 : 1,
          yanchor: "top",
        },
        margin: { t: 10, r: 60, l: 60, b: 30 },
        xaxis: {
          type: "date",
          tickformat: "%H:%M",
          color: palette.plotText,
          gridcolor: palette.plotGrid,
        },
        yaxis: {
          title: "c€/kWh",
          zeroline: true,
          zerolinecolor: palette.plotZero,
          gridcolor: palette.plotGrid,
          color: palette.plotText,
          domain: [0, 0.86],
        },
        yaxis2: {
          title: "Facteur PRD3",
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
</script>