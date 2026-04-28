import { get, onValue, ref, runTransaction, set, update, remove } from 'firebase/database';
import { getDatabaseInstance } from '../config/firebase.js';

/**
 * Low-level Realtime Database helpers.
 */
export class RealtimeDatabaseService {
  get db() {
    return getDatabaseInstance();
  }

  /**
   * @param {string} path
   * @returns {import('firebase/database').DatabaseReference}
   */
  r(path) {
    return ref(this.db, path);
  }

  /**
   * @param {string} path
   * @returns {Promise<import('firebase/database').DataSnapshot>}
   */
  get(path) {
    return get(this.r(path));
  }

  /**
   * @param {string} path
   * @param {unknown} value
   */
  set(path, value) {
    return set(this.r(path), value);
  }

  /**
   * @param {import('firebase/database').Update} values
   */
  updateAtRoot(values) {
    return update(ref(this.db, '/'), values);
  }

  /**
   * @param {string} path
   */
  removePath(path) {
    return remove(this.r(path));
  }

  /**
   * @param {string} path
   * @param {(a: import('firebase/database').DataSnapshot) => void} fn
   * @returns {() => void} unsubscribe
   */
  subscribe(path, fn) {
    return onValue(this.r(path), fn);
  }

  /**
   * @param {string} path
   * @param {(val: unknown) => unknown} fn
   */
  runTransactionOn(path, fn) {
    return runTransaction(this.r(path), (current) => fn(current));
  }
}

export const rtdb = new RealtimeDatabaseService();
