import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import '@fontsource/orbitron/600.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/900.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/share-tech-mono/400.css';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// The service worker is for the installable web build only. Inside the Android app the files
// already ship in the APK, and a cache-first worker would keep serving an old build after an update.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  if (Capacitor.isNativePlatform()) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed', err));
    });
  }
}
