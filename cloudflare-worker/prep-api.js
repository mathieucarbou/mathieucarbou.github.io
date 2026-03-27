export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isApiRequest = url.pathname.startsWith("/api/");

    if (request.method === "OPTIONS") {
      if (isApiRequest && !isAllowedApiClient(request)) {
        return new Response(null, { status: 403, headers: corsHeaders() });
      }
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (isApiRequest && !isAllowedApiClient(request)) {
      return json({ error: "Forbidden" }, 403);
    }

    try {
      if (isLegacyEndpoint(url.pathname)) {
        return json({ error: "Not found" }, 404);
      }

      if (url.pathname === "/api/3erl") {
        return proxyJson("https://3erl.fr/api.json", {
          request,
          ctx,
          ttlSeconds: 300,
          staleOn429: true,
        });
      }

      if (url.pathname === "/api/day") {
        const day = url.searchParams.get("day"); // YYYY-MM-DD
        if (!isIsoDay(day)) return json({ error: "Invalid day" }, 400);

        const cachePastDay = isPastParisDay(day);
        const cache = cachePastDay ? caches.default : null;
        const cacheKey = cachePastDay ? new Request(request.url, { method: "GET" }) : null;

        if (cachePastDay && cache && cacheKey) {
          const cached = await cache.match(cacheKey);
          if (cached) {
            return withCorsAndCacheHeaders(cached, "HIT");
          }
        }

        const profileInfo = getPrd3ProfileInfo(day);
        const profileDay = profileInfo.profileDay;
        const profileLabel = profileInfo.profileLabel;
        const include3Erl = day === parisTodayDay();

        const results = await Promise.all([
          fetchPrepSeries(day, cachePastDay),
          fetchSpotSeries(day, cachePastDay),
          fetchPrd3Series(profileDay, isPastParisDay(profileDay)),
          include3Erl ? fetch3ErlData() : Promise.resolve(null),
        ]);

        const payload = {
          day,
          profileDay,
          profileLabel,
          prep: results[0],
          spot: results[1],
          prd3: results[2],
          erl: results[3],
        };

        const response = json(payload, 200, {
          "Cache-Control": cachePastDay ? "public, max-age=86400" : "no-store",
          "X-Proxy-Cache": cachePastDay ? "MISS" : "BYPASS-TODAY",
        });

        if (cachePastDay && cache && cacheKey) {
          if (ctx && typeof ctx.waitUntil === "function") {
            ctx.waitUntil(cache.put(cacheKey, response.clone()));
          } else {
            await cache.put(cacheKey, response.clone());
          }
        }

        return response;
      }

      if (url.pathname === "/api/rte") {
        const day = url.searchParams.get("day"); // YYYY-MM-DD
        if (!isIsoDay(day)) return json({ error: "Invalid day" }, 400);

        const cachePastDay = isPastParisDay(day);

        const [y, m, d] = day.split("-");
        const startDate = encodeURIComponent(`${d}/${m}/${y}`);
        const target = `https://www.services-rte.com/cms/open_data/v1/price/table?startDate=${startDate}`;
        return proxyData(target, {
          request,
          ctx,
          useCache: cachePastDay,
          ttlSeconds: 1 * 24 * 60 * 60,
          transform(text) {
            return normalizePrepPayload(day, text);
          },
        });
      }

      if (url.pathname === "/api/spot") {
        const day = url.searchParams.get("day"); // YYYY-MM-DD
        if (!isIsoDay(day)) return json({ error: "Invalid day" }, 400);

        const cachePastDay = isPastParisDay(day);
        const [y, m, d] = day.split("-");
        const target = `https://eco2mix.rte-france.com/curves/getDonneesMarche?dateDeb=${d}/${m}/${y}&dateFin=${d}/${m}/${y}&mode=NORM`;

        return proxyData(target, {
          request,
          ctx,
          useCache: cachePastDay,
          ttlSeconds: 1 * 24 * 60 * 60,
          transform(text) {
            return parseFranceSpotXml(day, text);
          },
        });
      }

      if (url.pathname === "/api/prd3") {
        const profileDay = url.searchParams.get("profileDay"); // YYYY-MM-DD
        if (!isIsoDay(profileDay)) return json({ error: "Invalid profileDay" }, 400);

        const cachePastDay = isPastParisDay(profileDay);

        const where = `(sous_profil='PRD3_BASE') AND horodate >= '${profileDay}T00:00:00' AND horodate <= '${profileDay}T23:59:59'`;
        const body = new URLSearchParams({
          action: "exports",
          output: "exportDirect",
          format: "json",
          dataset: "koumoul://7okolrt07nor9cv103spkfzc",
          apikey: "false",
          datefield: "horodate",
          select: "horodate, coefficient_dynamique_j_1",
          where,
          group: "",
          order: "horodate desc",
        });

        return proxyData("https://openservices.enedis.fr/php/opendata.php", {
          request,
          ctx,
          useCache: cachePastDay,
          ttlSeconds: 1 * 24 * 60 * 60,
          fetchOptions: {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body,
          },
          transform(text) {
            return normalizePrd3Payload(text);
          },
        });
      }

      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: e.message || "Worker error" }, 500);
    }
  },
};

function isIsoDay(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v || "");
}

function parisTodayDay() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function isPastParisDay(day) {
  if (!isIsoDay(day)) {
    return false;
  }
  return day < parisTodayDay();
}

function addDaysIso(day, offset) {
  const utc = new Date(day + "T00:00:00Z");
  utc.setUTCDate(utc.getUTCDate() + offset);
  return utc.toISOString().slice(0, 10);
}

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

async function fetchPrepSeries(day, useCache) {
  const [y, m, d] = day.split("-");
  const startDate = encodeURIComponent(`${d}/${m}/${y}`);
  const target = `https://www.services-rte.com/cms/open_data/v1/price/table?startDate=${startDate}`;

  const upstream = await fetch(target, useCache
    ? { cf: { cacheEverything: true, cacheTtl: 86400 } }
    : undefined);
  const text = await upstream.text();

  if (!upstream.ok) {
    throw new Error("PREP upstream error: " + upstream.status);
  }

  return normalizePrepPayload(day, text);
}

async function fetchSpotSeries(day, useCache) {
  const [y, m, d] = day.split("-");
  const target = `https://eco2mix.rte-france.com/curves/getDonneesMarche?dateDeb=${d}/${m}/${y}&dateFin=${d}/${m}/${y}&mode=NORM`;

  const upstream = await fetch(target, useCache
    ? { cf: { cacheEverything: true, cacheTtl: 86400 } }
    : undefined);
  const text = await upstream.text();

  if (!upstream.ok) {
    throw new Error("SPOT upstream error: " + upstream.status);
  }

  return parseFranceSpotXml(day, text);
}

async function fetchPrd3Series(profileDay, useCache) {
  const where = `(sous_profil='PRD3_BASE') AND horodate >= '${profileDay}T00:00:00' AND horodate <= '${profileDay}T23:59:59'`;
  const body = new URLSearchParams({
    action: "exports",
    output: "exportDirect",
    format: "json",
    dataset: "koumoul://7okolrt07nor9cv103spkfzc",
    apikey: "false",
    datefield: "horodate",
    select: "horodate, coefficient_dynamique_j_1",
    where,
    group: "",
    order: "horodate desc",
  });

  const upstream = await fetch("https://openservices.enedis.fr/php/opendata.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
    cf: useCache ? { cacheEverything: true, cacheTtl: 86400 } : undefined,
  });
  const text = await upstream.text();

  if (!upstream.ok) {
    throw new Error("PRD3 upstream error: " + upstream.status);
  }

  return normalizePrd3Payload(text);
}

async function fetch3ErlData() {
  const upstream = await fetch("https://3erl.fr/api.json", {
    method: "GET",
    cf: { cacheEverything: true, cacheTtl: 300 },
  });
  if (!upstream.ok) {
    return null;
  }
  try {
    return await upstream.json();
  } catch (_e) {
    return null;
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://mathieu.carbou.me",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function isAllowedApiClient(request) {
  return isAllowedApiHost(request) && isAllowedSiteOrigin(request) && isAllowedCountry(request);
}

function isAllowedApiHost(request) {
  const host = String(request.headers.get("Host") || "").toLowerCase();
  return /^prep-api(?:-[a-z0-9]+)?\.carbou\.me$/.test(host);
}

function isAllowedSiteOrigin(request) {
  const allowedOrigin = "https://mathieu.carbou.me";
  const origin = String(request.headers.get("Origin") || "").toLowerCase();
  const referer = String(request.headers.get("Referer") || "").toLowerCase();

  if (origin) {
    return origin === allowedOrigin;
  }
  return referer.startsWith(allowedOrigin + "/");
}

function isAllowedCountry(request) {
  const country = String(request.headers.get("CF-IPCountry") || "").toUpperCase();
  return country === "FR";
}

function isLegacyEndpoint(pathname) {
  return pathname === "/api/3erl" || pathname === "/api/rte" || pathname === "/api/spot" || pathname === "/api/prd3";
}

async function proxyJson(target, options) {
  return proxyJsonWithOptions(target, options || {});
}

async function proxyData(target, options) {
  const request = options && options.request;
  const ctx = options && options.ctx;
  const useCache = !(options && options.useCache === false);
  const ttlSeconds = (options && options.ttlSeconds) || 60;
  const transform = options && options.transform;
  const baseFetchOptions = (options && options.fetchOptions) || { method: "GET" };

  var cache = null;
  var cacheKey = null;
  var cached = null;

  if (useCache && request) {
    cache = caches.default;
    cacheKey = new Request(request.url, { method: "GET" });
    cached = await cache.match(cacheKey);
  }

  const fetchOptions = { ...baseFetchOptions };
  if (useCache && ttlSeconds > 0) {
    fetchOptions.cf = {
      ...(baseFetchOptions.cf || {}),
      cacheEverything: true,
      cacheTtl: ttlSeconds,
    };
  }

  const upstream = await fetch(target, fetchOptions);
  const text = await upstream.text();

  if (!upstream.ok) {
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...corsHeaders(),
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        "Cache-Control": useCache ? "public, max-age=" + ttlSeconds : "no-store",
        "X-Proxy-Cache": useCache ? (cached ? "MISS" : "BYPASS") : "DISABLED",
      },
    });
  }

  const payload = transform ? transform(text) : JSON.parse(text);
  const response = json(payload, upstream.status, {
    "Cache-Control": useCache ? "public, max-age=" + ttlSeconds : "no-store",
    "X-Proxy-Cache": useCache ? (cached ? "MISS" : "BYPASS") : "DISABLED",
  });

  if (useCache && cache && cacheKey) {
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } else {
      await cache.put(cacheKey, response.clone());
    }
  }

  return response;
}

async function proxyJsonWithOptions(target, options) {
  const request = options && options.request;
  const ctx = options && options.ctx;
  const useCache = !(options && options.useCache === false);
  const ttlSeconds = (options && options.ttlSeconds) || 60;
  const staleOn429 = !!(options && options.staleOn429);

  var cache = null;
  var cacheKey = null;
  var cached = null;

  if (useCache && request) {
    cache = caches.default;
    cacheKey = new Request(request.url, { method: "GET" });
    cached = await cache.match(cacheKey);
  }

  const fetchOptions = { method: "GET" };
  if (useCache && ttlSeconds > 0) {
    fetchOptions.cf = {
      cacheEverything: true,
      cacheTtl: ttlSeconds,
    };
  }

  const upstream = await fetch(target, fetchOptions);

  if (staleOn429 && upstream.status === 429 && cached) {
    return withCorsAndCacheHeaders(cached, "STALE-429");
  }

  const text = await upstream.text();
  const response = new Response(text, {
    status: upstream.status,
    headers: {
      ...corsHeaders(),
      "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      "Cache-Control": useCache ? "public, max-age=" + ttlSeconds : "no-store",
      "X-Proxy-Cache": useCache ? (cached ? "MISS" : "BYPASS") : "DISABLED",
    },
  });

  if (useCache && upstream.ok && cache && cacheKey) {
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } else {
      await cache.put(cacheKey, response.clone());
    }
  }

  return response;
}

function withCorsAndCacheHeaders(response, cacheState) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
  headers.set("X-Proxy-Cache", cacheState);
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

function normalizePrepPayload(day, text) {
  const parsed = JSON.parse(text);
  const values = Array.isArray(parsed && parsed.values) ? parsed.values : [];

  return values
    .map((entry) => ({
      ts: entry && entry.date,
      value: Number(entry && entry.pre && entry.pre.positive),
    }))
    .filter((entry) => typeof entry.ts === "string" && entry.ts.slice(0, 10) === day && Number.isFinite(entry.value))
    .sort(sortByTs);
}

function normalizePrd3Payload(text) {
  const parsed = JSON.parse(text);
  const values = Array.isArray(parsed) ? parsed : [];

  return values
    .map((row) => ({
      ts: row && row.horodate,
      value: Number(row && row.coefficient_dynamique_j_1),
    }))
    .filter((entry) => typeof entry.ts === "string" && Number.isFinite(entry.value))
    .sort(sortByTs);
}

function parseFranceSpotXml(day, xml) {
  const dayPattern = new RegExp(`<donneesMarche\\b[^>]*date=['\"]${escapeRegExp(day)}['\"][^>]*>([\\s\\S]*?)<\\/donneesMarche>`);
  const dayMatch = xml.match(dayPattern);
  const dayBlock = dayMatch ? dayMatch[1] : xml;
  const typeMatch = dayBlock.match(/<type\b[^>]*perimetre=['\"]FR['\"][^>]*>([\s\S]*?)<\/type>/);

  if (!typeMatch) {
    return [];
  }

  const rawValues = [];
  const valuePattern = /<valeur\b[^>]*periode=['\"](\d+)['\"][^>]*>([^<]*)<\/valeur>/g;
  let match;

  while ((match = valuePattern.exec(typeMatch[1])) !== null) {
    const period = Number(match[1]);
    const value = Number(String(match[2] || "").trim().replace(",", "."));
    if (Number.isFinite(period) && Number.isFinite(value)) {
      rawValues.push({ period, value });
    }
  }

  const stepMinutes = rawValues.some((entry) => entry.period > 23) ? 15 : 60;

  return rawValues.map((entry) => ({
    ts: buildPeriodDate(day, entry.period, stepMinutes),
    value: entry.value,
  })).sort(sortByTs);
}

function buildPeriodDate(day, period, stepMinutes) {
  const totalMinutes = period * stepMinutes;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${day}T${hours}:${minutes}:00`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortByTs(a, b) {
  return new Date(a.ts) - new Date(b.ts);
}

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json", ...extraHeaders },
  });
}