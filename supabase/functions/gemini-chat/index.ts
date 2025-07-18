import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

console.log("GEMINI-CHAT FUNCTION: Top-level script execution. Cold start or new instance.");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
// Using a newer, more reliable model.
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are an expert AI music assistant integrated into a Digital Audio Workstation called WebDAW. Your role is to help users compose music. You have deep knowledge of all musical styles, music theory, instrumentation, and effects. You can recommend instruments, audio clips, MIDI patterns, and effects that would fit a user's described genre or song idea. You can also analyze existing audio and MIDI files to suggest how they might be used. Keep your responses concise and helpful for a musician in the middle of a creative session.`;

const handler = async (req: Request): Promise<Response> => {
  console.log(`GEMINI-CHAT FUNCTION: Request received: ${req.method} ${req.url}`);
  console.log("GEMINI-CHAT FUNCTION: Request headers:", Object.fromEntries(req.headers));

  try {
    if (req.method === 'OPTIONS') {
      console.log("GEMINI-CHAT FUNCTION: Handling OPTIONS request.");
      return new Response(null, { headers: corsHeaders, status: 200 })
    }

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

    const fullPrompt = `${SYSTEM_PROMPT}\n\nUser's request: "${prompt}"`;

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

serve(handler, {
  onListen({ port, hostname }) {
    console.log(`GEMINI-CHAT FUNCTION: Server listening on http://${hostname}:${port}`);
  },
  onError(error) {
    console.error("GEMINI-CHAT FUNCTION: Uncaught error in serve:", error);
    return new Response("Internal Server Error", { status: 500 });
  },
});