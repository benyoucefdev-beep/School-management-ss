// backend/src/utils/supabaseStorage.js
// Handles all file uploads to Supabase Storage
// Uses memory storage (multer) so it works on Vercel (no disk access)

const { createClient } = require('@supabase/supabase-js');

// Extract project ref and build Supabase URL from the DATABASE_URL
// DATABASE_URL format: postgresql://postgres.{projectRef}:password@host/postgres
function getSupabaseUrl() {
  const dbUrl = process.env.DATABASE_URL || '';
  const match = dbUrl.match(/postgres\.([a-z0-9]+):/);
  if (match) {
    return `https://${match[1]}.supabase.co`;
  }
  // Fallback: use explicit env var
  return process.env.SUPABASE_URL || '';
}

// We need the service role key (not anon key) to upload files server-side
// Add SUPABASE_SERVICE_ROLE_KEY to your .env
function getSupabaseClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
  }
  return createClient(url, key);
}

/**
 * Upload a file buffer to Supabase Storage
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {string} bucket - Storage bucket name (e.g. 'client-uploads')
 * @param {string} path - Path within bucket (e.g. 'client-uuid/filename.pdf')
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>} Public URL of the uploaded file
 */
async function uploadToSupabase(buffer, bucket, path, mimeType) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrl;
}

/**
 * Delete a file from Supabase Storage
 * @param {string} bucket - Storage bucket name
 * @param {string} path - Path within bucket
 */
async function deleteFromSupabase(bucket, path) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.error('[Supabase Storage] Delete error:', error.message);
}

module.exports = { uploadToSupabase, deleteFromSupabase };
