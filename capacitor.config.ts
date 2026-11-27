import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android test build of Ver 3 (presentation / demo use only).
 *   npm run build:android        → web build + sync + debug APK
 * The web layer is the Ver 3-only build (no Directions 01/02).
 */
// CAP_APP=didi switches to the Kisani Didi app (npm run build:android-didi),
// a separate Android project in android-didi/. The default stays Ver 3.
const DIDI = process.env.CAP_APP === 'didi';

const config: CapacitorConfig = {
  appId: DIDI ? 'com.kisaniurjaa.didi.test' : 'com.kisaniurjaa.ver3demo',
  appName: DIDI ? 'Kisani Didi' : 'Kisani Urjaa',
  webDir: DIDI ? 'dist-android-didi' : 'dist-android-web',
  backgroundColor: '#fbf7f1',
  android: {
    ...(DIDI ? { path: 'android-didi' } : {}),
    // Keep the app below the status bar and above the gesture bar on Android 15+.
    adjustMarginsForEdgeToEdge: 'force',
    allowMixedContent: false,
  },
};

export default config;
