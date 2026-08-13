
'use client';

import type { PluginListenerHandle } from '@capacitor/core';
import type { ActionPerformed, Channel, PushNotificationSchema, Token } from '@capacitor/push-notifications';

let PushNotifications: typeof import('@capacitor/push-notifications')['PushNotifications'] | null = null;
let CapacitorModule: typeof import('@capacitor/core') | null = null;

async function getCapacitor() {
  if (CapacitorModule) return CapacitorModule.Capacitor;
  const mod = await import('@capacitor/core');
  CapacitorModule = mod;
  return mod.Capacitor;
}

async function getPushNotifications() {
  if (PushNotifications) return PushNotifications;
  try {
    // Dynamic import so Turbopack/SSR won't attempt to resolve the native module at build time.
    const mod = await import('@capacitor/push-notifications');
    PushNotifications = mod.PushNotifications;
    return PushNotifications;
  } catch (error) {
    console.error('Failed to load PushNotifications module:', error);
    throw error;
  }
}

type InitOptions = {
  onAction?: (route: string) => void;
};

const CHANNELS: Channel[] = [
  { id: 'transactions', name: 'Transactions', description: 'Purchase and wallet updates', importance: 4, visibility: 1, sound: 'default' },
  { id: 'account-alerts', name: 'Account Alerts', description: 'Security and account notifications', importance: 4, visibility: 1, sound: 'default' },
  { id: 'promos', name: 'Promotions', description: 'Promotional updates and offers', importance: 3, visibility: 1, sound: 'default' },
];

let initialized = false;
let listeners: PluginListenerHandle[] = [];
let latestToken: string | null = null;

async function isNativeAndroidPlatform() {
  try {
    const Capacitor = await getCapacitor();
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

function extractRouteFromPayload(action: ActionPerformed): string | null {
  const payload = action.notification?.data || {};
  const values = [payload?.route, payload?.path, payload?.deeplink, payload?.deepLink, payload?.url];
  const raw = values.find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (!raw) return null;
  const value = raw.trim();

  if (value.startsWith('/')) return value;

  try {
    const parsed = new URL(value);
    if (!/medersub\.com\.ng|medersub\.vercel\.app$/i.test(parsed.hostname)) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

async function persistPushToken(token: string) {
  latestToken = token;
  try {
    const Capacitor = await getCapacitor();
    await fetch('/api/account/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: 'register-token',
        token,
        platform: Capacitor.getPlatform(),
      }),
    });
  } catch (error) {
    console.error('Failed to persist native push token:', error);
  }
}

async function ensureChannels() {
  const PN = await getPushNotifications();
  await Promise.all(CHANNELS.map((channel) => PN.createChannel(channel)));
}

export async function initializeNativePushNotifications(options: InitOptions = {}) {
  if (!(await isNativeAndroidPlatform())) return false;
  if (initialized) return true;

  try {
    await ensureChannels();

    const PN = await getPushNotifications();

    listeners = [
      await PN.addListener('registration', (token: Token) => {
        void persistPushToken(token.value);
      }),
      await PN.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
      }),
      await PN.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        window.dispatchEvent(new CustomEvent('medersub:push-received', { detail: notification }));
      }),
      await PN.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        window.dispatchEvent(new CustomEvent('medersub:push-opened', { detail: action.notification }));
        const route = extractRouteFromPayload(action);
        if (route && options.onAction) options.onAction(route);
      }),
    ];
  } catch (error) {
    console.error('Failed to initialize native push notifications:', error);
    return false;
  }

  initialized = true;
  return true;
}

export async function registerNativePushNotifications() {
  if (!(await isNativeAndroidPlatform())) {
    return { ok: false, message: 'Native push notifications are available only in the Android app.' };
  }

  const ready = await initializeNativePushNotifications();
  if (!ready) {
    return { ok: false, message: 'Could not initialize push notifications on this device.' };
  }
  const PN = await getPushNotifications();
  let permission = await PN.checkPermissions();
  if (permission.receive === 'prompt') {
    permission = await PN.requestPermissions();
  }

  if (permission.receive !== 'granted') {
    return { ok: false, message: 'Notification permission was denied. Enable it in Android settings.' };
  }

  await PN.register();
  return { ok: true };
}

export async function registerNativePushIfPermitted() {
  if (!(await isNativeAndroidPlatform())) return;

  const ready = await initializeNativePushNotifications();
  if (!ready) return;
  const PN = await getPushNotifications();
  const permission = await PN.checkPermissions();
  if (permission.receive === 'granted') {
    await PN.register();
  }
}

export async function disableCurrentNativePushToken() {
  if (!latestToken) return;

  try {
    await fetch('/api/account/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'disable-token', token: latestToken }),
    });
  } catch (error) {
    console.error('Failed to disable push token:', error);
  }
}

export async function removeNativePushListeners() {
  await Promise.all(listeners.map((listener) => listener.remove()));
  listeners = [];
  initialized = false;
}
