import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { initErrorReporting } from './lib/errorReporting.js';
import './index.css';

// No-op unless VITE_SENTRY_DSN is set (see .env.example and README) - lets
// this run in dev/CI without a Sentry account while still alerting on
// crashes once a DSN is configured for staging/production.
initErrorReporting();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
    {/* Vercel's own page-view/web-vitals tracking - cookie-free (no consent
        banner needed) and only does anything once this is actually
        deployed on Vercel, so it's silent in local dev. */}
    <Analytics />
  </React.StrictMode>
);
