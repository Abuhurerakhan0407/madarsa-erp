import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.ilmgaah.app.preview',
  appName: 'Ilmgaah Preview',
  webDir: 'dist',
  backgroundColor: '#0F5F46',
  loggingBehavior: 'none',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    zoomEnabled: false,
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
