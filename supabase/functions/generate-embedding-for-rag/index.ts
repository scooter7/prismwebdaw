import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @deno-types="npm:@types/pdf-parse@1.1.4"
import pdf from "npm:pdf-parse@1.1.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_EMBEDDING_URL = "https://api.openai.com/v1/embeddings";

// Initialize Supabase client
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function generateEmbedding(text: string) {
  const response = await fetch(OPENAI_EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: text
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to generate embedding: ${errorBody}`);
  }
  const { data } = await response.json();
  return data[0].embedding;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record } = await req.json()
    const filePath = record.id; 
    const bucketName = record.bucket_id;

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(bucketName)
      .download(filePath);

    if (downloadError) throw downloadError;

    const fileBuffer = await fileData.arrayBuffer();
    
    let fileContent = '';
    if (record.metadata.mimetype === 'application/pdf') {
        const pdfData = await pdf(fileBuffer);
        fileContent = pdfData.text;
    } else {
        fileContent = new TextDecoder().decode(fileBuffer);
    }

    // Remove null characters before cleaning and chunking
    const cleanContent = fileContent.replace(/\0/g, '').replace(/\s+/g, ' ').trim();
    const chunks = cleanContent.split('\n').filter(chunk => chunk.trim().length > 0);

    if (chunks.length === 0) {
      return new Response(JSON.stringify({ message: 'No content to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete old entries for this file
    await supabaseAdmin
      .from('music_theory_docs')
      .delete()
      .eq('file_path', filePath);

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk);
      await supabaseAdmin
        .from('music_theory_docs')
        .insert({
          content: chunk,
          embedding: embedding,
          file_path: filePath,
        });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})