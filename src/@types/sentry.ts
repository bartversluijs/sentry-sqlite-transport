import '@sentry/types';

declare module '@sentry/types' {
  interface Event {
    cached: boolean;
  }
}
