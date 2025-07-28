import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

console.log("OPENAI-CHAT FUNCTION: Top-level script execution. Cold start or new instance.");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Use OPENAI_API_KEY instead of GEMINI_API_KEY
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

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

const handler = async (req: Request): Promise<Response> => {
  console.log(`OPENAI-CHAT FUNCTION: Request received: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    console.log("OPENAI-CHAT FUNCTION: Handling OPTIONS request.");
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("OPENAI-CHAT FUNCTION: Handling POST request");
    const { prompt } = await req.json();

    if (!prompt) {
      console.error("OPENAI-CHAT FUNCTION: Error: Prompt is required");
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!OPENAI_API_KEY) {
      console.error("OPENAI-CHAT FUNCTION: Error: OpenAI API key is not set up.");
      return new Response(JSON.stringify({ error: 'OpenAI API key is not set up.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT_BASE },
      { role: "user", content: prompt }
    ];

    console.log("OPENAI-CHAT FUNCTION: Calling OpenAI API...");
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

    console.log("OPENAI-CHAT FUNCTION: OpenAI response status:", openaiResponse.status);
    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.text();
      console.error("OPENAI-CHAT FUNCTION: OpenAI API Error:", errorBody);
      return new Response(JSON.stringify({ error: 'Failed to get response from OpenAI API.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: openaiResponse.status,
      });
    }

    const openaiData = await openaiResponse.json();
    const assistantResponse = openaiData.choices[0].message.content; // Extract content from OpenAI response
    console.log("OPENAI-CHAT FUNCTION: Successfully got response from OpenAI.");

    return new Response(JSON.stringify({ response: assistantResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("OPENAI-CHAT FUNCTION: Top-level error caught in handler:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
};

serve(handler);