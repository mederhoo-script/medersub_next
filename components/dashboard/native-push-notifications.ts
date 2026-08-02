'use client';

import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications, type ActionPerformed, type Channel, type PushNotificationSchema, type Token } from '@capacitor/push-notifications';

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

function isNativeAndroidPlatform() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
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
  await Promise.all(CHANNELS.map((channel) => PushNotifications.createChannel(channel)));
}

export async function initializeNativePushNotifications(options: InitOptions = {}) {
  if (!isNativeAndroidPlatform()) return false;
  if (initialized) return true;

  try {
    await ensureChannels();

    listeners = [
      await PushNotifications.addListener('registration', (token: Token) => {
        void persistPushToken(token.value);
      }),
      await PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
      }),
      await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        window.dispatchEvent(new CustomEvent('medersub:push-received', { detail: notification }));
      }),
      await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
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
  if (!isNativeAndroidPlatform()) {
    return { ok: false, message: 'Native push notifications are available only in the Android app.' };
  }

  const ready = await initializeNativePushNotifications();
  if (!ready) {
    return { ok: false, message: 'Could not initialize push notifications on this device.' };
  }

  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt') {
    permission = await PushNotifications.requestPermissions();
  }

  if (permission.receive !== 'granted') {
    return { ok: false, message: 'Notification permission was denied. Enable it in Android settings.' };
  }

  await PushNotifications.register();
  return { ok: true };
}

export async function registerNativePushIfPermitted() {
  if (!isNativeAndroidPlatform()) return;

  const ready = await initializeNativePushNotifications();
  if (!ready) return;

  const permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'granted') {
    await PushNotifications.register();
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
