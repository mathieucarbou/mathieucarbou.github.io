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

        const [y, m, d] = day.split("-");
        const startDate = encodeURIComponent(`${d}/${m}/${y}`);
        const target = `https://www.services-rte.com/cms/open_data/v1/price/table?startDate=${startDate}`;
        return proxyJson(target);
      }

      if (url.pathname === "/api/prd3") {
        const profileDay = url.searchParams.get("profileDay"); // YYYY-MM-DD
        if (!isIsoDay(profileDay)) return json({ error: "Invalid profileDay" }, 400);

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
        });

        const text = await upstream.text();
        return new Response(text, {
          status: upstream.status,
          headers: {
            ...corsHeaders(),
            "Content-Type": upstream.headers.get("Content-Type") || "application/json",
            "Cache-Control": "public, max-age=60",
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
  const ttlSeconds = (options && options.ttlSeconds) || 60;
  const staleOn429 = !!(options && options.staleOn429);

  var cache = null;
  var cacheKey = null;
  var cached = null;

  if (request) {
    cache = caches.default;
    cacheKey = new Request(request.url, { method: "GET" });
    cached = await cache.match(cacheKey);
  }

  const upstream = await fetch(target, {
    method: "GET",
    cf: {
      cacheEverything: true,
      cacheTtl: ttlSeconds,
    },
  });

  if (staleOn429 && upstream.status === 429 && cached) {
    return withCorsAndCacheHeaders(cached, "STALE-429");
  }

  const text = await upstream.text();
  const response = new Response(text, {
    status: upstream.status,
    headers: {
      ...corsHeaders(),
      "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      "Cache-Control": "public, max-age=" + ttlSeconds,
      "X-Proxy-Cache": cached ? "MISS" : "BYPASS",
    },
  });

  if (upstream.ok && cache && cacheKey) {
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