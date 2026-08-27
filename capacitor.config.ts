import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vantrexagames.vantaeclipse',
  appName: 'Vanta Eclipse',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
