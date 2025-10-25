import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-key';

// For development without Supabase, create a mock client
if (supabaseUrl === 'https://your-project-id.supabase.co' || supabaseUrl === 'https://demo.supabase.co') {
  console.warn('⚠️  Supabase not configured. Please update your .env file with your Supabase credentials.');
  console.warn('📝 Copy .env.example to .env and add your Supabase URL and key');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
