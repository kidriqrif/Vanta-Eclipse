import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vantrexagames.vantaeclipse',
  appName: 'Vanta Eclipse',
  webDir: 'dist',
  // The WebView's own colour until the game paints: the launcher background, never white.
  backgroundColor: '#080A12',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // Light status and navigation bar icons over the dark game, in light mode too.
    SystemBars: { style: 'DARK' }
  }
};

export default config;
