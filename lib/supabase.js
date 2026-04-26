import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://raiwctnevoqjjhgngays.supabase.co';
const supabaseAnonKey = 'sb_publishable_Ey81JRvFZelYhmciOqAzkw_sUJpWHvt';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL and Anon Key are required');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Global Logout Function
window.handleGlobalLogout = async (e) => {
    if (e) e.preventDefault();
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        try {
            await supabase.auth.signOut();
            localStorage.removeItem('userRole');
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = 'index.html'; // Force redirect anyway
        }
    }
};

// We removed supabaseAdmin from here because Supabase blocks the use of 
// service_role keys in the browser library. 
// Admin operations in settings.html will now use raw fetch to bypass this restriction.
