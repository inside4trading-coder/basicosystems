import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NOTION_VERSION = "2026-03-11";

function notionHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function notionRequest(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.notion.com${path}`, {
    ...init,
    headers: {
      ...notionHeaders(token),
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return { res, data };
}

function notionError(prefix: string, status: number, data: any) {
  const code = data?.code ? ` (${data.code})` : "";
  const message = data?.message || data?.error || "Notion API error";
  return `${prefix}: ${status}${code} — ${message}`;
}

function extractRichText(items: any[] | undefined): string {
  if (!Array.isArray(items)) return "";
  return items.map((item: any) => item?.plain_text || "").join("").trim();
}

function normalizeSource(source: any) {
  const props: Record<string, { type: string; name: string }> = {};

  for (const [key, val] of Object.entries(source.properties || {})) {
    props[key] = { type: (val as any).type, name: (val as any).name || key };
  }

  const title = extractRichText(source.title);

  return {
    id: source.id,
    name: title,
    url: source.url || "",
    properties: props,
  };
}

// ── helpers to extract property values ──

function extractTitle(prop: any): string {
  if (prop?.type !== "title") return "";
  return (prop.title || []).map((t: any) => t.plain_text || "").join("");
}

function extractPeople(prop: any): { name: string; avatar_url: string | null }[] {
  if (prop?.type !== "people") return [];
  return (prop.people || []).map((p: any) => ({
    name: p.name || "",
    avatar_url: p.avatar_url || null,
  }));
}

function extractStatus(prop: any): { name: string; color: string } | null {
  if (prop?.type === "status" && prop.status) {
    return { name: prop.status.name, color: prop.status.color };
  }
  if (prop?.type === "select" && prop.select) {
    return { name: prop.select.name, color: prop.select.color };
  }
  return null;
}

function extractSelect(prop: any): { name: string; color: string } | null {
  if (prop?.type === "select" && prop.select) {
    return { name: prop.select.name, color: prop.select.color };
  }
  return null;
}

function extractDate(prop: any): { start: string | null; end: string | null } | null {
  if (prop?.type !== "date" || !prop.date) return null;
  return { start: prop.date.start || null, end: prop.date.end || null };
}

function extractArea(prop: any): string | null {
  if (prop?.type === "select" && prop.select) return prop.select.name;
  if (prop?.type === "multi_select" && prop.multi_select?.length) {
    return prop.multi_select.map((s: any) => s.name).join(", ");
  }
  return null;
}

// ── actions ──

async function listDatabases(token: string) {
  const sourceSearch = await notionRequest(token, "/v1/search", {
    method: "POST",
    body: JSON.stringify({
      filter: { value: "data_source", property: "object" },
      page_size: 100,
    }),
  });
  console.log(
    "Notion search(data_source):",
    sourceSearch.res.status,
    JSON.stringify(sourceSearch.data).substring(0, 500)
  );

  let results = Array.isArray(sourceSearch.data?.results) ? sourceSearch.data.results : [];
  let searchMode = "data_source";

  if (!sourceSearch.res.ok || results.length === 0) {
    const legacySearch = await notionRequest(token, "/v1/search", {
      method: "POST",
      body: JSON.stringify({
        filter: { value: "database", property: "object" },
        page_size: 100,
      }),
    });

    console.log(
      "Notion search(database fallback):",
      legacySearch.res.status,
      JSON.stringify(legacySearch.data).substring(0, 500)
    );

    if (!legacySearch.res.ok && !sourceSearch.res.ok) {
      return json(
        {
          error: notionError("Notion search failed", sourceSearch.res.status, sourceSearch.data),
        },
        502
      );
    }

    if (legacySearch.res.ok && Array.isArray(legacySearch.data?.results) && legacySearch.data.results.length > 0) {
      results = legacySearch.data.results;
      searchMode = "database";
    }
  }

  const databases = results
    .filter((source: any) => source.object === "data_source" || source.object === "database")
    .filter((source: any) => Object.keys(source.properties || {}).length > 0)
    .map(normalizeSource)
    .filter((source: any) => source.name && source.name.trim().length > 0);

  const uniqueDatabases = Array.from(new Map(databases.map((source: any) => [source.id, source])).values());

  console.log(
    `Notion sources normalized: mode=${searchMode}, raw=${results.length}, valid=${uniqueDatabases.length}`
  );

  if (results.length > 0 && uniqueDatabases.length === 0) {
    return json(
      {
        error:
          "Notion devolvió fuentes compartidas, pero ninguna pudo normalizarse con el modelo actual de data sources.",
      },
      502
    );
  }

  return json({ databases: uniqueDatabases });
}

async function queryDatabase(token: string, databaseId: string, fallbackName = "") {
  let databaseName = fallbackName;
  let data: any = null;
  let sourceMode = "data_source";

  const dataSourceMeta = await notionRequest(token, `/v1/data_sources/${databaseId}`);

  if (dataSourceMeta.res.ok && dataSourceMeta.data?.object === "data_source") {
    databaseName = extractRichText(dataSourceMeta.data.title) || fallbackName || "Fuente sin título";

    const queryRes = await notionRequest(token, `/v1/data_sources/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify({ page_size: 100 }),
    });

    if (!queryRes.res.ok) {
      return json(
        { error: notionError("Notion data source query failed", queryRes.res.status, queryRes.data) },
        502
      );
    }

    data = queryRes.data;
  } else {
    sourceMode = "database";

    if (!dataSourceMeta.res.ok) {
      console.log(
        `Data source retrieve fallback for ${databaseId}: ${dataSourceMeta.res.status} ${JSON.stringify(dataSourceMeta.data).substring(0, 300)}`
      );
    }

    const dbMeta = await notionRequest(token, `/v1/databases/${databaseId}`);
    if (!dbMeta.res.ok) {
      return json(
        { error: notionError("Notion source retrieve failed", dbMeta.res.status, dbMeta.data) },
        502
      );
    }

    databaseName = extractRichText(dbMeta.data.title) || fallbackName || "Fuente sin título";

    const queryRes = await notionRequest(token, `/v1/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify({ page_size: 100 }),
    });

    if (!queryRes.res.ok) {
      return json(
        { error: notionError("Notion database query failed", queryRes.res.status, queryRes.data) },
        502
      );
    }

    data = queryRes.data;
  }

  console.log(
    `Notion source query success: mode=${sourceMode}, source=${databaseId}, rows=${Array.isArray(data?.results) ? data.results.length : 0}`
  );

  const priorityKeys = ["priority", "prioridad"];
  const areaKeys = ["area", "proyecto", "project"];

  const tasks = (data.results || []).map((page: any) => {
    const props = page.properties || {};

    // Find fields by type / name
    let name = "";
    let assignee: { name: string; avatar_url: string | null }[] = [];
    let status: { name: string; color: string } | null = null;
    let date: { start: string | null; end: string | null } | null = null;
    let priority: { name: string; color: string } | null = null;
    let area: string | null = null;

    for (const [key, val] of Object.entries(props)) {
      const v = val as any;
      const keyLower = key.toLowerCase();

      if (v.type === "title") {
        name = extractTitle(v);
      }
      if (v.type === "people" && !assignee.length) {
        assignee = extractPeople(v);
      }
      if ((v.type === "status" || v.type === "select") && !status && !priorityKeys.includes(keyLower) && !areaKeys.includes(keyLower)) {
        status = extractStatus(v);
      }
      if (v.type === "date" && !date) {
        date = extractDate(v);
      }
      if (priorityKeys.includes(keyLower) && v.type === "select") {
        priority = extractSelect(v);
      }
      if (areaKeys.includes(keyLower)) {
        area = extractArea(v);
      }
    }

    return {
      id: page.id,
      name,
      assignee,
      status,
      date,
      priority,
      area,
      notion_url: page.url,
      database_id: databaseId,
      database_name: databaseName,
    };
  });

  return json({ tasks });
}

// ── serve ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const token = Deno.env.get("NOTION_TOKEN");
  if (!token) {
    return json({ error: "NOTION_TOKEN not configured" }, 500);
  }
  
  // Debug: log token prefix and length (never the full token)
  console.log(`NOTION_TOKEN present: length=${token.length}, prefix=${token.substring(0, 4)}, has_whitespace=${token !== token.trim()}`);

  try {
    const body = await req.json();
    const action = body.action;

    if (action === "list-databases") {
      return await listDatabases(token);
    }

    if (action === "query-database") {
      if (!body.database_id) {
        return json({ error: "database_id is required" }, 400);
      }
      return await queryDatabase(token, body.database_id, body.database_name);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
