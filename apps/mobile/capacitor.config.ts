import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.notate.viewer',
  appName: 'Notate Viewer',
  webDir: 'dist',
  android: {
    // Allow large Excalidraw bundle / data URLs in the WebView.
    allowMixedContent: false,
  },
};

export default config;
