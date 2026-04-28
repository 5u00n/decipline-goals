import { getApps, getApp, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig ?? Constants.manifest)?.extra;

/** @returns {import('firebase/app').FirebaseOptions | null} */
function getOptions() {
  const f = extra?.firebase;
  if (!f || !f.apiKey || !f.databaseURL) {
    return null;
  }
  return {
    apiKey: f.apiKey,
    authDomain: f.authDomain,
    projectId: f.projectId,
    storageBucket: f.storageBucket,
    messagingSenderId: f.messagingSenderId,
    appId: f.appId,
    databaseURL: f.databaseURL,
  };
}

let appInstance = null;

/** @returns {import('firebase/app').FirebaseApp} */
function getFirebaseApp() {
  if (getApps().length) {
    return getApp();
  }
  if (appInstance) {
    return appInstance;
  }
  const o = getOptions();
  if (!o) {
    throw new Error(
      'Missing Firebase config. Set EXPO_PUBLIC_FIREBASE_* env (see .env.example).'
    );
  }
  appInstance = initializeApp(o);
  return appInstance;
}

/** @returns {import('firebase/app').FirebaseApp | null} */
export function tryGetApp() {
  const o = getOptions();
  if (!o) {
    return null;
  }
  return getApps().length ? getApp() : getFirebaseApp();
}

export function getAuthInstance() {
  return getAuth(getFirebaseApp());
}

export function getDatabaseInstance() {
  return getDatabase(getFirebaseApp());
}

export function isFirebaseConfigured() {
  return !!getOptions();
}

export { getOptions };
