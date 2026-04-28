try {
  require('dotenv').config();
} catch {
  // optional
}
const appJson = require('./app.json');

/**
 * @type {import('@expo/config').ExpoConfig}
 */
const config = {
  ...appJson.expo,
  extra: {
    firebase: {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
      databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? '',
    },
    google: {
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
      // Use when Google Cloud "Authorized redirect URIs" must match a fixed host (e.g. http://127.0.0.1:8081)
      oauthRedirect: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_REDIRECT ?? '',
    },
  },
  plugins: appJson.expo.plugins ?? [],
};

module.exports = config;
