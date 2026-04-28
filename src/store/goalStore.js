import { create } from 'zustand';

/**
 * @typedef {Object} GoalState
 * @property {string} activeTemplateId
 * @property {string} focusedDateKey
 * @property {Record<string, import('../types/goalModel.js').GoalTemplate> | null} templates
 * @property {Record<string, import('../types/goalModel.js').DailyTaskState> | null} dayTasks
 * @property {import('../types/goalModel.js').DaySummary | null} daySummary
 * @property {string[]} recentDateKeys
 * @property {(id: string) => void} setActiveTemplateId
 * @property {(d: string) => void} setFocusedDate
 * @property {(t: Record<string, import('../types/goalModel.js').GoalTemplate> | null) => void} setTemplates
 * @property {(t: Record<string, import('../types/goalModel.js').DailyTaskState> | null) => void} setDayTasks
 * @property {(s: import('../types/goalModel.js').DaySummary | null) => void} setDaySummary
 * @property {(a: string[]) => void} setRecentDateKeys
 */

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** @type {import('zustand').UseBoundStore<import('zustand').StoreApi<GoalState>>} */
export const useGoalStore = create((set) => ({
  activeTemplateId: 'simple_daily',
  focusedDateKey: todayKey(),
  templates: null,
  dayTasks: null,
  daySummary: null,
  recentDateKeys: [],
  setActiveTemplateId: (activeTemplateId) => set({ activeTemplateId }),
  setFocusedDate: (focusedDateKey) => set({ focusedDateKey }),
  setTemplates: (templates) => set({ templates }),
  setDayTasks: (dayTasks) => set({ dayTasks }),
  setDaySummary: (daySummary) => set({ daySummary }),
  setRecentDateKeys: (recentDateKeys) => set({ recentDateKeys }),
}));

export { todayKey };
