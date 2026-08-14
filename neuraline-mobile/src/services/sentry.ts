/**
 * Sentry initialization (optional — only activates if DSN is set).
 *
 * HIPAA: Strip PHI from breadcrumbs and request bodies before sending.
 * Mirrors the web app's main.tsx Sentry config.
 */

// TODO: uncomment when @sentry/react-native is installed
//
// import * as Sentry from '@sentry/react-native';
//
// const SENTRY_DSN = process.env.SENTRY_DSN;
//
// if (SENTRY_DSN) {
//   Sentry.init({
//     dsn: SENTRY_DSN,
//     environment: __DEV__ ? 'development' : 'production',
//     tracesSampleRate: 0.1,
//     beforeSend(event) {
//       // HIPAA: Strip PHI from request bodies
//       if (event.request?.data) delete event.request.data;
//       if (event.breadcrumbs) {
//         event.breadcrumbs = event.breadcrumbs.filter(
//           (b) => b.category !== 'fetch.body' && b.category !== 'xhr.body',
//         );
//       }
//       return event;
//     },
//   });
// }

export {}; // placeholder until Sentry is wired up
