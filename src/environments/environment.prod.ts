export const environment = {
  production: import.meta.env['NG_APP_PRODUCTION'] === 'true',
  // ID de cliente web de OAuth (es público). Sin él no se muestra One Tap.
  googleClientId: import.meta.env?.['NG_APP_GOOGLE_CLIENT_ID'] as string | undefined,
  firebase: {
    apiKey: import.meta.env['NG_APP_FIREBASE_API_KEY'] as string,
    authDomain: import.meta.env['NG_APP_FIREBASE_AUTH_DOMAIN'] as string,
    projectId: import.meta.env['NG_APP_FIREBASE_PROJECT_ID'] as string,
    storageBucket: import.meta.env['NG_APP_FIREBASE_STORAGE_BUCKET'] as string,
    messagingSenderId: import.meta.env['NG_APP_FIREBASE_MESSAGING_SENDER_ID'] as string,
    appId: import.meta.env['NG_APP_FIREBASE_APP_ID'] as string,
  },
};
