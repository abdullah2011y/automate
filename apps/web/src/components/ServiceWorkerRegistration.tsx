'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[ByteForge PWA] Service Worker registered successfully, scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[ByteForge PWA] Service Worker registration failed:', err);
          });
      });
    }
  }, []);

  return null;
}
