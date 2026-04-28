import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
} from 'firebase/auth';
import { get, ref, runTransaction, set } from 'firebase/database';
import { getAuthInstance } from '../config/firebase.js';
import { getDatabaseInstance } from '../config/firebase.js';

const ROLE_USER = 'user';
const ROLE_ADMIN = 'admin';

export class AuthService {
  get auth() {
    return getAuthInstance();
  }

  get db() {
    return getDatabaseInstance();
  }

  /**
   * @param {(user: import('firebase/auth').User | null) => void} cb
   * @returns {() => void}
   */
  subscribeAuth(cb) {
    return onAuthStateChanged(this.auth, cb);
  }

  /**
   * @param {string} idToken
   */
  async signInWithGoogleIdToken(idToken) {
    const cred = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(this.auth, cred);
  }

  async signOutUser() {
    await signOut(this.auth);
  }

  /**
   * Create profile and settings for new users, and appoint exactly one **bootstrap** admin:
   * the first uid to win the Realtime DB transaction on `config/firstUserUid`.
   * Later users are `user` until an admin promotes them. Client-side only; use Cloud Functions
   * for stricter production controls.
   *
   * @param {import('firebase/auth').User} user
   */
  async ensureUserAndBootstrap(user) {
    const uid = user.uid;
    const profilePath = `users/${uid}/profile`;
    const profileSnap = await get(ref(this.db, profilePath));
    const now = Date.now();

    if (!profileSnap.exists()) {
      const isBootstrapAdmin = await this.claimFirstUserAsBootstrap(uid);
      await set(ref(this.db, profilePath), {
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        photoUrl: user.photoURL ?? '',
        createdAt: now,
        role: isBootstrapAdmin ? ROLE_ADMIN : ROLE_USER,
      });
    }

    const settingsPath = `users/${uid}/settings`;
    const st = await get(ref(this.db, settingsPath));
    if (!st.exists()) {
      await set(ref(this.db, settingsPath), {
        activeTemplateId: 'simple_daily',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      });
    }
  }

  /**
   * First call wins `config/firstUserUid` for this uid; only one app-wide winner becomes bootstrap admin.
   * @param {string} uid
   * @returns {Promise<boolean>} true if this uid is the first bootstrap
   */
  async claimFirstUserAsBootstrap(uid) {
    const tx = await runTransaction(
      ref(this.db, 'config/firstUserUid'),
      (current) => {
        if (current) {
          return current;
        }
        return uid;
      }
    );
    if (!tx.committed) {
      return false;
    }
    return tx.snapshot.val() === uid;
  }

  /**
   * @param {string} uid
   */
  async getUserRole(uid) {
    const s = await get(ref(this.db, `users/${uid}/profile/role`));
    if (!s.exists() || s.val() !== ROLE_ADMIN) {
      return ROLE_USER;
    }
    return ROLE_ADMIN;
  }
}

export const authService = new AuthService();
