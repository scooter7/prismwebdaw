import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @deno-types="npm:@types/pdf-parse@1.1.4"
import pdf from "npm:pdf-parse@1.1.1";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Use OPENAI_API_KEY instead of GEMINI_API_KEY
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_EMBEDDING_URL = "https://api.openai.com/v1/embeddings";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"; // Unified chat URL for streaming/non-streaming

// Initialize Supabase client
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function generateEmbedding(text: string) {
  console.log("OPENAI-RAG-CHAT: Generating embedding for text snippet.");
  const response = await fetch(OPENAI_EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}` // Use OpenAI API Key
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002", // OpenAI's embedding model
      input: text
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to generate embedding: ${errorBody}`);
  }
  const { data } = await response.json();
  console.log("OPENAI-RAG-CHAT: Embedding generated successfully.");
  return data[0].embedding; // OpenAI returns an array of embeddings
}

const SYSTEM_PROMPT_LEARN = `You are an expert AI music theory assistant integrated into a Digital Audio Workstation called WebDAW. Your role is to help users learn about music. You have deep knowledge of all musical styles, music theory, instrumentation, and effects.

You have been provided with the following context from a knowledge base. Use this context to answer the user's question. If the context doesn't contain the answer, say that you don't have enough information but try to answer based on your general knowledge. Be concise and helpful.

Context:
---
{CONTEXT}
---
`;

serve(async (req) => {
  console.log("OPENAI-RAG-CHAT: Handler entered.");

  if (req.method === 'OPTIONS') {
    console.log("OPENAI-RAG-CHAT: Handling OPTIONS request.");
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("OPENAI-RAG-CHAT: Attempting to parse request body.");
    const { prompt } = await req.json()
    console.log(`OPENAI-RAG-CHAT: Received prompt: "${prompt}"`);

    if (!prompt) throw new Error("Prompt is required");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI-RAG-CHAT: Error: OpenAI API key is not set up.");
      return new Response(JSON.stringify({ error: 'OpenAI API key is not set up.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log("OPENAI-RAG-CHAT: Calling generateEmbedding.");
    const queryEmbedding = await generateEmbedding(prompt);
    console.log("OPENAI-RAG-CHAT: Query embedding generated.");

    console.log("OPENAI-RAG-CHAT: Calling Supabase RPC for document matching.");
    const { data: documents, error: matchError } = await supabaseAdmin.rpc('match_music_theory_docs', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 5,
    });

    if (matchError) {
      console.error("OPENAI-RAG-CHAT: Error matching documents:", matchError);
      throw matchError;
    }
    console.log(`OPENAI-RAG-CHAT: Found ${documents.length} matching documents.`);

    const contextText = documents.map((doc: any) => doc.content).join('\n\n');
    const finalPrompt = SYSTEM_PROMPT_LEARN.replace('{CONTEXT}', contextText) + `\n\nUser's question: "${prompt}"`;
    console.log("OPENAI-RAG-CHAT: Final prompt prepared.");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT_LEARN.replace('{CONTEXT}', contextText) },
      { role: "user", content: prompt }
    ];

    console.log("OPENAI-RAG-CHAT: Calling OpenAI NON-STREAMING API.");
    const openaiResponse = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}` // Use OpenAI API Key
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Specify the model
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      })
    });

    console.log(`OPENAI-RAG-CHAT: OpenAI non-streaming response status: ${openaiResponse.status}`);
    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.text();
      console.error("OPENAI-RAG-CHAT: OpenAI API Error (non-streaming):", errorBody);
      throw new Error(`OpenAI API Error: ${errorBody}`);
    }

    const openaiData = await openaiResponse.json();
    const assistantResponse = openaiData.choices[0].message.content;
    console.log("OPENAI-RAG-CHAT: Successfully got non-streaming response from OpenAI.");

    return new Response(JSON.stringify({ response: assistantResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('OPENAI-RAG-CHAT: Top-level error caught in function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})