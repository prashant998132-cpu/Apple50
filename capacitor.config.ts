import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jarvis.ai.pranshu',
  appName: 'JARVIS AI',
  server: {
    url: 'https://apple50.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
  webDir: 'out',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#060610',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Microphone: {
      permissions: ['RECORD_AUDIO'],
    },
  },
};

export default config;
