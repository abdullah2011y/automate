import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.byteforge.omnicommerce',
  appName: 'ByteForge',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile',
    scheme: 'ByteForge',
  },
};

export default config;
