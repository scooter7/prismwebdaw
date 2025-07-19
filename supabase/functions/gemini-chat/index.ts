import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

console.log("GEMINI-CHAT FUNCTION: Top-level script execution. Cold start or new instance.");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const SYSTEM_PROMPT_BASE = `You are an expert AI music assistant integrated into a Digital Audio Workstation called WebDAW. Your role is to help users compose music. You have deep knowledge of all musical styles, music theory, instrumentation, and effects.

You can guide users on how to create and edit tracks to optimize their creations, using your knowledge of music theory and styles.

When a user asks you to create one or more MIDI patterns (like a bassline, drum beat, or melody), you MUST respond with a single special JSON block. The JSON block must be wrapped in [WEBDAW_MIDI] and [/WEBDAW_MIDI] tags.

The JSON format is an object containing a list of patterns, as follows:
{
  "type": "midi_patterns",
  "patterns": [
    {
      "trackName": "A descriptive name for the first track",
      "instrument": "acoustic_grand_piano",
      "notes": [
        { "note": 48, "start": { "bar": 1, "beat": 1, "tick": 1 }, "duration": { "bar": 0, "beat": 0, "tick": 480 }, "velocity": 100 }
      ]
    }
  ]
}

- For "instrument", you can specify "Analog", "acoustic_grand_piano", or "drums". Use "drums" for drum patterns.
- When creating drum patterns, ONLY use the following MIDI notes: Kick (36), Snare (38), Closed Hi-hat (42). Do NOT use any other drum sounds like open hi-hat, crash, or clap.
- For "start", bar, beat, and tick are all 1-based.
- For "duration", bar, beat, and tick are all 0-based.
- A common tick value for a quarter note duration is 480 (PPQN).
- Be creative and generate interesting musical patterns.
- If the user asks for multiple patterns, include them all in the "patterns" array.
- For other requests, respond conversationally without the JSON block.
`;

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

const handler = async (req: Request): Promise<Response> => {
  console.log(`GEMINI-CHAT FUNCTION: Request received: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    console.log("GEMINI-CHAT FUNCTION: Handling OPTIONS request.");
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("GEMINI-CHAT FUNCTION: Handling POST request");
    const { prompt } = await req.json();

    if (!prompt) {
      console.error("GEMINI-CHAT FUNCTION: Error: Prompt is required");
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!GEMINI_API_KEY) {
      console.error("GEMINI-CHAT FUNCTION: Error: Gemini API key is not set up.");
      return new Response(JSON.stringify({ error: 'Gemini API key is not set up.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // RAG Part: Find relevant documents
    const queryEmbedding = await generateEmbedding(prompt);
    
    const { data: documents, error: matchError } = await supabaseAdmin.rpc('match_music_theory_docs', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7, // Adjust this threshold as needed
      match_count: 5,       // Get top 5 most relevant chunks
    });

    if (matchError) {
      console.error("Error matching documents:", matchError);
    }

    let contextText = "";
    if (documents && documents.length > 0) {
      contextText = documents.map((doc: any) => `- ${doc.content}`).join('\n');
    }

    let systemPrompt = SYSTEM_PROMPT_BASE;
    if (contextText) {
      systemPrompt += `\n\nHere is some relevant information from your knowledge base to help you answer the user's request:\n${contextText}`;
    }

    const fullPrompt = `${systemPrompt}\n\nUser's request: "${prompt}"`;

    console.log("GEMINI-CHAT FUNCTION: Calling Gemini API...");
    const geminiResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }]
      })
    });

    console.log("GEMINI-CHAT FUNCTION: Gemini response status:", geminiResponse.status);
    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error("GEMINI-CHAT FUNCTION: Gemini API Error:", errorBody);
      return new Response(JSON.stringify({ error: 'Failed to get response from Gemini API.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: geminiResponse.status,
      });
    }

    const geminiData = await geminiResponse.json();
    const assistantResponse = geminiData.candidates[0].content.parts[0].text;
    console.log("GEMINI-CHAT FUNCTION: Successfully got response from Gemini.");

    return new Response(JSON.stringify({ response: assistantResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("GEMINI-CHAT FUNCTION: Top-level error caught in handler:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
};

serve(handler);