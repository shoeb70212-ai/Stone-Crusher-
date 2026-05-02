import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crushtrack.erp',
  appName: 'CrushTrack',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // The bundled APK calls the Vercel API for all data operations.
    // VITE_API_URL is baked into the JS bundle at build time — this server
    // block only controls the WebView origin scheme, not the API target.
  },
  plugins: {
    // Keep Preferences storage group consistent across reinstalls
    Preferences: {
      group: 'com.crushtrack.erp.prefs',
    },
  },
};

export default config;
