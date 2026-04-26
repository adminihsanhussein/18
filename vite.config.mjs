import { defineConfig, loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

// Custom Vite Plugin to handle Admin API requests internally
function supabaseAdminPlugin(env) {
  const SUPABASE_URL = env.VITE_SUPABASE_URL;
  const SERVICE_KEY = env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  let supabaseAdmin = null;

  if (SUPABASE_URL && SERVICE_KEY) {
    supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return {
    name: 'supabase-admin-api',
    configureServer(server) {
      server.middlewares.use('/api/admin', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        if (!supabaseAdmin) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Admin credentials missing in .env' }));
          return;
        }

        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body);
            const { action, userId, newPassword, name, email, password } = payload;
            
            console.log(`[Vite Admin API] Executing action: ${action}`);

            let result;
            if (action === 'create-user') {
                result = await supabaseAdmin.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: { full_name: name, raw_password: password }
                });
            } else if (action === 'reset-password') {
                console.log(`[Vite Admin API] Resetting password for user: ${userId}`);
                const authRes = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
                
                if (authRes.error) {
                    console.error('[Vite Admin API] Auth Update Error:', authRes.error.message);
                    throw authRes.error;
                }
                
                console.log(`[Vite Admin API] Auth password updated. Attempting profile update...`);
                // We attempt to update the profile but don't fail the whole request if it fails
                const profRes = await supabaseAdmin.from('profiles').update({ 
                    raw_password: newPassword,
                    updated_at: new Date().toISOString()
                }).eq('id', userId);
                
                if (profRes.error) {
                    console.warn('[Vite Admin API] Profile Update Warning:', profRes.error.message);
                    // Return success but log the sub-issue for debugging
                }
                
                result = { success: true, profileUpdated: !profRes.error };
            } else if (action === 'toggle-user-status') {
                console.log(`[Vite Admin API] Toggling status for user: ${userId}`);
                
                // 1. Fetch current profile
                const { data: prof, error: getErr } = await supabaseAdmin
                    .from('profiles')
                    .select('full_name')
                    .eq('id', userId)
                    .single();
                
                if (getErr) throw getErr;
                
                const currentName = prof.full_name || '';
                let newName = currentName;
                
                // 2. Toggle the prefix
                if (currentName.startsWith('[DEACTIVATED]')) {
                    newName = currentName.replace('[DEACTIVATED] ', '').replace('[DEACTIVATED]', '').trim();
                } else {
                    newName = `[DEACTIVATED] ${currentName}`;
                }
                
                // 3. Update profile
                const { error: updErr } = await supabaseAdmin
                    .from('profiles')
                    .update({ full_name: newName })
                    .eq('id', userId);
                
                if (updErr) throw updErr;
                
                result = { 
                    success: true, 
                    isAvailable: !newName.startsWith('[DEACTIVATED]'),
                    message: 'Status toggled successfully' 
                };
            } else {
                throw new Error('Invalid action');
            }

            if (result && result.error) throw result.error;

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, data: result?.data || null }));
          } catch (err) {
            console.error('[Vite Admin API] Error:', err.message);
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  console.log('***************************************************');
  console.log('*  VITE ADMIN MIDDLEWARE MOUNTED AT /api/admin    *');
  console.log('***************************************************');

  return {
    plugins: [supabaseAdminPlugin(env)],
    build: {
      rollupOptions: {
        input: {
          main: 'index.html',
          dashboard: 'dashboard.html',
          analytics: 'analytics.html',
          settings: 'settings.html',
          'new-receipt': 'new-receipt.html',
          'book-details': 'book-details.html',
          records: 'records.html',
          'my-receipts': 'my-receipts.html'
        }
      }
    },
    server: {
      port: 5173
    }
  };
});
