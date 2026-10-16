// read-word-preview (D10 15.10.2026, agreed)
// Read mode: a word that is not in the database is looked up in Ordbøkene
// and Lexin when the user taps it. Read only: nothing is written, no AI.
// Called by the app with the user's session (supabase.functions.invoke).
// Body: { word: string }

import { buildPreview, cleanWord } from './preview.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ ok: false, error: 'Use POST' }, 405);
  const body = await request.json().catch(() => ({}));
  const word = cleanWord(body?.word);
  if (!word) return json({ ok: false, error: 'INVALID_WORD' }, 400);
  return json(await buildPreview(word));
});
