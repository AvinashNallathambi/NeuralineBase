import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

// ── Sentry initialization (optional — only activates if DSN is set) ────────
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  // Dynamic import so Sentry isn't bundled when DSN is absent
  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      // HIPAA: Strip PHI from breadcrumbs and request bodies
      beforeSend(event) {
        if (event.request?.data) delete event.request.data;
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.filter(
            (b) => b.category !== 'fetch.body' && b.category !== 'xhr.body',
          );
        }
        return event;
      },
    });
  }).catch(() => {
    // Sentry package not installed — silently skip
  });
}

// ── React Error Boundary (catches render errors, prevents white screen) ────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Uncaught error:', error, info);
    // Forward to Sentry if available
    import('@sentry/react').then((Sentry) => {
      Sentry.captureException(error);
    }).catch(() => {});
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 48, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ color: '#1a2b3c' }}>Something went wrong</h2>
          <p style={{ color: '#666', marginBottom: 24 }}>
            An unexpected error occurred. Please refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 24px',
              backgroundColor: '#0D7C8A',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
