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
      if (url.pathname === "/api/day") {
        const day = url.searchParams.get("day"); // YYYY-MM-DD
        if (!isIsoDay(day)) return json({ error: "Invalid day" }, 400);

        const cachePastDay = isPastParisDay(day);
        const cache = cachePastDay ? caches.default : null;
        const cacheKey = cachePastDay ? new Request(request.url, { method: "GET" }) : null;

        if (cachePastDay && cache && cacheKey) {
          const cached = await cache.match(cacheKey);
          if (cached) {
            // Patch source cache fields for bundles stored before the cache metadata was added
            try {
              const body = await cached.json();
              let patched = false;
              for (const key of ["prep", "spot", "prd3"]) {
                if (body[key] && typeof body[key] === "object" && !body[key].cache) {
                  body[key] = { ...body[key], cache: "HIT" };
                  patched = true;
                }
              }
              if (patched) {
                return json(body, 200, {
                  "Cache-Control": "public, max-age=86400",
                  "X-Proxy-Cache": "HIT",
                });
              }
            } catch (_e) {
              // JSON parse failed, fall through to raw response
            }
            return withCorsAndCacheHeaders(cached, "HIT");
          }
        }

        const profileInfo = getPrd3ProfileInfo(day);
        const profileDay = profileInfo.profileDay;
        const profileLabel = profileInfo.profileLabel;
        const include3Erl = day === parisTodayDay();

        const results = await Promise.all([
          fetchPrepSeries(day),
          fetchSpotSeries(day),
          fetchPrd3Series(profileDay),
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

async function fetchPrepSeries(day) {
  const [y, m, d] = day.split("-");
  const startDate = encodeURIComponent(`${d}/${m}/${y}`);
  const target = `https://www.services-rte.com/cms/open_data/v1/price/table?startDate=${startDate}`;

  const ttlSeconds = isPastParisDay(day) ? 86400 : 300;
  const cached = await fetchTextWithWorkerCache({
    cacheKey: "prep:" + day,
    ttlSeconds,
    target,
    fetchOptions: { method: "GET" },
    errorLabel: "PREP",
  });

  return {
    rows: normalizePrepPayload(day, cached.text),
    fetchedAt: cached.fetchedAt,
    cache: cached.cache,
  };
}

async function fetchSpotSeries(day) {
  const [y, m, d] = day.split("-");
  const target = `https://eco2mix.rte-france.com/curves/getDonneesMarche?dateDeb=${d}/${m}/${y}&dateFin=${d}/${m}/${y}&mode=NORM`;

  const ttlSeconds = isPastParisDay(day) ? 86400 : 300;
  const cached = await fetchTextWithWorkerCache({
    cacheKey: "spot:" + day,
    ttlSeconds,
    target,
    fetchOptions: { method: "GET" },
    errorLabel: "SPOT",
  });

  return {
    rows: parseFranceSpotXml(day, cached.text),
    fetchedAt: cached.fetchedAt,
    cache: cached.cache,
  };
}

async function fetchPrd3Series(profileDay) {
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

  const cached = await fetchTextWithWorkerCache({
    cacheKey: "prd3:" + profileDay,
    ttlSeconds: 86400,
    target: "https://openservices.enedis.fr/php/opendata.php",
    fetchOptions: {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body,
    },
    errorLabel: "PRD3",
  });

  return {
    rows: normalizePrd3Payload(cached.text),
    fetchedAt: cached.fetchedAt,
    cache: cached.cache,
  };
}

async function fetchTextWithWorkerCache(options) {
  const cacheKey = options && options.cacheKey;
  const ttlSeconds = (options && options.ttlSeconds) || 0;
  const target = options && options.target;
  const fetchOptions = (options && options.fetchOptions) || { method: "GET" };
  const errorLabel = (options && options.errorLabel) || "Upstream";

  const cache = caches.default;
  const workerCacheRequest = new Request("https://worker-cache.internal/" + encodeURIComponent(cacheKey), { method: "GET" });

  if (ttlSeconds > 0) {
    const cached = await cache.match(workerCacheRequest);
    if (cached) {
      const cachedFetchedAt = cached.headers.get("X-Source-Fetched-At") || new Date().toISOString();
      return {
        text: await cached.text(),
        fetchedAt: cachedFetchedAt,
        cache: "HIT",
      };
    }
  }

  const upstream = await fetch(target, fetchOptions);
  const text = await upstream.text();

  if (!upstream.ok) {
    throw new Error(errorLabel + " upstream error: " + upstream.status);
  }

  const fetchedAt = new Date().toISOString();

  if (ttlSeconds > 0) {
    const cacheResponse = new Response(text, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=" + ttlSeconds,
        "X-Source-Fetched-At": fetchedAt,
      },
    });
    await cache.put(workerCacheRequest, cacheResponse);
  }

  return {
    text,
    fetchedAt,
    cache: "MISS",
  };
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