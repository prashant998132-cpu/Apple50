import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jarvis.ai.pranshu',
  appName: 'JARVIS AI',
  // Remote URL — sab API routes, SSE, sab kuch kaam karega
  server: {
    url: 'https://apple50.vercel.app',
    cleartext: false,
  },
  webDir: 'out',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#060610',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      spinnerColor: '#00d4ff',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#060610',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
    },
  },
};

export default config;
