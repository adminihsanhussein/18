/**
 * Global Notification Utility for Al-Bunyan App
 * Handles: Native (Android Tray), In-App (Toast), and Persistent (DB-backed) notifications.
 */

import { supabase } from './supabase.js';

// Check if we are running in a Capacitor/Native environment
const isNative = window.Capacitor && window.Capacitor.isNativePlatform();

/**
 * Request Notification Permissions for Device
 */
export async function requestNotificationPermission() {
    if (!isNative) return true;
    try {
        const { LocalNotifications } = window.Capacitor.Plugins;
        const permission = await LocalNotifications.requestPermissions();
        return permission.display === 'granted';
    } catch (err) {
        console.error('Failed to request notification permission:', err);
        return false;
    }
}

/**
 * Show a modern In-App Toast
 */
export function showToast(title, message, type = 'primary') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'notifications');
    
    toast.innerHTML = `
        <span class="material-symbols-outlined text-xl" style="color: inherit;">${icon}</span>
        <div>
            <p class="font-black text-xs leading-none mb-1 text-primary">${title}</p>
            <p class="text-[10px] font-bold text-on-surface-variant opacity-80">${message}</p>
        </div>
    `;

    container.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

/**
 * Trigger a Native Android Tray Notification
 */
export async function showNativeNotification(title, body) {
    if (!isNative) {
        console.log('Native notification simulation:', title, body);
        return;
    }

    try {
        const { LocalNotifications } = window.Capacitor.Plugins;
        await LocalNotifications.schedule({
            notifications: [
                {
                    title,
                    body,
                    id: Math.floor(Math.random() * 1000000),
                    schedule: { at: new Date(Date.now() + 500) },
                    sound: true,
                    actionTypeId: "",
                    extra: null
                }
            ]
        });
    } catch (err) {
        console.error('Failed to schedule native notification:', err);
    }
}

/**
 * Send a persistent notification to a specific user (saved in DB)
 */
export async function sendPersistentNotification(userId, title, message, type = 'status_update') {
    try {
        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                title,
                message,
                type
            });
        
        if (error) throw error;
    } catch (err) {
        console.error('Failed to send persistent notification:', err);
    }
}

/**
 * Convenience function for all-in-one reporting
 */
export async function notify(title, message, options = { native: true, toast: true, persist: false, userId: null, type: 'primary' }) {
    if (options.toast) showToast(title, message, options.type);
    if (options.native) await showNativeNotification(title, message);
    if (options.persist && options.userId) {
        await sendPersistentNotification(options.userId, title, message, options.type);
    }
}
