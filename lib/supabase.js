import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL and Anon Key are required in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// We removed supabaseAdmin from here because Supabase blocks the use of 
// service_role keys in the browser library. 
// Admin operations in settings.html will now use raw fetch to bypass this restriction.
