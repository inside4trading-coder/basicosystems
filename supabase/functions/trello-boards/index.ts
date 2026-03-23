import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const API_KEY = Deno.env.get("TRELLO_API_KEY")!;
  const TOKEN = Deno.env.get("TRELLO_TOKEN")!;
  const WORKSPACE_ID = Deno.env.get("TRELLO_WORKSPACE_ID")!;
  const auth = `key=${API_KEY}&token=${TOKEN}`;

  try {
    const url = new URL(req.url);
    const boardId = url.searchParams.get("board_id");

    // If no board_id, return list of boards
    if (!boardId) {
      const res = await fetch(
        `https://api.trello.com/1/organizations/${WORKSPACE_ID}/boards?${auth}&fields=name,url,dateLastActivity,prefs&filter=open`
      );
      const boards = await res.json();
      if (!Array.isArray(boards)) {
        return new Response(JSON.stringify({ error: "Invalid response from Trello", detail: boards }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Sort by last activity, most recent first
      boards.sort((a: any, b: any) => {
        const da = a.dateLastActivity || "";
        const db = b.dateLastActivity || "";
        return db.localeCompare(da);
      });
      return new Response(JSON.stringify({ boards }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch lists and cards for a specific board
    const [listsRes, cardsRes] = await Promise.all([
      fetch(`https://api.trello.com/1/boards/${boardId}/lists?${auth}&fields=name,pos&filter=open`),
      fetch(`https://api.trello.com/1/boards/${boardId}/cards?${auth}&fields=name,desc,due,dueComplete,labels,idList,idMembers,pos,url&members=true&member_fields=fullName,avatarUrl,initials`),
    ]);

    const lists = await listsRes.json();
    const cards = await cardsRes.json();

    if (!Array.isArray(lists) || !Array.isArray(cards)) {
      return new Response(JSON.stringify({ error: "Invalid Trello response", lists, cards }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map cards into lists
    const listsWithCards = lists
      .sort((a: any, b: any) => a.pos - b.pos)
      .map((list: any) => ({
        id: list.id,
        name: list.name,
        cards: cards
          .filter((c: any) => c.idList === list.id)
          .sort((a: any, b: any) => a.pos - b.pos)
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            desc: c.desc || "",
            due: c.due,
            dueComplete: c.dueComplete,
            url: c.url,
            labels: (c.labels || []).map((l: any) => ({
              id: l.id,
              name: l.name,
              color: l.color,
            })),
            members: (c.members || []).map((m: any) => ({
              id: m.id,
              fullName: m.fullName,
              initials: m.initials,
              avatarUrl: m.avatarUrl,
            })),
          })),
      }));

    return new Response(JSON.stringify({ lists: listsWithCards }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
