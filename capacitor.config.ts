import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.metalraptors.app',
  appName: 'Metal Raptors',
  webDir: 'iphone-build',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
