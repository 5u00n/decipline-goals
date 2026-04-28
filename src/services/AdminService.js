import { get, ref, set } from 'firebase/database';
import defaultLib from '../seed/goalLibrary.default.json';
import { getDatabaseInstance } from '../config/firebase.js';

export class AdminService {
  get db() {
    return getDatabaseInstance();
  }

  /**
   * Re-seed goal library from bundled default JSON.
   */
  async reseedGoalLibrary() {
    await set(ref(this.db, 'goalLibrary/templates'), defaultLib.templates);
    return Object.keys(defaultLib.templates ?? {}).length;
  }

  /**
   * List all users under `/users/`. Uses one `get(users)` read, which loads the **full**
   * subtree (including `daily` task data). Fine for small deployments; for large trees
   * consider a Cloud Function or shallow admin index.
   *
   * @returns {Promise<{ id: string, role: string, email: string, displayName: string, createdAt: number | null, activeTemplateId: string, timeZone: string, daysTracked: number, daySummaries: Record<string, { totalCount: number, completedCount: number, allDone: boolean }> }[]>}
   */
  async listUsers() {
    const s = await get(ref(this.db, 'users'));
    if (!s.exists() || !s.val()) {
      return [];
    }
    const u = s.val() ?? {};
    return Object.keys(u).map((id) => {
      const row = u[id] ?? {};
      const p = row.profile ?? {};
      const st = row.settings ?? {};
      const summaries = row.daySummaries ?? {};
      /** @type {Record<string, { totalCount: number, completedCount: number, allDone: boolean }>} */
      const slim = {};
      for (const k of Object.keys(summaries)) {
        const v = summaries[k] ?? {};
        const totalCount = typeof v.totalCount === 'number' ? v.totalCount : 0;
        const completedCount =
          typeof v.completedCount === 'number' ? v.completedCount : 0;
        slim[k] = {
          totalCount,
          completedCount,
          allDone: !!(v.allDone || (totalCount > 0 && completedCount === totalCount)),
        };
      }
      return {
        id,
        role: p.role ?? 'user',
        email: p.email ?? '',
        displayName: p.displayName ?? '',
        createdAt: typeof p.createdAt === 'number' ? p.createdAt : null,
        activeTemplateId: st.activeTemplateId ? String(st.activeTemplateId) : '',
        timeZone: st.timeZone ? String(st.timeZone) : '',
        daysTracked: Object.keys(slim).length,
        daySummaries: slim,
      };
    });
  }

  /**
   * UID that won the first-user bootstrap transaction (`config/firstUserUid`).
   * @returns {Promise<string | null>}
   */
  async getBootstrapAdminUid() {
    const s = await get(ref(this.db, 'config/firstUserUid'));
    if (!s.exists() || s.val() == null || s.val() === '') {
      return null;
    }
    return String(s.val());
  }

  /**
   * @param {string} userId
   * @param {'user' | 'admin'} role
   */
  async setUserRole(userId, role) {
    await set(ref(this.db, `users/${userId}/profile/role`), role);
  }
}

export const adminService = new AdminService();
