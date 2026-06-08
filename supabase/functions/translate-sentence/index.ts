import { createClient } from '@supabase/supabase-js';
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const DAILY_LIMIT = 20;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!openAiKey) {
      return jsonResponse({
        ok: false,
        code: 'MISSING_OPENAI_KEY',
        message: 'Missing OPENAI_API_KEY secret',
      });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({
        ok: false,
        code: 'MISSING_SUPABASE_ENV',
        message: 'Missing Supabase server environment variables',
      });
    }

    const body = await req.json();

    const sentence = String(body.sentence || '').trim();
    const targetLanguage =
      body.targetLanguage === 'en' ? 'English' : 'Ukrainian';

    const profileKey = String(body.profileKey || 'user1').trim();

    if (!sentence) {
      return jsonResponse({
        ok: false,
        code: 'EMPTY_SENTENCE',
        message: 'Sentence is empty',
      });
    }

    if (sentence.length > 800) {
      return jsonResponse({
        ok: false,
        code: 'SENTENCE_TOO_LONG',
        message: 'Sentence is too long. Maximum is 800 characters.',
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('profile_key', profileKey)
      .maybeSingle();

    if (!profile?.id) {
      const fallback = await supabase
        .from('profiles')
        .select('id')
        .eq('display_name', profileKey)
        .maybeSingle();

      profile = fallback.data;
      profileError = fallback.error;
    }

    if (profileError || !profile?.id) {
      return jsonResponse({
        ok: false,
        code: 'PROFILE_NOT_FOUND',
        message: `Profile not found: ${profileKey}`,
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const feature = 'sentence_translation';

    const { data: usageRow, error: usageReadError } = await supabase
      .from('ai_usage')
      .select('id, request_count')
      .eq('profile_id', profile.id)
      .eq('usage_date', today)
      .eq('feature', feature)
      .maybeSingle();

    if (usageReadError) {
      return jsonResponse({
        ok: false,
        code: 'USAGE_READ_ERROR',
        message: usageReadError.message,
      });
    }

    const currentCount = usageRow?.request_count || 0;

    if (currentCount >= DAILY_LIMIT) {
      return jsonResponse({
        ok: false,
        code: 'DAILY_LIMIT_REACHED',
        message: `Daily AI limit reached: ${DAILY_LIMIT}`,
        limit: DAILY_LIMIT,
        used: currentCount,
      });
    }

    const prompt = `
You are a Norwegian language tutor.

Analyze this Norwegian sentence for a learner.

Sentence:
${sentence}

Target language: ${targetLanguage}

Return ONLY valid JSON with this structure:
{
  "translation": "...",
  "grammarNotes": ["..."],
  "expressions": ["..."],
  "literalMeaning": "...",
  "difficulty": "easy|medium|hard"
}

Rules:
- Keep explanations concise.
- Explain grammar in simple learner-friendly language.
- If there are fixed expressions, include them.
- Do not include markdown.
`;

    const aiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: prompt,
        temperature: 0.2,
        max_output_tokens: 700,
      }),
    });

    const aiText = await aiResponse.text();

    if (!aiResponse.ok) {
      return jsonResponse({
        ok: false,
        code: 'OPENAI_REQUEST_FAILED',
        message: aiText || 'OpenAI request failed',
      });
    }

    let aiJson: any;

    try {
      aiJson = JSON.parse(aiText);
    } catch {
      return jsonResponse({
        ok: false,
        code: 'OPENAI_BAD_JSON',
        message: aiText || 'OpenAI returned invalid JSON',
      });
    }

    const outputText =
      aiJson.output_text ||
      aiJson.output?.[0]?.content?.[0]?.text ||
      '';

    let parsed;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      parsed = {
        translation: outputText,
        grammarNotes: [],
        expressions: [],
        literalMeaning: '',
        difficulty: 'medium',
      };
    }

    const nextCount = currentCount + 1;

    if (usageRow?.id) {
      const { error: updateUsageError } = await supabase
        .from('ai_usage')
        .update({
          request_count: nextCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', usageRow.id);

      if (updateUsageError) {
        return jsonResponse({
          ok: false,
          code: 'USAGE_UPDATE_ERROR',
          message: updateUsageError.message,
        });
      }
    } else {
      const { error: insertUsageError } = await supabase
        .from('ai_usage')
        .insert({
          profile_id: profile.id,
          usage_date: today,
          feature,
          request_count: nextCount,
        });

      if (insertUsageError) {
        return jsonResponse({
          ok: false,
          code: 'USAGE_INSERT_ERROR',
          message: insertUsageError.message,
        });
      }
    }

    return jsonResponse({
      ok: true,
      sentence,
      result: parsed,
      usage: {
        used: nextCount,
        limit: DAILY_LIMIT,
      },
    });
  } catch (error) {
    console.error('translate-sentence error:', error);

    return jsonResponse({
      ok: false,
      code: 'UNHANDLED_ERROR',
      message: String(error?.message || error),
    });
  }
});

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}