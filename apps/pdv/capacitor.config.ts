import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gtech.pdv',
  appName: 'Gtech PDV',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;
