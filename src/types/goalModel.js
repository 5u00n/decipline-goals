/**
 * @typedef {'exercise' | 'diet' | 'water' | 'skin' | 'work' | 'other'} GoalCategory
 */

/**
 * @typedef {Object} TemplateTask
 * @property {string} id
 * @property {string} label
 * @property {GoalCategory} [category]
 * @property {number} [order]
 * @property {Record<string, string>} [meta]
 */

/**
 * @typedef {Object} TemplateSection
 * @property {string} id
 * @property {string} title
 * @property {string} [slot]
 * @property {TemplateTask[]} tasks
 */

/**
 * @typedef {Object} GoalTemplate
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {TemplateSection[]} sections
 */

/**
 * @typedef {Object} DailyTaskState
 * @property {boolean} done
 * @property {number} [doneAt]
 * @property {string} [sourceTemplateId]
 * @property {GoalCategory} [category]
 * @property {string} [label]
 */

/**
 * @typedef {Object} DaySummary
 * @property {number} totalCount
 * @property {number} completedCount
 * @property {boolean} allDone
 * @property {string} [dateKey]
 */

/**
 * @typedef {'user' | 'admin'} UserRole
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} [displayName]
 * @property {string} [email]
 * @property {string} [photoUrl]
 * @property {number} [createdAt]
 * @property {UserRole} [role]
 */

/**
 * @typedef {Object} UserSettings
 * @property {string} [activeTemplateId]
 * @property {string} [timeZone]
 */

export {};
