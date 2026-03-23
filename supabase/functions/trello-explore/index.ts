import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const API_KEY = Deno.env.get("TRELLO_API_KEY")!;
  const TOKEN = Deno.env.get("TRELLO_TOKEN")!;
  const WORKSPACE_ID = Deno.env.get("TRELLO_WORKSPACE_ID")!;
  const auth = `key=${API_KEY}&token=${TOKEN}`;

  try {
    // First: test auth with member info
    const meRes = await fetch(`https://api.trello.com/1/members/me?${auth}&fields=fullName,username`);
    const meText = await meRes.text();
    let me;
    try { me = JSON.parse(meText); } catch { me = meText; }

    // Then boards
    const boardsRes = await fetch(`https://api.trello.com/1/organizations/${WORKSPACE_ID}/boards?${auth}&fields=name,url,dateLastActivity`);
    const boardsText = await boardsRes.text();
    let boards;
    try { boards = JSON.parse(boardsText); } catch { boards = boardsText; }

    let lists = null, cards = null;
    if (Array.isArray(boards) && boards.length > 0) {
      const boardId = boards[0].id;
      const [listsRes, cardsRes] = await Promise.all([
        fetch(`https://api.trello.com/1/boards/${boardId}/lists?${auth}&fields=name,pos`),
        fetch(`https://api.trello.com/1/boards/${boardId}/cards?${auth}&fields=name,desc,due,dueComplete,labels,idList,idMembers&members=true&member_fields=fullName,avatarUrl`),
      ]);
      const listsText = await listsRes.text();
      const cardsText = await cardsRes.text();
      try { lists = JSON.parse(listsText); } catch { lists = listsText; }
      try { cards = JSON.parse(cardsText); } catch { cards = cardsText; }
    }

    return new Response(JSON.stringify({ me, boards, lists, cards }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
