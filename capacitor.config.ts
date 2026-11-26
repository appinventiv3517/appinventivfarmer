import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android test build of Ver 3 (presentation / demo use only).
 *   npm run build:android        → web build + sync + debug APK
 * The web layer is the Ver 3-only build (no Directions 01/02).
 */
const config: CapacitorConfig = {
  appId: 'com.kisaniurjaa.ver3demo',
  appName: 'Kisani Urjaa',
  webDir: 'dist-android-web',
  backgroundColor: '#fbf7f1',
  android: {
    // Keep the app below the status bar and above the gesture bar on Android 15+.
    adjustMarginsForEdgeToEdge: 'force',
    allowMixedContent: false,
  },
};

export default config;
