import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medersub.app',
  appName: 'MEDERSUB',
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    url: 'https://medersub.vercel.app',
    cleartext: false,
  },
};

export default config;
