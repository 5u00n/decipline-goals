import { get, ref, set, update } from 'firebase/database';
import { getDatabaseInstance } from '../config/firebase.js';
import { rtdb } from './RealtimeDatabaseService.js';
import defaultLib from '../seed/goalLibrary.default.json';

const DEFAULT_LIBRARY = defaultLib;

export class GoalService {
  get db() {
    return getDatabaseInstance();
  }

  /**
   * Merges default JSON with `goalLibrary/templates` in RTDB. If `uid` is
   * provided, the user's personal templates from
   * `users/{uid}/personalTemplates` are merged in last (personal wins on
   * id collision).
   *
   * @param {string} [uid]
   * @returns {Promise<Record<string, import('../types/goalModel.js').GoalTemplate>>}
   */
  async getTemplatesMap(uid) {
    const snap = await rtdb.get('goalLibrary/templates');
    const fromDb = snap.exists() ? snap.val() : null;
    const fromDefault = DEFAULT_LIBRARY.templates ?? {};
    /** @type {Record<string, import('../types/goalModel.js').GoalTemplate>} */
    const merged = { ...fromDefault, ...(fromDb ?? {}) };
    if (!uid) {
      return merged;
    }
    const personal = await this.getPersonalTemplates(uid);
    return { ...merged, ...personal };
  }

  /**
   * Read this user's personal templates map (id -> GoalTemplate).
   * Returns `{}` if none exist.
   *
   * @param {string} uid
   * @returns {Promise<Record<string, import('../types/goalModel.js').GoalTemplate>>}
   */
  async getPersonalTemplates(uid) {
    if (!uid) {
      return {};
    }
    const snap = await rtdb.get(`users/${uid}/personalTemplates`);
    if (!snap.exists() || !snap.val()) {
      return {};
    }
    const raw = snap.val();
    /** @type {Record<string, import('../types/goalModel.js').GoalTemplate>} */
    const out = {};
    for (const id of Object.keys(raw)) {
      const v = raw[id];
      if (!v || typeof v !== 'object') {
        continue;
      }
      out[id] = v;
    }
    return out;
  }

  /**
   * Persist a personal template for this user. If `template.id` is missing,
   * a new id of the form `personal_{ts}_{rand}` is generated. Task ids
   * inside sections are normalized to `pt_{templateId}_{seq}` so they
   * never collide with admin-library task ids like `p1_*` / `sd_*`.
   *
   * @param {string} uid
   * @param {Partial<import('../types/goalModel.js').GoalTemplate>} template
   * @returns {Promise<string|null>} the saved templateId, or null on validation failure
   */
  async savePersonalTemplate(uid, template) {
    if (!uid || !template) {
      return null;
    }
    const title = (template.title ?? '').trim();
    if (!title) {
      return null;
    }
    const id =
      typeof template.id === 'string' && template.id.startsWith('personal_')
        ? template.id
        : `personal_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    /** @type {import('../types/goalModel.js').TemplateSection[]} */
    const sections = [];
    let seq = 0;
    for (const sec of template.sections ?? []) {
      if (!sec || typeof sec !== 'object') {
        continue;
      }
      const secTitle = (sec.title ?? '').trim();
      if (!secTitle) {
        continue;
      }
      const secId =
        typeof sec.id === 'string' && sec.id.length > 0
          ? sec.id
          : `${id}_sec_${sections.length + 1}`;
      const tasks = [];
      for (const t of sec.tasks ?? []) {
        if (!t || typeof t !== 'object') {
          continue;
        }
        const lbl = (t.label ?? '').trim();
        if (!lbl) {
          continue;
        }
        seq += 1;
        tasks.push({
          id: `pt_${id}_${seq}`,
          label: lbl,
          category: t.category ?? 'other',
        });
      }
      if (tasks.length === 0) {
        continue;
      }
      sections.push({
        id: secId,
        title: secTitle,
        slot: sec.slot ?? 'all_day',
        tasks,
      });
    }

    if (sections.length === 0) {
      return null;
    }

    /** @type {import('../types/goalModel.js').GoalTemplate} */
    const toSave = {
      id,
      title,
      description: (template.description ?? '').trim() || undefined,
      sections,
    };
    if (toSave.description === undefined) {
      delete toSave.description;
    }
    await set(ref(this.db, `users/${uid}/personalTemplates/${id}`), toSave);
    return id;
  }

  /**
   * Remove a personal template. Does NOT touch any already-created day
   * checklists that were generated from it.
   *
   * @param {string} uid
   * @param {string} id
   */
  async deletePersonalTemplate(uid, id) {
    if (!uid || !id) {
      return;
    }
    await set(ref(this.db, `users/${uid}/personalTemplates/${id}`), null);
  }

  /**
   * @param {string} id
   * @param {string} [uid] include this user's personal templates in the lookup
   */
  async getTemplateById(id, uid) {
    const all = await this.getTemplatesMap(uid);
    return all[id] ?? null;
  }

  /**
   * @param {import('../types/goalModel.js').GoalTemplate} t
   * @returns {{ id: string, label: string, category: string, sectionTitle: string }[]}
   */
  flattenTemplate(t) {
    const out = [];
    for (const sec of t.sections ?? []) {
      for (const task of sec.tasks ?? []) {
        out.push({
          id: task.id,
          label: task.label,
          category: task.category ?? 'other',
          sectionTitle: sec.title,
        });
      }
    }
    return out;
  }

  /**
   * @param {string} uid
   * @param {string} dateKey YYYY-MM-DD
   * @param {string} templateId
   */
  async ensureDayForTemplate(uid, dateKey, templateId) {
    const base = `users/${uid}/daily/${dateKey}`;
    const t = await this.getTemplateById(templateId, uid);
    if (!t) {
      return;
    }
    const flat = this.flattenTemplate(t);
    const tasksSnap = await get(ref(this.db, `${base}/tasks`));
    if (tasksSnap.exists() && Object.keys(tasksSnap.val() ?? {}).length > 0) {
      return;
    }
    /** @type {Record<string, import('../types/goalModel.js').DailyTaskState>} */
    const tasks = {};
    for (const x of flat) {
      tasks[x.id] = {
        done: false,
        sourceTemplateId: templateId,
        category: x.category,
        label: x.label,
      };
    }
    await set(ref(this.db, `${base}/tasks`), tasks);
    await this.recomputeDaySummary(uid, dateKey);
  }

  /**
   * @param {string} uid
   * @param {string} dateKey
   */
  async recomputeDaySummary(uid, dateKey) {
    const tasksPath = `users/${uid}/daily/${dateKey}/tasks`;
    const s = await get(ref(this.db, tasksPath));
    if (!s.exists() || !s.val()) {
      await set(ref(this.db, `users/${uid}/daySummaries/${dateKey}`), {
        totalCount: 0,
        completedCount: 0,
        allDone: true,
        dateKey,
      });
      return;
    }
    const obj = s.val() ?? {};
    const ids = Object.keys(obj);
    const total = ids.length;
    const completed = ids.filter((k) => obj[k]?.done).length;
    const allDone = total > 0 && completed === total;
    await set(ref(this.db, `users/${uid}/daySummaries/${dateKey}`), {
      totalCount: total,
      completedCount: completed,
      allDone,
      dateKey,
    });
  }

  /**
   * @param {string} uid
   * @param {string} dateKey
   * @param {string} taskId
   * @param {boolean} done
   * @param {{ activeTemplateId?: string, labelHint?: string }} [ctx] Used when the task row is missing (e.g. day was created under another template).
   */
  async setTaskDone(uid, dateKey, taskId, done, ctx = {}) {
    const { activeTemplateId, labelHint } = ctx;
    const p = `users/${uid}/daily/${dateKey}/tasks/${taskId}`;
    const s = await get(ref(this.db, p));
    const now = Date.now();

    if (!s.exists()) {
      let label =
        typeof labelHint === 'string' && labelHint.trim().length > 0
          ? labelHint.trim()
          : taskId;
      let category = 'other';
      let sourceTemplateId = 'unknown';

      if (typeof taskId === 'string' && taskId.startsWith('custom_')) {
        sourceTemplateId = 'custom';
      } else if (activeTemplateId) {
        sourceTemplateId = activeTemplateId;
        const t = await this.getTemplateById(activeTemplateId, uid);
        const found = t
          ? this.flattenTemplate(t).find((x) => x.id === taskId)
          : null;
        if (found) {
          label = found.label;
          category = found.category ?? 'other';
        }
      }

      await set(ref(this.db, p), {
        done,
        doneAt: done ? now : null,
        sourceTemplateId,
        label,
        category,
      });
    } else {
      const patch = { done, doneAt: done ? now : null };
      await update(ref(this.db, p), patch);
    }

    await this.recomputeDaySummary(uid, dateKey);
  }

  /**
   * @param {string} uid
   * @param {string} dateKey
   * @param {{ label: string, category?: string }} body
   * @returns {Promise<string | null>} new taskId or null
   */
  async addCustomTask(uid, dateKey, body) {
    const label = (body?.label ?? '').trim();
    if (!label) {
      return null;
    }
    const taskId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const path = `users/${uid}/daily/${dateKey}/tasks/${taskId}`;
    /** @type {import('../types/goalModel.js').DailyTaskState} */
    const row = {
      done: false,
      sourceTemplateId: 'custom',
      category: body?.category ?? 'other',
      label,
    };
    await set(ref(this.db, path), row);
    await this.recomputeDaySummary(uid, dateKey);
    return taskId;
  }

  /**
   * @param {string} uid
   * @param {string} dateKey
   * @param {string} taskId
   */
  async removeCustomTask(uid, dateKey, taskId) {
    const p = `users/${uid}/daily/${dateKey}/tasks/${taskId}`;
    const s = await get(ref(this.db, p));
    if (!s.exists()) {
      return;
    }
    const val = s.val();
    if (val?.sourceTemplateId !== 'custom') {
      return;
    }
    await set(ref(this.db, p), null);
    await this.recomputeDaySummary(uid, dateKey);
  }

  /**
   * @param {string} uid
   * @param {string} templateId
   */
  async setActiveTemplate(uid, templateId) {
    await set(ref(this.db, `users/${uid}/settings/activeTemplateId`), templateId);
  }

  /**
   * @param {string} uid
   * @returns {Promise<string>}
   */
  async getActiveTemplateId(uid) {
    const s = await get(ref(this.db, `users/${uid}/settings/activeTemplateId`));
    if (s.exists() && s.val()) {
      return String(s.val());
    }
    return 'simple_daily';
  }
}

export const goalService = new GoalService();
