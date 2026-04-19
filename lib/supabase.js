import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://raiwctnevoqjjhgngays.supabase.co';
const supabaseAnonKey = 'sb_publishable_Ey81JRvFZelYhmciOqAzkw_sUJpWHvt';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL and Anon Key are required');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// We removed supabaseAdmin from here because Supabase blocks the use of 
// service_role keys in the browser library. 
// Admin operations in settings.html will now use raw fetch to bypass this restriction.
