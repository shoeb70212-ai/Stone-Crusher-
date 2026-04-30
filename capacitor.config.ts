import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crushtrack.erp',
  appName: 'CrushTrack',
  webDir: 'dist',
  // Deep link URL scheme: crushtrack://view/<name>
  // Android: registered in AndroidManifest.xml as an intent-filter (add after `npx cap sync`)
  // iOS: registered in Info.plist CFBundleURLSchemes (add after `npx cap sync`)
  server: {
    androidScheme: 'https',
  },
};

export default config;
