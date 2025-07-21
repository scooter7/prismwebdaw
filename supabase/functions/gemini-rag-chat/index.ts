import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @deno-types="npm:@types/pdf-parse@1.1.4"
import pdf from "npm:pdf-parse@1.1.1";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;
const STREAMING_GEMINI_CHAT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:streamGenerateContent?key=${GEMINI_API_KEY}`;
const NON_STREAMING_GEMINI_CHAT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`; // Added non-streaming URL

// Initialize Supabase client
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function generateEmbedding(text: string) {
  console.log("GENERATE-EMBEDDING-FOR-RAG: Generating embedding for text snippet.");
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
  console.log("GENERATE-EMBEDDING-FOR-RAG: Embedding generated successfully.");
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
  console.log("GENERATE-EMBEDDING-FOR-RAG: Handler entered.");

  if (req.method === 'OPTIONS') {
    console.log("GENERATE-EMBEDDING-FOR-RAG: Handling OPTIONS request.");
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("GENERATE-EMBEDDING-FOR-RAG: Attempting to parse request body.");
    const { prompt } = await req.json()
    console.log(`GENERATE-EMBEDDING-FOR-RAG: Received prompt: "${prompt}"`);

    if (!prompt) throw new Error("Prompt is required");
    if (!GEMINI_API_KEY) {
      console.error("GENERATE-EMBEDDING-FOR-RAG: Error: Gemini API key is not set up.");
      return new Response(JSON.stringify({ error: 'Gemini API key is not set up.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log("GENERATE-EMBEDDING-FOR-RAG: Calling generateEmbedding.");
    const queryEmbedding = await generateEmbedding(prompt);
    console.log("GENERATE-EMBEDDING-FOR-RAG: Query embedding generated.");

    console.log("GENERATE-EMBEDDING-FOR-RAG: Calling Supabase RPC for document matching.");
    const { data: documents, error: matchError } = await supabaseAdmin.rpc('match_music_theory_docs', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 5,
    });

    if (matchError) {
      console.error("GENERATE-EMBEDDING-FOR-RAG: Error matching documents:", matchError);
      throw matchError;
    }
    console.log(`GENERATE-EMBEDDING-FOR-RAG: Found ${documents.length} matching documents.`);

    const contextText = documents.map((doc: any) => doc.content).join('\n\n');
    const finalPrompt = SYSTEM_PROMPT_LEARN.replace('{CONTEXT}', contextText) + `\n\nUser's question: "${prompt}"`;
    console.log("GENERATE-EMBEDDING-FOR-RAG: Final prompt prepared.");

    // --- TEMPORARY: Switch to non-streaming for debugging ---
    console.log("GENERATE-EMBEDDING-FOR-RAG: Calling Gemini NON-STREAMING API for debugging.");
    const geminiResponse = await fetch(NON_STREAMING_GEMINI_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }]
      })
    });

    console.log(`GENERATE-EMBEDDING-FOR-RAG: Gemini non-streaming response status: ${geminiResponse.status}`);
    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error("GENERATE-EMBEDDING-FOR-RAG: Gemini API Error (non-streaming):", errorBody);
      throw new Error(`Gemini API Error: ${errorBody}`);
    }

    const geminiData = await geminiResponse.json();
    const assistantResponse = geminiData.candidates[0].content.parts[0].text;
    console.log("GENERATE-EMBEDDING-FOR-RAG: Successfully got non-streaming response from Gemini.");

    return new Response(JSON.stringify({ response: assistantResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
    // --- END TEMPORARY CHANGE ---

    /*
    // Original streaming code (commented out for debugging)
    console.log("GENERATE-EMBEDDING-FOR-RAG: Calling Gemini streaming API.");
    const geminiStreamResponse = await fetch(STREAMING_GEMINI_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }]
      })
    });

    console.log(`GENERATE-EMBEDDING-FOR-RAG: Gemini streaming response status: ${geminiStreamResponse.status}`);
    if (!geminiStreamResponse.ok) {
      const errorBody = await geminiStreamResponse.text();
      console.error("GENERATE-EMBEDDING-FOR-RAG: Gemini API Error:", errorBody);
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
        
        const chunk = textDecoder.decode(value, { stream: true });
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
      console.error("GENERATE-EMBEDDING-FOR-RAG: Error in stream pump:", e);
      writer.abort(e);
    });

    console.log("GENERATE-EMBEDDING-FOR-RAG: Streaming response back to client.");
    return new Response(readable, {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
      status: 200,
    });
    */

  } catch (error) {
    console.error('GENERATE-EMBEDDING-FOR-RAG: Top-level error caught in function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})