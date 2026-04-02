import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NOTION_VERSION = "2022-06-28";

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
  const res = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: notionHeaders(token),
    body: JSON.stringify({
      filter: { value: "database", property: "object" },
      page_size: 100,
    }),
  });
  const data = await res.json();
  if (!res.ok) return json({ error: data.message || "Notion API error" }, 502);

  const databases = (data.results || [])
    .filter((db: any) => {
      if (db.object !== "database") return false;
      const title = (db.title || []).map((t: any) => t.plain_text || "").join("");
      if (!title) return false;
      const props = db.properties || {};
      return Object.keys(props).length > 0;
    })
    .map((db: any) => {
      const props: Record<string, { type: string; name: string }> = {};
      for (const [key, val] of Object.entries(db.properties || {})) {
        props[key] = { type: (val as any).type, name: (val as any).name || key };
      }
      return {
        id: db.id,
        name: (db.title || []).map((t: any) => t.plain_text || "").join(""),
        url: db.url,
        properties: props,
      };
    });

  return json({ databases });
}

async function queryDatabase(token: string, databaseId: string) {
  // First get database metadata for the name
  const dbRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    headers: notionHeaders(token),
  });
  const dbData = await dbRes.json();
  const databaseName = dbRes.ok
    ? (dbData.title || []).map((t: any) => t.plain_text || "").join("")
    : "";

  const res = await fetch(
    `https://api.notion.com/v1/databases/${databaseId}/query`,
    {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({ page_size: 100 }),
    }
  );
  const data = await res.json();
  if (!res.ok) return json({ error: data.message || "Notion API error" }, 502);

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
      return await queryDatabase(token, body.database_id);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
