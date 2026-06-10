import { useEffect, useState } from 'react';
import api from '../lib/api';

const VAPID_PUBLIC_KEY = 'BBBJ6rNUcVlx7_z_zVqNJcUOqAcycWL2Kfzscswvi0bgz8z3GkLsJ1LEQnfc4iaLgSvt8rj5jxgfTCaIiIpx58E';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Core subscribe function — requests permission if needed then registers the push subscription.
 * Returns true on success, false on failure/denied.
 */
export async function subscribePush(silent = false) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (!silent) console.warn('[Push] ServiceWorker or PushManager not supported.');
    return false;
  }
  if (!('Notification' in window)) {
    if (!silent) console.warn('[Push] Notification API not supported (regular iOS Safari tab?)');
    return false;
  }

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      console.warn('[Push] Permission denied:', permission);
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    console.log('[Push] SW ready, state:', registration.active?.state);

    // Always refresh subscription — Chrome on Android sometimes has a stale one
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      console.log('[Push] No existing subscription — creating new one...');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log('[Push] New subscription endpoint:', subscription.endpoint.slice(-40));
    } else {
      console.log('[Push] Existing subscription found — syncing to backend...');
    }

    // Always POST to backend (upsert by endpoint)
    await api.post('/notifications/subscribe', { subscription: subscription.toJSON() });
    console.log('[Push] ✅ Subscription synced to backend successfully.');
    return true;
  } catch (err) {
    if (!silent) console.error('[Push] Subscribe error:', err.name, err.message);
    else console.warn('[Push] Silent subscribe failed:', err.name, err.message);
    return false;
  }
}

/**
 * Check if the current device has an active push subscription.
 */
export async function checkPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'default';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'not_subscribed';
  } catch {
    return 'not_subscribed';
  }
}

/**
 * Hook — auto-subscribes on app load AND every time the app comes back to the foreground.
 * This ensures that if the mobile subscription ever lapses, it auto-recovers.
 */
export function useAutoSubscribe() {
  useEffect(() => {
    if (!('Notification' in window)) return;

    const handleInteraction = () => {
      subscribePush(true);
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchend', handleInteraction);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Notification.permission === 'granted') {
        subscribePush(true);
      }
    };

    // Listen for app coming to foreground (critical for Android PWA)
    document.addEventListener('visibilitychange', handleVisibility);

    if (Notification.permission === 'default') {
      // Wait for first user interaction to show permission dialog
      document.addEventListener('click', handleInteraction);
      document.addEventListener('touchend', handleInteraction);
    } else {
      // Permission already decided — try to subscribe after SW activates
      const timer = setTimeout(() => subscribePush(true), 2000);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchend', handleInteraction);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
}
