'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { initializeNativePushNotifications, registerNativePushIfPermitted, removeNativePushListeners } from '@/components/dashboard/native-push-notifications';

export default function PushNotificationBootstrap() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      const initialized = await initializeNativePushNotifications({
        onAction: (route) => {
          if (!mounted) return;
          router.push(route);
        },
      });

      if (!initialized) return;
      await registerNativePushIfPermitted();
    };

    void setup();

    return () => {
      mounted = false;
      void removeNativePushListeners();
    };
  }, [router]);

  return null;
}
