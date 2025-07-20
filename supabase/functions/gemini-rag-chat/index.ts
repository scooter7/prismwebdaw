import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;
const STREAMING_GEMINI_CHAT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:streamGenerateContent?key=${GEMINI_API_KEY}`;

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function generateEmbedding(text: string) {
  const response = await fetch(GEMINI_EMBEDDING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: "models/text-embedding-004",
      content: { parts: [{ text }] }
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to generate embedding: ${errorBody}`);
  }
  const { embedding } = await response.json();
  return embedding.values;
}

const SYSTEM_PROMPT_LEARN = `You are an expert AI music theory assistant integrated into a Digital Audio Workstation called WebDAW. Your role is to help users learn about music. You have deep knowledge of all musical styles, music theory, instrumentation, and effects.

You have been provided with the following context from a knowledge base. Use this context to answer the user's question. If the context doesn't contain the answer, say that you don't have enough information but try to answer based on your general knowledge. Be concise and helpful.

Context:
---
{CONTEXT}
---
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt } = await req.json();
    if (!prompt) throw new Error("Prompt is required");

    const queryEmbedding = await generateEmbedding(prompt);

    const { data: documents, error: matchError } = await supabaseAdmin.rpc('match_music_theory_docs', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 5,
    });

    if (matchError) throw matchError;

    const contextText = documents.map((doc: any) => doc.content).join('\n\n');
    const finalPrompt = SYSTEM_PROMPT_LEARN.replace('{CONTEXT}', contextText) + `\n\nUser's question: "${prompt}"`;

    const geminiStreamResponse = await fetch(STREAMING_GEMINI_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }]
      })
    });

    if (!geminiStreamResponse.ok) {
      const errorBody = await geminiStreamResponse.text();
      throw new Error(`Gemini API Error: ${errorBody}`);
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const textDecoder = new TextDecoder();
    const geminiBodyReader = geminiStreamResponse.body!.getReader();

    const pump = async () => {
      while (true) {
        const { done, value } = await geminiBodyReader.read();
        if (done) {
          writer.close();
          break;
        }
        
        const chunk = textDecoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
        for (const line of lines) {
          const jsonString = line.substring(6);
          try {
            const parsed = JSON.parse(jsonString);
            const text = parsed.candidates[0]?.content?.parts[0]?.text;
            if (text) {
              writer.write(new TextEncoder().encode(text));
            }
          } catch (e) {
            // Ignore parsing errors for incomplete json chunks
          }
        }
      }
    };

    pump().catch(e => {
      console.error("Error in stream pump:", e);
      writer.abort(e);
    });

    return new Response(readable, {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in gemini-rag-chat function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});