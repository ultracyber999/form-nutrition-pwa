import '@form/design/tokens.css';
import './styles.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app';
import { FormProvider } from './context';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('root element missing');

createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <FormProvider>
        <App />
      </FormProvider>
    </BrowserRouter>
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline shell remains unavailable if registration fails; the settings screen shows honest local status.
    });
  });
}
