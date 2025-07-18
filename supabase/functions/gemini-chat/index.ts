import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

console.log("GEMINI-CHAT FUNCTION: Top-level script execution. Cold start or new instance.");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are an expert AI music assistant integrated into a Digital Audio Workstation called WebDAW. Your role is to help users compose music. You have deep knowledge of all musical styles, music theory, instrumentation, and effects.

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
- When creating drum patterns, use MIDI notes that correspond to standard drum mappings. For example: Kick (36), Snare (38), Closed Hi-hat (42), Open Hi-hat (46), Crash (49), Clap (39).
- For "start", bar, beat, and tick are all 1-based.
- For "duration", bar, beat, and tick are all 0-based.
- A common tick value for a quarter note duration is 480 (PPQN).
- Be creative and generate interesting musical patterns.
- If the user asks for multiple patterns, include them all in the "patterns" array.
- For other requests, respond conversationally without the JSON block.

Example user request: "create a funky bassline in C minor and a simple drum beat"
Example response:
Here is a funky bassline and a simple drum beat for you! I've added them to your project.

[WEBDAW_MIDI]
{
  "type": "midi_patterns",
  "patterns": [
    {
      "trackName": "Funky C-Minor Bassline",
      "instrument": "Analog",
      "notes": [
        { "note": 36, "start": { "bar": 1, "beat": 1, "tick": 1 }, "duration": { "bar": 0, "beat": 0, "tick": 239 }, "velocity": 100 }
      ]
    },
    {
      "trackName": "Simple Drums",
      "instrument": "drums",
      "notes": [
        { "note": 36, "start": { "bar": 1, "beat": 1, "tick": 1 }, "duration": { "bar": 0, "beat": 0, "tick": 120 }, "velocity": 127 },
        { "note": 38, "start": { "bar": 1, "beat": 2, "tick": 1 }, "duration": { "bar": 0, "beat": 0, "tick": 120 }, "velocity": 100 }
      ]
    }
  ]
}
[/WEBDAW_MIDI]`;

const handler = async (req: Request): Promise<Response> => {
  console.log(`GEMINI-CHAT FUNCTION: Request received: ${req.method} ${req.url}`);

  // Handle CORS preflight requests
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

serve(handler);