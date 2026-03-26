export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      if (url.pathname === "/api/3erl") {
        return proxyJson("https://3erl.fr/api.json");
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

async function proxyJson(target) {
  const upstream = await fetch(target, { method: "GET" });
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

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}