export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      if (url.pathname === "/api/3erl") {
        return proxyJson("https://3erl.fr/api.json", {
          request,
          ctx,
          ttlSeconds: 300,
          staleOn429: true,
        });
      }

      if (url.pathname === "/api/rte") {
        const day = url.searchParams.get("day"); // YYYY-MM-DD
        if (!isIsoDay(day)) return json({ error: "Invalid day" }, 400);

        const cachePastDay = isPastParisDay(day);

        const [y, m, d] = day.split("-");
        const startDate = encodeURIComponent(`${d}/${m}/${y}`);
        const target = `https://www.services-rte.com/cms/open_data/v1/price/table?startDate=${startDate}`;
        return proxyJson(target, {
          request,
          ctx,
          useCache: cachePastDay,
          ttlSeconds: 1 * 24 * 60 * 60,
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

        const upstream = await fetch("https://openservices.enedis.fr/php/opendata.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body,
          cf: cachePastDay
            ? {
                cacheEverything: true,
                cacheTtl: 1 * 24 * 60 * 60,
              }
            : undefined,
        });

        const text = await upstream.text();
        return new Response(text, {
          status: upstream.status,
          headers: {
            ...corsHeaders(),
            "Content-Type": upstream.headers.get("Content-Type") || "application/json",
            "Cache-Control": cachePastDay ? "public, max-age=86400" : "no-store",
            "X-Proxy-Cache": cachePastDay ? "ENABLED-PAST-DAY" : "BYPASS-TODAY",
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

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://mathieu.carbou.me",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function proxyJson(target, options) {
  return proxyJsonWithOptions(target, options || {});
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

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}