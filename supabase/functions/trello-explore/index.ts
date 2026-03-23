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
    const boardsRes = await fetch(`https://api.trello.com/1/organizations/${WORKSPACE_ID}/boards?${auth}&fields=name,url,dateLastActivity`);
    const boards = await boardsRes.json();

    let lists: any = null;
    let cards: any = null;
    if (Array.isArray(boards) && boards.length > 0) {
      const boardId = boards[0].id;
      const [listsRes, cardsRes] = await Promise.all([
        fetch(`https://api.trello.com/1/boards/${boardId}/lists?${auth}&fields=name,pos`),
        fetch(`https://api.trello.com/1/boards/${boardId}/cards?${auth}&fields=name,desc,due,dueComplete,labels,idList,idMembers&members=true&member_fields=fullName,avatarUrl`),
      ]);
      lists = await listsRes.json();
      cards = await cardsRes.json();
    }

    return new Response(JSON.stringify({ boards, lists, cards }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
