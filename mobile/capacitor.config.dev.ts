import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.ilmgaah.app',
  appName: 'Ilmgaah',
  webDir: 'dist',
  backgroundColor: '#0F5F46',
  // Even internal builds can display real student/guardian data. Keep native
  // bridge logging disabled so personal data and session details are not
  // accidentally exposed through device logs.
  loggingBehavior: 'none',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    zoomEnabled: false,
  },
  server: {
    url: 'https://madarsa-erp.vercel.app/login',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 900,
      backgroundColor: '#0F5F46',
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: '#0F5F46',
      style: 'LIGHT',
    },
  },
};

export default config;
