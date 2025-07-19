import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { stripHtml } from "https://deno.land/x/strip_html/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;

// Initialize Supabase client
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // The request body for a storage trigger is different, we get the record directly
    const { record } = await req.json()
    const filePath = record.id; 
    const bucketName = record.bucket_id;

    console.log(`Processing file: ${filePath} from bucket: ${bucketName}`);

    // 1. Download the file from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(bucketName)
      .download(filePath);

    if (downloadError) throw downloadError;

    const fileContent = await fileData.text();

    // 2. Clean and chunk the content
    const cleanContent = stripHtml(fileContent).replace(/\s+/g, ' ').trim();
    const chunks = cleanContent.split('\n\n').filter(chunk => chunk.trim().length > 0);

    if (chunks.length === 0) {
      console.log("No content chunks found in file.");
      return new Response(JSON.stringify({ message: 'No content to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Delete old entries for this file to avoid duplicates on re-upload
    const { error: deleteError } = await supabaseAdmin
      .from('music_theory_docs')
      .delete()
      .eq('file_path', filePath);
    
    if (deleteError) {
      console.error("Error deleting old entries:", deleteError);
    }

    // 4. Generate embeddings and insert into DB
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk);
      
      const { error: insertError } = await supabaseAdmin
        .from('music_theory_docs')
        .insert({
          content: chunk,
          embedding: embedding,
          file_path: filePath,
        });

      if (insertError) {
        console.error(`Error inserting chunk for ${filePath}:`, insertError);
      }
    }

    console.log(`Successfully processed and embedded ${chunks.length} chunks for ${filePath}.`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error processing file:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})