# Discipline Goals

Expo (React Native + web) app for daily goals and routines. **Firebase** holds auth and all structured data. **Zustand** holds lightweight client state (who is signed in, role). The UI is **shadcn-inspired** (CSS variables + Tailwind via **NativeWind**).

This document explains **how data is stored**, **where reference templates live**, **how the app shows them**, **how the [Admin dashboard](#admin-dashboard) works** (access, goal library re-seed, user management), and **how the visual layer maps to that data**.

---

## Using the app

Navigation is a single **Stack** — there are no bottom tabs. **Home** is the central hub for every user; **Analytics** and (admin-only) **Admin** are pages pushed from Home, each with a **Back** button that returns to Home.

- **Home** (initial route): Header shows **Analytics**, **Admin** (admin only), and **Out** buttons. Below the day strip, a compact summary card surfaces 7-day **avg completion %**, **current streak** (consecutive fully-complete days back from today), and **full days** in the last 7 — tap it to push the full Analytics page. Use **Active plan** to pick a routine template from the catalog (merged defaults + optional `goalLibrary/templates` in RTDB). Scroll to the checklist and tick items for the selected day; the **day strip** is the last 7 local days with `completed/total` from `daySummaries`. Add **one-off tasks** for the selected day via **Quick add** or the floating **+** button (bottom sheet), which calls the same flow as before — tasks use `sourceTemplateId: 'custom'` and can be removed with **×**; the sheet also links to **Change routine (template)**.
- **Analytics** (pushed from Home via the **Analytics** header button): Choose **7 / 30 / 90 days**, see average completion, **streak** (consecutive fully complete days in that window, counting back from today), **best 7-day** total completions, a **bar chart** of daily completion rate, a **week in review** line, **Reports by category**, and **Export CSV** for the selected range (download on web, share sheet on native). **Back** returns to Home.
- **Admin** (pushed from Home via the **Admin** header button, only if your account is an **admin**): See [Admin dashboard](#admin-dashboard) below.

---

## Admin dashboard

The **Admin** area is for users with `users/{uid}/profile/role === 'admin'`. It is implemented in [`src/views/AdminDashboardView.jsx`](src/views/AdminDashboardView.jsx) and [`src/services/AdminService.js`](src/services/AdminService.js).

### Who can open it

- **Entry points:** If `users/{uid}/profile/role` is `admin`, an **Admin** button appears on **Home** between **Analytics** and **Out** (see **Account: admin** under the title). Tapping it pushes the [`AdminDashboardView`](src/views/AdminDashboardView.jsx) onto the stack from [`App.jsx`](src/App.jsx). Non-admins do not see the button at all.
- **Guards:** If `role` is not `admin`, the dashboard navigates to **Home** on mount. If an admin is **demoted** while the screen is open, they are sent back to **Home**.

### If you do not see Admin

Your Realtime Database role is almost certainly **`user`**, not **`admin`**.

1. **Check:** In the app, **Home** shows **Account: user** and a short note about organizer accounts.
2. **Who is admin by default:** The **first** new profile in the project wins `config/firstUserUid` and is written as bootstrap admin in [`AuthService.ensureUserAndBootstrap`](src/services/AuthService.js). Later sign-ups stay `user` until promoted.
3. **Grant admin (Firebase Console):** Open **Realtime Database** → `users` → your Firebase Auth **uid** → `profile` → set **`role`** to the string **`admin`**. Reload the app; the **Admin** button on Home should appear.
4. **Or:** Ask an existing admin to use **Make admin** in the dashboard.

**Verify in the database:** Path `users/<your-uid>/profile/role` must be exactly `admin` (string).
- **Rules:** RTDB security rules allow admins to read/write all of `users/*` so they can change other users’ `profile/role` and list everyone. See [database.rules.json](database.rules.json).

### Overview card

After load (or pull-to-refresh), the dashboard shows:

- Total **users**, **admin** count, **non-admin** count.
- **Goal templates** count (merged defaults + database), from `goalService.getTemplatesMap()`.
- **Bootstrap admin UID** — the value stored at `config/firstUserUid` (the uid that won the first-user transaction). This is informational; promoted admins are not necessarily the same uid.

### User analytics card

Below the overview, a **User analytics ({windowDays}d)** card shows system-wide aggregates with a **7 / 30 / 90 days** window selector. All metrics are computed client-side from the `daySummaries` returned by `adminService.listUsers()` — no extra reads beyond the existing `users` subtree fetch:

- **Active today** — users with a non-empty `daySummaries[today]` (`totalCount > 0`).
- **Active in window** — users with at least one summary in the selected window having `totalCount > 0`.
- **Avg completion** — `Σ completedCount / Σ totalCount` across all users × all days in the window.
- **Full days** — total count of summaries in the window where every task was done across all users.
- **Tasks completed** — sum of `completedCount` across all users in the window.

### Goal library

- **Re-seed goal library** runs [`AdminService.reseedGoalLibrary`](src/services/AdminService.js): overwrites `goalLibrary/templates` with the bundled object from [`src/seed/goalLibrary.default.json`](src/seed/goalLibrary.default.json). Safe to run multiple times; all clients then see the same catalog from RTDB (merged with defaults in the client as documented under [Reference data](#reference-data-what-it-is-and-how-it-is-used)).
- **Current templates** lists each template `id`, **title**, and a short **description** preview (read-only here; editing is via re-seed or manual RTDB edits).

### Users list

- **Data source:** [`AdminService.listUsers`](src/services/AdminService.js) loads the full `users` subtree with one `get('users')`. For each uid it surfaces: `profile` (role, email, displayName, `createdAt`), `settings` (`activeTemplateId`, `timeZone`), and a **days tracked** count from `daySummaries` keys. For large deployments, consider a slimmer index or Cloud Function (noted in code).
- **Sorting:** Admins first, then by `createdAt` descending (newer first).
- **Search:** Filter by uid, email, or display name (case-insensitive substring).
- **Actions:**
  - **Make admin** — sets `users/{id}/profile/role` to `admin`.
  - **Demote** — sets role to `user`. **Disabled** when this would remove the **last** admin (you cannot demote the only admin in the org).
- **Display per row:** display name or email or id, email, role, joined date, timezone, active template id, days with summary data.

### Bootstrap admin vs promoted admins

- The **first** user to sign up (empty `config/firstUserUid`) becomes the **bootstrap** admin in [`AuthService.ensureUserAndBootstrap`](src/services/AuthService.js).
- Additional admins are created only via **Make admin** in this dashboard (or by writing `profile/role` in the console). There is no separate “super-admin” flag in the app.

---

## Architecture at a glance

| Layer | Role |
|--------|------|
| **Firebase Auth** | Identifies the user (Google; web may use `signInWithPopup`, native uses ID token + Expo Auth Session). |
| **Firebase Realtime Database (RTDB)** | Single source of truth: profiles, settings, per-day tasks, day summaries, shared goal library, first-user config. |
| **Class-based services** (`src/services/`) | Read/write RTDB; no React. `AuthService`, `GoalService`, `AdminService`, `RealtimeDatabaseService`. |
| **Zustand** (`src/store/`) | `useAuthStore`: current `user`, `role`, readiness. `useGoalStore` is available for more UI state. Role is **mirrored** from RTDB and updated live via `onValue` in `App.jsx`. |
| **Views** (class components) | `AuthView`, `HomeView`, `AnalyticsView`, `AdminDashboardView` — subscribe to data or receive props, call services, render lists. |
| **UI** | NativeWind + `className` on RN primitives; tokens in `global.css` (same idea as shadcn: `--background`, `--primary`, etc.). Reusable pieces in `src/components/ui/`. |

---

## Realtime Database shape

Paths below are under your RTDB root (as allowed by [database.rules.json](database.rules.json)).

### `config/`

| Path | Purpose |
|------|--------|
| `config/firstUserUid` | **Bootstrap admin lock.** A transaction sets this to the first signed-in user’s `uid` once. That user is stored as `role: 'admin'`. No second writer wins the same “first” slot. |

### `goalLibrary/`

| Path | Purpose |
|------|--------|
| `goalLibrary/templates/{templateId}` | **Shared catalog** of routine templates: phases, diet, water, etc. All signed-in users may **read**. Only **admin** can **write** (re-seed, edits). |

### `users/{uid}/`

| Path | Purpose |
|------|--------|
| `users/{uid}/profile` | `displayName`, `email`, `photoUrl`, `createdAt`, **`role`**: `admin` \| `user`. |
| `users/{uid}/settings` | `activeTemplateId` (e.g. `phase1`, `simple_daily`), `timeZone`. |
| `users/{uid}/daily/{YYYY-MM-DD}/tasks/{taskId}` | Per task: `done`, `doneAt?`, `sourceTemplateId`, `category`, `label`. One row per checklist item for that day. |
| `users/{uid}/daySummaries/{YYYY-MM-DD}` | Denormalized: `totalCount`, `completedCount`, `allDone`, `dateKey` — for fast day chips in the home feed. |

**Security (summary):** each user can read/write their own `users/{uid}/...` unless an **admin** is acting (see rules for exact expressions). `goalLibrary` is read-all / write-admin.

---

## Reference data: what it is and how it is used

**Reference** here means the **default goal templates** that define sections and tasks (workout, diet, water, skin, work, etc.).

1. **Bundled file** (always available offline in the app bundle):  
   [`src/seed/goalLibrary.default.json`](src/seed/goalLibrary.default.json)  
   - Top-level: `{ "templates": { "phase1": { ... }, "phase2": { ... }, ... } }`  
   - Each template has `id`, `title`, optional `description`, and **`sections`**.  
   - Each **section** has `id`, `title`, optional `slot`, and **`tasks`**.  
   - Each **task** has a stable `id`, human-readable `label`, and optional `category` (`exercise`, `diet`, `water`, `skin`, `work`, `other`, etc.).

2. **Runtime merge** in [`GoalService.getTemplatesMap()`](src/services/GoalService.js):  
   - If RTDB has `goalLibrary/templates`, those entries are **merged on top of** the bundled defaults (DB wins on same `templateId`).  
   - If RTDB is empty, the app uses **defaults only** until an admin re-seeds.

3. **Admin re-seed** ([`AdminService.reseedGoalLibrary`](src/services/AdminService.js)):  
   - Writes the bundled `templates` object into `goalLibrary/templates` so all clients see a consistent catalog in the database.

4. **JSDoc types** (not TypeScript) for the same structure: [`src/types/goalModel.js`](src/types/goalModel.js) (`GoalTemplate`, `TemplateSection`, `DailyTaskState`, `DaySummary`, etc.).

---

## How a day of goals is created and updated

1. The user’s **`settings.activeTemplateId`** points to a template in the merged map (`phase1`, `simple_daily`, etc.). The template picker in the UI changes this in RTDB.

2. For a **calendar day** `dateKey` (`YYYY-MM-DD` in the user’s local date), [`GoalService.ensureDayForTemplate`](src/services/GoalService.js) runs:  
   - If `users/{uid}/daily/{dateKey}/tasks` is **empty or missing**, the service **flattens** the chosen template (all sections’ tasks) and **writes** one task object per `taskId`.  
   - If tasks **already** exist, they are **left as-is** (so changing template later does not wipe an existing day without a separate feature).

3. Toggling a checkbox updates that task’s `done` / `doneAt` and recalculates **`daySummaries`** for that day (totals and `allDone`).

4. **Display** in [`HomeView`](src/views/HomeView.jsx):  
   - Subscribes to `daySummaries` and the current day’s `tasks` via RTDB `onValue`.  
   - Renders **sections and rows** from the **template** definition, and merges **done** state from `daily/.../tasks`.  
   - The horizontal **day strip** uses `daySummaries` for counts and completion styling.  
   - “Full day” styling uses completed counts vs `allDone` (see `CheckboxRow` and day cards).

---

## Auth and admin role (data flow)

1. On sign-in, [`AuthService.ensureUserAndBootstrap`](src/services/AuthService.js) creates `profile` and `settings` if missing.  
2. For a **new** `profile`, a transaction on `config/firstUserUid` decides if this uid is the **bootstrap** admin; the profile is written **once** with the correct `role`.  
3. [`App.jsx`](src/App.jsx) subscribes to `users/{uid}/profile/role` and updates Zustand so the **Admin** entry and **Admin** screen guard stay correct after promotions/demotions.  
4. **Admin UI and RTDB calls** (user list, re-seed, promote/demote) are covered in [Admin dashboard](#admin-dashboard) above; rules must allow `goalLibrary` **write** and `users` **read/write** for admins.

---

## Aesthetics: how the UI “takes in” data and presents it

- **Styling** is not a separate data layer. Components use **NativeWind** (`className` on `View`, `Text`, `Pressable`, etc.) with tokens defined in [`global.css`](global.css) (`--background`, `--foreground`, `--primary`, `--card`, `--border`, `--muted-foreground`, `--radius`, etc.) — the same *spirit* as [shadcn/ui](https://ui.shadcn.com/) (HSL-based semantic colors).  
- **Tailwind** is configured in [`tailwind.config.js`](tailwind.config.js) to map those CSS variables to color names like `background`, `foreground`, `primary`, `muted`, `card`, `border`, and `success` for day-completion highlights.  
- **Helpers**: [`src/lib/cn.js`](src/lib/cn.js) (`clsx` + `tailwind-merge`) for conditional classes.  
- **Primitives** such as [`Button`](src/components/ui/Button.jsx), [`Card`](src/components/ui/Card.jsx), [`CheckboxRow`](src/components/ui/CheckboxRow.jsx), [`Text`](src/components/ui/Text.jsx) expect **string labels** and **boolean** state from your data (task label, `done`, `allDayDone`-derived highlight). They do not fetch data themselves.  
- **Data → UI** path: RTDB (and merged templates) → `HomeView` / stores → `className` + layout (lists, modals, admin table).

---

## Local configuration (not committed)

Copy [`.env.example`](.env.example) to `.env` and set Firebase and Google (see example comments). `app.config.js` injects `extra.firebase` and `extra.google` for the client.

---

## PWA (web build)

- `npm run build:web` runs `expo export -p web` and Workbox; output in `dist/`, with `sw.js` for offline/install.  
- [public/index.html](public/index.html) registers the service worker.  
- [public/manifest.json](public/manifest.json) supports install metadata.

For deeper rule copy-paste, see [database.rules.json](database.rules.json) and the Firebase console.
