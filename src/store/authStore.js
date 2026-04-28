import { create } from 'zustand';

/**
 * @typedef {Object} AuthState
 * @property {import('firebase/auth').User | null} user
 * @property {'user' | 'admin'} role
 * @property {boolean} ready
 * @property {string | null} error
 * @property {(u: import('firebase/auth').User | null) => void} setUser
 * @property {(r: 'user' | 'admin') => void} setRole
 * @property {(v: boolean) => void} setReady
 * @property {(e: string | null) => void} setError
 */

/** @type {import('zustand').UseBoundStore<import('zustand').StoreApi<AuthState>>} */
export const useAuthStore = create((set) => ({
  user: null,
  role: 'user',
  ready: false,
  error: null,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setReady: (ready) => set({ ready }),
  setError: (error) => set({ error }),
}));
