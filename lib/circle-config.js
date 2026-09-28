// Centralized Circle/District Configuration for Al-Bunyan System
// Manages dynamic circle name across UI, PDF exports, and Excel exports

export const DEFAULT_CIRCLE_NAME = 'الدائرة الثامنة عشر';

/**
 * Get current circle name from localStorage or fallback
 * @returns {string}
 */
export function getCircleName() {
    try {
        const stored = localStorage.getItem('circleName');
        return (stored && stored.trim()) ? stored.trim() : DEFAULT_CIRCLE_NAME;
    } catch (e) {
        return DEFAULT_CIRCLE_NAME;
    }
}

/**
 * Apply the current circle name to all DOM elements with matching selectors
 * @param {string} [customName] 
 */
export function applyCircleNameElements(customName) {
    const name = customName || getCircleName();
    const elements = document.querySelectorAll('.circle-name-display, [data-circle-name]');
    elements.forEach(el => {
        el.textContent = name;
    });
}

/**
 * Set and persist circle name locally and to Supabase if available
 * @param {string} newName 
 * @param {object} [supabaseClient]
 * @returns {Promise<{success: boolean, name: string}>}
 */
export async function setCircleName(newName, supabaseClient) {
    const trimmed = (newName || '').trim() || DEFAULT_CIRCLE_NAME;
    
    // 1. Save locally immediately
    try {
        localStorage.setItem('circleName', trimmed);
    } catch (e) {
        console.warn('localStorage save failed:', e);
    }

    // 2. Update UI elements
    applyCircleNameElements(trimmed);

    // 3. Dispatch global event
    try {
        window.dispatchEvent(new CustomEvent('circleNameChanged', { 
            detail: { circleName: trimmed } 
        }));
    } catch (e) {}

    // 4. Attempt remote sync to Supabase app_settings table
    const client = supabaseClient || window.supabase;
    let remoteSynced = false;
    let syncError = null;

    if (client) {
        try {
            const { error } = await client
                .from('app_settings')
                .upsert({ 
                    setting_key: 'circle_name', 
                    setting_value: trimmed,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'setting_key' });

            if (error) {
                console.warn('Supabase app_settings sync note (table may not exist yet):', error.message);
                syncError = error.message;
            } else {
                remoteSynced = true;
                console.log('Circle name synced to Supabase successfully:', trimmed);
            }
        } catch (err) {
            syncError = err.message;
            console.warn('Remote sync attempt ignored:', err);
        }
    }

    return { success: true, name: trimmed, remoteSynced, syncError };
}

/**
 * Fetch latest circle name from Supabase and cache locally
 * @param {object} [supabaseClient]
 */
export async function initCircleName(supabaseClient) {
    // Apply immediate local value first to prevent flicker
    applyCircleNameElements();

    const client = supabaseClient || window.supabase;
    if (!client) return getCircleName();

    try {
        const { data, error } = await client
            .from('app_settings')
            .select('setting_value')
            .eq('setting_key', 'circle_name')
            .single();

        if (!error && data && data.setting_value) {
            const remoteName = data.setting_value.trim();
            if (remoteName && remoteName !== localStorage.getItem('circleName')) {
                localStorage.setItem('circleName', remoteName);
                applyCircleNameElements(remoteName);
                window.dispatchEvent(new CustomEvent('circleNameChanged', { 
                    detail: { circleName: remoteName } 
                }));
            }
            return remoteName;
        }
    } catch (e) {
        // Silently keep local value if offline or table doesn't exist
    }

    return getCircleName();
}

// Expose globally for inline scripts and export handlers
if (typeof window !== 'undefined') {
    window.getCircleName = getCircleName;
    window.setCircleName = setCircleName;
    window.applyCircleNameElements = applyCircleNameElements;
    window.initCircleName = initCircleName;

    // Apply on DOM load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => applyCircleNameElements());
    } else {
        applyCircleNameElements();
    }
}
