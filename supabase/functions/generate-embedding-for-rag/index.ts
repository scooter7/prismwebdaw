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
  console.log("GENERATE-EMBEDDING-FOR-RAG: Function started.");

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record } = await req.json()
    const filePath = record.id; 
    const bucketName = record.bucket_id;

    console.log(`Processing file: ${filePath} from bucket: ${bucketName}`);

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

    console.log(`Original file content length: ${fileContent.length}`);
    console.log(`First 500 chars of original content: ${fileContent.substring(0, 500)}`);

    // Remove null characters before cleaning and chunking
    const cleanContent = fileContent.replace(/\0/g, '').replace(/\s+/g, ' ').trim();
    console.log(`Cleaned content length: ${cleanContent.length}`);
    console.log(`First 500 chars of cleaned content: ${cleanContent.substring(0, 500)}`);

    // Made chunking more lenient: split by single newline and require non-empty trim
    const chunks = cleanContent.split('\n').filter(chunk => chunk.trim().length > 0);

    if (chunks.length === 0) {
      console.log("No content chunks found in file after lenient splitting.");
      return new Response(JSON.stringify({ message: 'No content to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${chunks.length} chunks.`);

    const { error: deleteError } = await supabaseAdmin
      .from('music_theory_docs')
      .delete()
      .eq('file_path', filePath);
    
    if (deleteError) {
      console.error("Error deleting old entries:", deleteError);
    }

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