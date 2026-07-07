// SPDX-FileCopyrightText: Copyright (c) Mathieu Carbou
// SPDX-License-Identifier: MIT

// =============================================================================
// Cloudflare Worker — PRE+/SPOT/PRD3 aggregation API
//
// Active endpoint:  GET /api/day?day=YYYY-MM-DD
//   Returns a JSON bundle with PREP, SPOT (FR) and PRD3 series for a given day.
//   Timeslots are "HH:MM" strings (Europe/Paris local time).
//   Each series: { rows: [{ts, value}], fetchedAt: ISO, cache: "HIT"|"MISS" }
//
// Caching layers:
//   1. Zone cache (CF cache API): full /api/day response for past days (24 h).
//   2. Per-source worker cache: PREP/SPOT today=keyed by refresh slot (05/20/35/50) and capped at 15 min, past=24 h; PRD3 always 24 h.
//   3. 3ERL: smart update-slot-aligned cache. 3ERL fetches from RTE at minutes 3/18/33/48; the worker polls upstream during a 5-min window after each slot to detect new Heure_Update, then caches until the next slot.
// =============================================================================

// ─── Configuration ────────────────────────────────────────────────────────────

// Fuseau de référence pour tout le worker :
// - calcul de "today" et distinction passé/présent,
// - formatage des créneaux horaires,
// - cohérence des comparaisons de dates côté API.
// A changer uniquement si la logique métier doit suivre un autre fuseau.
const TIMEZONE        = "Europe/Paris";

// Origine frontend autorisée pour les requêtes cross-origin.
// Le worker renvoie cette valeur dans Access-Control-Allow-Origin et compare
// les en-têtes Origin/Referer entrants pour bloquer les appels non prévus.
// Doit correspondre exactement au domaine public de la page PRE+.
const ALLOWED_ORIGIN  = "https://mathieu.carbou.me";

// Validation stricte de l'hôte API ciblé par la requête.
// Autorise "prep-api.carbou.me" et des variantes suffixées (ex: prep-api-dev.carbou.me)
// tout en interdisant les sous-domaines inattendus.
// A adapter en cas de changement de domaine ou de convention de nommage.
const ALLOWED_HOST_RE = /^prep-api(?:-[a-z0-9]+)?\.carbou\.me$/;

// TTL (en secondes) du cache Cloudflare pour les jours passés.
// Les données historiques étant considérées immuables, on peut les cacher 24 h
// sans risque de divergence fonctionnelle.
const TTL_PAST        = 86400;

// TTL maximal (en secondes) pour les données du jour (PREP/SPOT).
// Le cache est aligné sur des slots de rafraîchissement intra-heure (05/20/35/50),
// puis plafonné à cette valeur pour garantir une fraîcheur raisonnable.
const TTL_TODAY_MAX   = 900;

// TTL (en secondes) du cache PRD3.
// Les profils PRD3 sont consommés comme données journalières stables,
// donc un cache 24 h est approprié.
const TTL_PRD3        = 86400;

// 3ERL : RTE publie de nouvelles valeurs PREP à chaque quart-d'heure, mais
// l'API 3ERL ne les récupère qu'aux minutes 3, 18, 33, 48 (avec quelques secondes
// de traitement supplémentaires). On utilise un cache intelligent qui :
//   - sert le cache directement en dehors de ces fenêtres de mise à jour,
//   - poll l'upstream chaque minute pendant la fenêtre (3-8, 18-23, 33-38, 48-53),
//   - compare Heure_Update : si inchangé → cache 60s et on réessaie,
//     si changé → cache jusqu'à la prochaine fenêtre de mise à jour.

// Intervalles de poll pendant la fenêtre d'attente de mise à jour
const ERL_POLL_INTERVAL_SECONDS = 60;
// Durée de la fenêtre de poll après chaque minute de mise à jour (3, 18, 33, 48)
const ERL_POLL_WINDOW_SECONDS    = 300;   // 0..5 min après la minute de mise à jour
// Minutes auxquelles 3ERL met à jour ses données depuis RTE
const ERL_UPDATE_MINUTES = [3, 18, 33, 48];

// Mode développement :
// - true  => assouplit les contrôles d'accès (CORS / host / origin) pour tests locaux,
// - false => applique toutes les règles de sécurité en production.
// Doit rester à false pour un déploiement public.
const DEV             = false;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isApiRequest = !DEV && url.pathname.startsWith("/api/");

    // CORS preflight
    if (request.method === "OPTIONS") {
      if (isApiRequest && !isAllowedApiClient(request)) {
        return new Response(null, { status: 403, headers: corsHeaders() });
      }
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Reject requests from unknown origins / countries
    if (isApiRequest && !isAllowedApiClient(request)) {
      return json({ error: "Forbidden" }, 403);
    }

    try {
      if (url.pathname === "/api/day") return await handleDayRequest(request, ctx, url);
      if (url.pathname === "/api/erl") return await handleErlRequest(request, ctx);
      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: e.message || "Worker error" }, 500);
    }
  },
};

// ─── /api/day handler ─────────────────────────────────────────────────────────

async function handleDayRequest(request, ctx, url) {
  const day = url.searchParams.get("day"); // YYYY-MM-DD
  if (!isIsoDay(day)) return json({ error: "Invalid day" }, 400);

  const isPast = isPastParisDay(day);

  // Zone cache: only for past days (data is immutable once the day is over)
  if (isPast) {
    const cacheKey = new Request(request.url, { method: "GET" });
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      // Re-parse body to inject cache: "HIT" on older bundles that predate the field,
      // and to avoid a consumed-stream issue when returning the cached response.
      let body = null;
      try { body = await cached.json(); } catch (_e) { /* fall through to re-fetch */ }
      if (body && typeof body === "object") {
        for (const key of ["prep", "spot", "prd3"]) {
          if (body[key] && !body[key].cache) body[key] = { ...body[key], cache: "HIT" };
        }
        // Propagate the remaining zone-cache TTL to the client so its cache
        // expires at the same time as the worker's (Age = seconds already spent in CF cache).
        const age = parseInt(cached.headers.get("Age") || "0", 10);
        const remainingTtl = Math.max(0, TTL_PAST - age);
        return json(body, 200, { "Cache-Control": `public, max-age=${remainingTtl}, immutable`, "X-Proxy-Cache": "HIT" });
      }
    }
  }

  // Fetch all three sources in parallel — individual errors yield empty rows (partial resilience)
  const { profileDay, profileLabel } = getPrd3ProfileInfo(day);
  const errSeries = (e) => ({ rows: [], fetchedAt: null, cache: "ERROR", error: e.message });
  const [prep, spot, prd3] = await Promise.all([
    fetchPrepSeries(day).catch(errSeries),
    fetchSpotSeries(day).catch(errSeries),
    fetchPrd3Series(profileDay).catch(errSeries),
  ]);

  // Don't cache past-day responses when one or more sources failed (incomplete data)
  const hasErrors = [prep, spot, prd3].some((s) => s && s.cache === "ERROR");

  const response = json(
    { day, profileDay, profileLabel, prep, spot, prd3 },
    200,
    { "Cache-Control": isPast && !hasErrors ? `public, max-age=${TTL_PAST}, immutable` : "no-store", "X-Proxy-Cache": isPast ? "MISS" : "BYPASS-TODAY" }
  );

  // Store past-day response in zone cache for future requests (only when all sources are complete)
  if (isPast && !hasErrors) {
    const cacheKey = new Request(request.url, { method: "GET" });
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    } else {
      await caches.default.put(cacheKey, response.clone());
    }
  }

  return response;
}

// ─── /api/erl handler ────────────────────────────────────────────────────────

async function handleErlRequest(request, ctx) {
  const erl = await fetch3ErlData().catch((e) => ({ data: null, fetchedAt: null, cache: "ERROR", error: e.message }));
  return json(erl, 200, { "Cache-Control": "no-store" });
}

// ─── Date / Paris timezone helpers ────────────────────────────────────────────

function isIsoDay(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v || "");
}

// Returns today's date as YYYY-MM-DD in Europe/Paris timezone.
// "en-CA" locale is used solely because it produces the YYYY-MM-DD format
// (ISO 8601), which allows safe lexicographic comparisons (day < today).
// The timeZone option controls the actual timezone — locale has no effect on it.
function parisTodayDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function isPastParisDay(day) {
  return isIsoDay(day) && day < parisTodayDay();
}

function addDaysIso(day, offset) {
  const utc = new Date(day + "T00:00:00Z");
  utc.setUTCDate(utc.getUTCDate() + offset);
  return utc.toISOString().slice(0, 10);
}

function nextRefreshDate(now = new Date()) {
  const slots = [5, 20, 35, 50];
  for (const minute of slots) {
    const candidate = new Date(now.getTime());
    candidate.setMinutes(minute, 0, 0);
    if (candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }
  const nextHour = new Date(now.getTime());
  nextHour.setHours(nextHour.getHours() + 1, slots[0], 0, 0);
  return nextHour;
}

function ttlTodayAlignedSeconds(now = new Date()) {
  const alignedTtl = Math.ceil((nextRefreshDate(now).getTime() - now.getTime()) / 1000);
  return Math.max(1, Math.min(TTL_TODAY_MAX, alignedTtl));
}

function todayRefreshSlotKey(now = new Date()) {
  const slot = nextRefreshDate(now);
  return slot.toISOString().slice(0, 16);
}

// ─── PRD3 profile day logic ────────────────────────────────────────────────────
//
// RTE publishes PRD3 profiles with a publication lag:
//   today     → use J-2 profile (earliest available)
//   yesterday → use J-1 profile
//   older     → use J0 (the day itself)
function getPrd3ProfileInfo(day) {
  const today = parisTodayDay();
  const yesterday = addDaysIso(today, -1);

  if (day === today) {
    return { profileDay: addDaysIso(day, -2), profileLabel: "J-2" };
  }
  if (day === yesterday) {
    return { profileDay: addDaysIso(day, -1), profileLabel: "J-1" };
  }
  return { profileDay: day, profileLabel: "J0" };
}

// ─── Per-source data fetchers ──────────────────────────────────────────────────
//
// Each returns { rows: [{ts: "HH:MM", value}], fetchedAt: ISO, cache: "HIT"|"MISS" }
// TTL policy: today=refresh-slot keyed cache (max 15 min), past=24 h, PRD3=24 h.

async function fetchPrepSeries(day) {
  const [y, m, d] = day.split("-");
  const isPast = isPastParisDay(day);
  const result = await fetchTextWithWorkerCache({
    cacheKey: isPast ? "prep:" + day : "prep:" + day + ":slot:" + todayRefreshSlotKey(),
    ttlSeconds: isPast ? TTL_PAST : ttlTodayAlignedSeconds(),
    target: `https://www.services-rte.com/cms/open_data/v1/price/table?startDate=${encodeURIComponent(`${d}/${m}/${y}`)}`,
    fetchOptions: { method: "GET" },
    errorLabel: "PREP",
  });
  return { rows: normalizePrepPayload(day, result.text), fetchedAt: result.fetchedAt, cache: result.cache };
}

async function fetchSpotSeries(day) {
  const [y, m, d] = day.split("-");
  const isPast = isPastParisDay(day);
  const result = await fetchTextWithWorkerCache({
    cacheKey: isPast ? "spot:" + day : "spot:" + day + ":slot:" + todayRefreshSlotKey(),
    ttlSeconds: isPast ? TTL_PAST : ttlTodayAlignedSeconds(),
    target: `https://eco2mix.rte-france.com/curves/getDonneesMarche?dateDeb=${d}/${m}/${y}&dateFin=${d}/${m}/${y}&mode=NORM`,
    fetchOptions: { method: "GET" },
    errorLabel: "SPOT",
  });
  return { rows: parseFranceSpotXml(day, result.text), fetchedAt: result.fetchedAt, cache: result.cache };
}

async function fetchPrd3Series(profileDay) {
  // Enedis Koumoul API — PRD3_BASE sous-profil, daily 15-min coefficients
  const where = `(sous_profil='PRD3_BASE') AND horodate >= '${profileDay}T00:00:00' AND horodate <= '${profileDay}T23:59:59'`;
  const body = new URLSearchParams({
    action: "exports", output: "exportDirect", format: "json",
    dataset: "koumoul://7okolrt07nor9cv103spkfzc", apikey: "false",
    datefield: "horodate", select: "horodate, coefficient_dynamique_j_1",
    where, group: "", order: "horodate desc",
  });
  const result = await fetchTextWithWorkerCache({
    cacheKey: "prd3:" + profileDay,
    ttlSeconds: TTL_PRD3,
    target: "https://openservices.enedis.fr/php/opendata.php",
    fetchOptions: { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body },
    errorLabel: "PRD3",
  });
  return { rows: normalizePrd3Payload(result.text), fetchedAt: result.fetchedAt, cache: result.cache };
}

// ─── Worker-side source cache helper ──────────────────────────────────────────
//
// Uses a synthetic internal URL (worker-cache.internal/<key>) as the cache key.
// X-Source-Fetched-At preserves the original upstream fetch time across cache HITs.

async function fetchTextWithWorkerCache({ cacheKey, ttlSeconds, target, fetchOptions, errorLabel }) {
  const cacheRequest = new Request("https://worker-cache.internal/" + encodeURIComponent(cacheKey), { method: "GET" });

  if (ttlSeconds > 0) {
    const hit = await caches.default.match(cacheRequest);
    if (hit) {
      // console.log("CACHE HIT", target);
      return { text: await hit.text(), fetchedAt: hit.headers.get("X-Source-Fetched-At") || new Date().toISOString(), cache: "HIT" };
    }
  }

  // console.log("FETCH", target);
  const upstream = await fetch(target, fetchOptions);
  const text = await upstream.text();
  if (!upstream.ok) throw new Error((errorLabel || "Upstream") + " error: " + upstream.status);

  const fetchedAt = new Date().toISOString();
  if (ttlSeconds > 0) {
    // console.log("CACHE PUT", target);
    await caches.default.put(cacheRequest, new Response(text, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=" + ttlSeconds,
        "X-Source-Fetched-At": fetchedAt,
      },
    }));
  }
  return { text, fetchedAt, cache: "MISS" };
}

// ─── 3ERL data (smart update-slot-aligned cache) ───────────────────────────
//
// 3ERL fetches new PREP data from RTE at minutes 3, 18, 33, 48 of each hour
// (with a few seconds of processing). We use a smart cache strategy:
//
// 1. Outside the poll window (more than ERL_POLL_WINDOW_SECONDS after the last
//    update minute): serve from cache with TTL = time until the next poll window.
// 2. Inside the poll window (0–5 min after the update minute): fetch upstream and
//    compare Heure_Update:
//      a. Same Heure_Update → cache for ERL_POLL_INTERVAL_SECONDS, retry later.
//      b. Different Heure_Update (new data!) → cache until the next poll window.
//
// The cache entry stores the last observed Heure_Update so we can detect
// changes without keeping state in memory.

// Returns the last 3ERL update minute (3, 18, 33, or 48) that has passed, or -1
// if we are before the first update slot of the hour.
function lastErlUpdateMinute(parisMinutes) {
  for (let i = ERL_UPDATE_MINUTES.length - 1; i >= 0; i--) {
    if (parisMinutes >= ERL_UPDATE_MINUTES[i]) return ERL_UPDATE_MINUTES[i];
  }
  return -1;
}

// Returns the next 3ERL update minute (3, 18, 33, or 48) in the current hour,
// or the first slot of the next hour if all have passed.
function nextErlUpdateMinute(parisMinutes) {
  for (let i = 0; i < ERL_UPDATE_MINUTES.length; i++) {
    if (parisMinutes < ERL_UPDATE_MINUTES[i]) return ERL_UPDATE_MINUTES[i];
  }
  return ERL_UPDATE_MINUTES[0] + 60; // first slot of next hour
}

// Seconds remaining until the next 3ERL update minute (start of poll window)
function secondsUntilNextErlUpdate(parisMinutes) {
  const nextMin = nextErlUpdateMinute(parisMinutes);
  const remainingMin = nextMin - parisMinutes;
  return Math.max(ERL_POLL_INTERVAL_SECONDS, Math.ceil(remainingMin * 60));
}

async function fetch3ErlData() {
  const now = new Date();
  const parisParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(now);
  let ph = "00", pm = "00", ps = "00";
  for (const p of parisParts) { if (p.type === "hour") ph = p.value; if (p.type === "minute") pm = p.value; if (p.type === "second") ps = p.value; }
  const parisMinutes = Number(ph) * 60 + Number(pm) + Number(ps) / 60; // minutes since midnight (Paris)

  const lastUpdate = lastErlUpdateMinute(parisMinutes);
  const inPollWindow = lastUpdate >= 0 && (parisMinutes - lastUpdate) * 60 < ERL_POLL_WINDOW_SECONDS;

  const cacheRequest = new Request("https://worker-cache.internal/" + encodeURIComponent("3erl:smart"), { method: "GET" });

  // --- Try cache -----------------------------------------------------------
  const hit = await caches.default.match(cacheRequest);
  if (hit) {
    const cachedText = await hit.text();
    const cachedHeureUpdate = hit.headers.get("X-3ERL-Heure-Update") || "";
    const cachedAt = hit.headers.get("X-Source-Fetched-At") || new Date().toISOString();

    if (!inPollWindow) {
      // Stable period: serve cache directly
      return { data: safeJson(cachedText), fetchedAt: cachedAt, cache: "HIT" };
    }

    // Poll window: we have a cached entry, but we need to check if 3ERL has
    // published new data. Fetch upstream and compare Heure_Update.
    const upstream = await fetch("https://3erl.fr/api.json", { method: "GET" });
    if (!upstream.ok) throw new Error("3ERL error: " + upstream.status);
    const upstreamText = await upstream.text();
    const upstreamData = safeJson(upstreamText);
    const upstreamHeureUpdate = upstreamData && upstreamData.Heure_Update || "";
    const fetchedAt = new Date().toISOString();

    if (upstreamHeureUpdate && upstreamHeureUpdate !== cachedHeureUpdate) {
      // New data! Cache until the next poll window starts.
      const ttl = secondsUntilNextErlUpdate(parisMinutes);
      await put3ErlCache(cacheRequest, upstreamText, upstreamHeureUpdate, fetchedAt, ttl);
      return { data: upstreamData, fetchedAt, cache: "MISS" };
    }

    // Same data: cache for one poll interval and serve the cached version
    await put3ErlCache(cacheRequest, cachedText, cachedHeureUpdate, cachedAt, ERL_POLL_INTERVAL_SECONDS);
    return { data: safeJson(cachedText), fetchedAt: cachedAt, cache: "HIT" };
  }

  // --- No cache: fetch upstream and store -----------------------------------
  const upstream = await fetch("https://3erl.fr/api.json", { method: "GET" });
  if (!upstream.ok) throw new Error("3ERL error: " + upstream.status);
  const text = await upstream.text();
  const data = safeJson(text);
  const heureUpdate = data && data.Heure_Update || "";
  const fetchedAt = new Date().toISOString();

  const ttl = inPollWindow ? ERL_POLL_INTERVAL_SECONDS : secondsUntilNextErlUpdate(parisMinutes);
  await put3ErlCache(cacheRequest, text, heureUpdate, fetchedAt, ttl);
  return { data, fetchedAt, cache: "MISS" };
}

function put3ErlCache(cacheRequest, text, heureUpdate, fetchedAt, ttlSeconds) {
  return caches.default.put(cacheRequest, new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=" + ttlSeconds,
      "X-Source-Fetched-At": fetchedAt,
      "X-3ERL-Heure-Update": heureUpdate,
    },
  }));
}

function safeJson(text) {
  try { return JSON.parse(text); } catch (_e) { return null; }
}

// ─── CORS / access-control ────────────────────────────────────────────────────

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function isAllowedApiClient(request) {
  return isAllowedApiHost(request) && isAllowedSiteOrigin(request) && isAllowedCountry(request);
}

function isAllowedApiHost(request) {
  const host = String(request.headers.get("Host") || "").toLowerCase();
  return ALLOWED_HOST_RE.test(host);
}

function isAllowedSiteOrigin(request) {
  const origin = String(request.headers.get("Origin") || "").toLowerCase();
  const referer = String(request.headers.get("Referer") || "").toLowerCase();
  return origin ? origin === ALLOWED_ORIGIN : referer.startsWith(ALLOWED_ORIGIN + "/");
}

function isAllowedCountry(request) {
  return String(request.headers.get("CF-IPCountry") || "").toUpperCase() === "FR";
}

// ─── Response normalizers / Parsers ───────────────────────────────────────────
//
// All normalizers output [{ts: "HH:MM", value: number}] sorted ascending.

// RTE open-data price table — PRE+ values in €/MWh
function normalizePrepPayload(day, text) {
  const { values = [] } = JSON.parse(text);
  return (Array.isArray(values) ? values : [])
    .filter((e) => typeof e.date === "string" && e.date.slice(0, 10) === day)
    .map((e) => ({ ts: toTimeSlot(e.date), value: Number(e.pre && e.pre.positive) }))
    .filter((e) => isTimeSlot(e.ts) && Number.isFinite(e.value))
    .sort(sortByTs);
}

// Enedis Koumoul API — PRD3_BASE dynamic coefficient (dimensionless)
function normalizePrd3Payload(text) {
  const values = JSON.parse(text);
  return (Array.isArray(values) ? values : [])
    .map((row) => ({ ts: toTimeSlot(row && row.horodate), value: Number(row && row.coefficient_dynamique_j_1) }))
    .filter((e) => isTimeSlot(e.ts) && Number.isFinite(e.value))
    .sort(sortByTs);
}

// RTE eco2mix XML — France SPOT price in €/MWh, hourly or 15-min periods
function parseFranceSpotXml(day, xml) {
  const dayBlock = xml.match(
    new RegExp(`<donneesMarche\\b[^>]*date=['\"]${escapeRegExp(day)}['\"][^>]*>([\\s\\S]*?)<\\/donneesMarche>`)
  );
  const typeBlock = (dayBlock ? dayBlock[1] : xml).match(
    /<type\b[^>]*perimetre=['\"]FR['\"][^>]*>([\s\S]*?)<\/type>/
  );
  if (!typeBlock) return [];

  const rawValues = [];
  const re = /<valeur\b[^>]*periode=['\"](\d+)['\"][^>]*>([^<]*)<\/valeur>/g;
  let m;
  while ((m = re.exec(typeBlock[1])) !== null) {
    const period = Number(m[1]);
    const value = Number(String(m[2] || "").trim().replace(",", "."));
    if (Number.isFinite(period) && Number.isFinite(value)) rawValues.push({ period, value });
  }

  const stepMinutes = rawValues.some((e) => e.period > 23) ? 15 : 60;
  return rawValues
    .map(({ period, value }) => ({ ts: buildPeriodDate(period, stepMinutes), value }))
    .sort(sortByTs);
}

// ─── Misc utilities ───────────────────────────────────────────────────────────

// Convert a period index to "HH:MM" (e.g. period=3, step=15 → "00:45")
function buildPeriodDate(period, stepMinutes) {
  const total = period * stepMinutes;
  return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}

// Extract "HH:MM" from an ISO timestamp, or pass through if already a slot
function toTimeSlot(value) {
  const text = String(value || "");
  const m = text.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : (isTimeSlot(text) ? text : null);
}

function isTimeSlot(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ""));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortByTs(a, b) {
  return String(a.ts).localeCompare(String(b.ts));
}

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json", ...extraHeaders },
  });
}