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
            } else if (action === 'update-user-name') {
                console.log(`[Vite Admin API] Updating name for user: ${userId} to ${name}`);
                const authRes = await supabaseAdmin.auth.admin.updateUserById(userId, {
                    user_metadata: { full_name: name }
                });
                if (authRes.error) {
                    console.error('[Vite Admin API] Auth Meta Update Error:', authRes.error.message);
                    throw authRes.error;
                }
                const { error: updErr } = await supabaseAdmin
                    .from('profiles')
                    .update({ full_name: name })
                    .eq('id', userId);
                if (updErr) throw updErr;
                result = { success: true, message: 'Name updated successfully' };
            } else if (action === 'delete-user') {
                console.log(`[Vite Admin API] Deleting user: ${userId}`);
                if (!userId) throw new Error('معرف المستخدم مطلوب لعملية الحذف');

                // 1. Delete from auth.users (cascades to profiles, and sets null in books/receipts)
                const authDel = await supabaseAdmin.auth.admin.deleteUser(userId);
                if (authDel.error) {
                    console.error('[Vite Admin API] Auth Delete Error:', authDel.error.message);
                    throw authDel.error;
                }

                // 2. Ensure profile is deleted if not cascaded
                const { error: profDelErr } = await supabaseAdmin
                    .from('profiles')
                    .delete()
                    .eq('id', userId);
                if (profDelErr) {
                    console.warn('[Vite Admin API] Profile delete fallback warning:', profDelErr.message);
                }

                result = { success: true, message: 'User deleted successfully' };
            } else if (action === 'update-admin-profile') {
                console.log(`[Vite Admin API] Updating admin profile for: ${userId}`);
                if (!userId) throw new Error('معرف المستخدم مطلوب للتحديث');

                // Enforce admin check
                const { data: targetProf } = await supabaseAdmin
                    .from('profiles')
                    .select('role')
                    .eq('id', userId)
                    .single();
                if (!targetProf || targetProf.role !== 'admin') {
                    throw new Error('غير مصرح: تعديل بيانات الحساب متاح حصراً لمدير النظام (الآدمن)');
                }

                const authUpdates = {};
                const profileUpdates = { updated_at: new Date().toISOString() };

                if (name && name.trim()) {
                    authUpdates.user_metadata = { full_name: name.trim() };
                    profileUpdates.full_name = name.trim();
                }

                if (email && email.trim()) {
                    authUpdates.email = email.trim().toLowerCase();
                    authUpdates.email_confirm = true;
                    profileUpdates.email = email.trim().toLowerCase();
                }

                if (password && password.trim()) {
                    if (password.trim().length < 6) {
                        throw new Error('كلمة المرور يجب أن تكون 6 خانات أو أكثر');
                    }
                    authUpdates.password = password.trim();
                    profileUpdates.raw_password = password.trim();
                    if (!authUpdates.user_metadata) authUpdates.user_metadata = {};
                    authUpdates.user_metadata.raw_password = password.trim();
                }

                // 1. Update Auth user
                if (Object.keys(authUpdates).length > 0) {
                    const authRes = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
                    if (authRes.error) {
                        console.error('[Vite Admin API] Auth Update Error:', authRes.error.message);
                        throw authRes.error;
                    }
                }

                // 2. Update profiles table
                if (Object.keys(profileUpdates).length > 1) {
                    const { error: profErr } = await supabaseAdmin
                        .from('profiles')
                        .update(profileUpdates)
                        .eq('id', userId);
                    if (profErr) {
                        console.warn('[Vite Admin API] Profile Update Warning:', profErr.message);
                    }
                }

                result = { success: true, message: 'Admin profile updated successfully' };
            } else if (action === 'distribute-book') {
                const { bookData } = payload;
                console.log(`[Vite Admin API] Distributing book: ${bookData?.serial_number}`);
                const { data: insertedBook, error: bErr } = await supabaseAdmin
                    .from('books')
                    .insert(bookData)
                    .select()
                    .single();
                if (bErr) throw bErr;
                result = { success: true, data: insertedBook };
            } else if (action === 'parse-google-form') {
                const { url } = payload;
                console.log(`[Vite Admin API] Auto-parsing Google Form URL: ${url}`);
                
                let targetViewUrl = (url || '').trim();
                const match = targetViewUrl.match(/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    targetViewUrl = `https://docs.google.com/forms/d/e/${match[1]}/viewform`;
                }

                const response = await fetch(targetViewUrl, { redirect: 'follow' });
                const finalUrl = response.url || targetViewUrl;
                const matchFinal = finalUrl.match(/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/) || match;
                const formId = matchFinal ? matchFinal[1] : '';
                const canonicalViewUrl = formId ? `https://docs.google.com/forms/d/e/${formId}/viewform` : finalUrl;
                const canonicalPostUrl = formId ? `https://docs.google.com/forms/d/e/${formId}/formResponse` : finalUrl.replace(/\/viewform.*$/, '/formResponse');

                const html = await response.text();
                
                let loadMatch = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(.*?);\s*<\/script>/s);
                if (!loadMatch) {
                    loadMatch = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*([\s\S]*?);/);
                }
                if (!loadMatch) throw new Error('تعذر قراءة بيانات حقول نموذج كوكل من هذا الرابط. تأكد من أن الرابط عام ومتاح للجميع.');

                const parsed = JSON.parse(loadMatch[1]);
                const questions = parsed[1] ? parsed[1][1] : [];
                
                const detectedEntries = {
                    subscriberName: null,
                    amount: null,
                    receiptNumber: null,
                    receiptDate: null,
                    holderName: null,
                    circleNumber: null
                };

                const fieldDetails = {
                    subscriberName: { label: 'اسم المساهم / المتبرع', entryId: '', matchedTitle: '' },
                    amount: { label: 'مبلغ الوصل', entryId: '', matchedTitle: '' },
                    receiptNumber: { label: 'رقم الوصل / السند', entryId: '', matchedTitle: '' },
                    receiptDate: { label: 'تاريخ الوصل', entryId: '', matchedTitle: '' },
                    holderName: { label: 'اسم صاحب الدبلك / الحليف', entryId: '', matchedTitle: '' },
                    circleNumber: { label: 'رقم الدائرة', entryId: '', matchedTitle: '' }
                };

                const parsedQuestions = [];

                if (Array.isArray(questions)) {
                    questions.forEach(q => {
                        if (!q) return;
                        const title = (q[1] || '').trim();
                        const itemData = q[4];
                        if (!itemData || !itemData[0] || !itemData[0][0]) return;
                        const entryId = `entry.${itemData[0][0]}`;
                        parsedQuestions.push({ entryId, title });
                    });

                    parsedQuestions.forEach(({ entryId, title }) => {
                        const cleanTitle = title.toLowerCase();

                        // 1. Circle Number (highest priority to avoid confusion with receipt number)
                        const isCircle = cleanTitle.includes('دائر') || cleanTitle.includes('دائرة') || cleanTitle.includes('الدائرة') || cleanTitle.includes('district');
                        if (isCircle && !detectedEntries.circleNumber) {
                            detectedEntries.circleNumber = entryId;
                            fieldDetails.circleNumber.entryId = entryId;
                            fieldDetails.circleNumber.matchedTitle = title;
                            return;
                        }

                        // 2. Holder / Ally Name
                        const isHolder = cleanTitle.includes('صاحب') || cleanTitle.includes('دبلك') || cleanTitle.includes('حليف') || cleanTitle.includes('جامع') || cleanTitle.includes('مسؤول الدفتر');
                        if (isHolder && !detectedEntries.holderName) {
                            detectedEntries.holderName = entryId;
                            fieldDetails.holderName.entryId = entryId;
                            fieldDetails.holderName.matchedTitle = title;
                            return;
                        }

                        // 3. Receipt Date
                        const isDate = cleanTitle.includes('تاريخ') || cleanTitle.includes('التاريخ') || cleanTitle.includes('يوم');
                        if (isDate && !detectedEntries.receiptDate) {
                            detectedEntries.receiptDate = entryId;
                            fieldDetails.receiptDate.entryId = entryId;
                            fieldDetails.receiptDate.matchedTitle = title;
                            return;
                        }

                        // 4. Receipt Number
                        const isNumber = (cleanTitle.includes('رقم') || cleanTitle.includes('تسلسل')) && 
                                         !cleanTitle.includes('مبلغ') && !cleanTitle.includes('هاتف') && !cleanTitle.includes('جوال') && !cleanTitle.includes('دائر');
                        if (isNumber && !detectedEntries.receiptNumber) {
                            detectedEntries.receiptNumber = entryId;
                            fieldDetails.receiptNumber.entryId = entryId;
                            fieldDetails.receiptNumber.matchedTitle = title;
                            return;
                        }

                        // 5. Amount
                        const isAmount = cleanTitle.includes('مبلغ') || cleanTitle.includes('المبلغ') || cleanTitle.includes('دينار') || cleanTitle.includes('قيمة');
                        if (isAmount && !detectedEntries.amount) {
                            detectedEntries.amount = entryId;
                            fieldDetails.amount.entryId = entryId;
                            fieldDetails.amount.matchedTitle = title;
                            return;
                        }

                        // 6. Subscriber Name
                        const isSubscriber = (cleanTitle.includes('مساهم') || cleanTitle.includes('متبرع') || cleanTitle.includes('مشترك') || cleanTitle.includes('اسم')) && !isHolder && !isCircle;
                        if (isSubscriber && !detectedEntries.subscriberName) {
                            detectedEntries.subscriberName = entryId;
                            fieldDetails.subscriberName.entryId = entryId;
                            fieldDetails.subscriberName.matchedTitle = title;
                            return;
                        }
                    });
                }

                result = {
                    success: true,
                    formId: formId,
                    viewUrl: canonicalViewUrl,
                    postUrl: canonicalPostUrl,
                    entries: detectedEntries,
                    details: fieldDetails,
                    allQuestions: parsedQuestions
                };
            } else if (action === 'submit-google-form') {
                const { postUrl, formData } = payload;
                console.log(`[Vite Admin API] Submitting receipt to Google Form: ${postUrl}`);
                
                const params = new URLSearchParams(formData);
                const gRes = await fetch(postUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: params.toString()
                });

                console.log(`[Vite Admin API] Google Form Response Status: ${gRes.status}`);
                result = { success: true, status: gRes.status };
            } else {
                throw new Error('Invalid action');
            }

            if (result && result.error) throw result.error;

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, data: result }));
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
    base: './',
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
