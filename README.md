# Leadline v3 — SDR appointments + Project Designer hours

**Personal work dashboard**, installable on Pixel/Android and accessible in Mac/desktop browsers. One website, **two workspace tabs**:

### 1. Sales Development Representative
- Dashboard for appointments **set**, not appointments *held*: today, Monday–Sunday, month, all-time, last 7 days, lead sources, and weekly goal.
- Simple searchable appointment log with edit/delete. Your company CRM remains responsible for actually setting/handling appointments.
- Paste lead text into the rule-based **lead formatter**, review the output, copy it. Raw pasted text is not automatically stored or synced.

### 2. Project Designer
- Dedicated dashboard: **today's work, this week, monthly hours, weekly overtime estimate, estimated gross pay** (optional), seven-day hours chart, monthly hours by project.
- Running clock: choose a **project** and task, **Start timer → Take break / Resume → End & save**. Elapsed time uses wall-clock timestamps, so browser sleep/closing doesn't reset your timer. Running timer state is saved **on that same device only**.
- Manual entries: add/edit/delete start and end date/times, unpaid break minutes, task and notes, including overnight work. Entries over 36 hours or overlapping another recorded shift are blocked.
- Search and filter saved time entries, export timesheet as CSV, edit past hours.
- Optional estimated hourly pay and configurable weekly overtime threshold and multiplier in **Settings & sync**. By default estimates use Monday–Sunday, >40h per week, 1.5× rate, **but this is NOT a statement that overtime is owed or the legally required rate**. Different employment and payroll rules may apply, including employer-defined workweeks and applicable laws. Only the employer/pay stub determines real pay.
- For shifts crossing midnight, hours are split between calendar days. If you enter an unpaid break without exact break start time, that break is allocated to the end of the session for day/week statistics. For precise overnight/week boundary times, split such shifts into separate entries.

### Local storage, backups, and cloud sync
- The app works **offline** and saves both appointment and completed time entries on each device.
- Save full **JSON backup** (both roles, preferences) in Settings; import v2 or v3 Leadline JSON, or appointment CSV. Hours can be **exported as CSV** in the Time Entries screen. Hours CSV export is not an import format; keep full JSON backups to restore hours.
- Optional **Supabase cloud sync** for saved appointments, completed design hours, and preferences. Configure using the settings page. **Cloud account/project are not pre-connected.** Running timer is local-only. Starting a second timer on another device will not see a first device's active timer; do not run two concurrent timers.
- Syncing uses per-entry update timestamps, last-updated-wins for conflicts, deletion markers, and row-level database access policies. Supabase login tokens remain in local browser storage. An active sign-in does not automatically protect locally cached records from other people who use the same device.
- Always keep JSON backups; offline changes are queued until the site is open and connected. Cloud connection/sync cannot be tested without your Supabase project credentials.

## Install and host (free-tier eligible)

1. Unzip **Leadline-v3-App.zip**. To quickly try it on your Mac, open Terminal in its extracted `Leadline-v3` folder and run `python3 -m http.server 8080`; open `http://localhost:8080` in a browser.
2. If you have already published Leadline v2 on GitHub Pages, **upload/replace the site files with the v3 files** in the same repository root. No new site or URL is needed. Make sure you include the new `app.js`, `index.html`, `styles.css`, `sw.js`, `manifest.webmanifest`, icons, SQL, and README files. Do not commit your Supabase passwords or secret/service_role keys. Your appointment data will carry over in the same browser because storage keys were preserved.
3. For a new site, create a GitHub repo, upload the **contents** of the extracted folder (not the ZIP itself), then repo Settings → Pages → Deploy from a branch → `main` → `/(root)`. Public repos expose source code but do not expose users' local appointment/time records.
4. Once the site is published via **HTTPS**, use Android Chrome ⋮ → **Install app** or **Add to Home screen**. On Mac Chrome use the browser's install affordance. The `manifest.webmanifest` and icons supply Leadline's independent launcher icon.
5. GitHub and Supabase have eligibility/usage limitations; hosting may require an eligible account. They are external services with changing free-tier terms.

## Activate sync for both jobs

1. Ask the company before putting any identifiable client data on personal services; prefer generic project labels.
2. Create or use an eligible Supabase project at https://supabase.com .
3. Open Supabase **SQL Editor** and run **ALL** of `supabase-setup.sql`. **For existing v2 users, run the entire updated file again**; it keeps your appointment table and adds `leadline_hours` and `leadline_preferences`. Access is restricted via RLS to the signed-in owner.
4. In Leadline Settings, enter the `https://your-project.supabase.co` URL and your **publishable** (`sb_publishable_...`) or legacy **anon** key. Never enter a private `service_role`/`sb_secret_...` key.
5. Sign in/create account. Repeat on second device using the same site URL, Supabase project URL, publishable key and user login. Completed sessions, appointments, and preferences will sync when connected. A running timer will not sync until ended and saved.

## Important cautions

- Backup data before clearing app storage, resetting your phone, replacing your browser profile or deleting the installed PWA.
- Data is for **personal tracking**, not the legal payroll record. Cross-check hours, overtime and pay estimates with your employer, your scheduled workweek, and applicable rules. No time rounding policy is imposed beyond storing break duration in whole minutes.
- Supabase cloud storage and website hosting are not deployed or authorized automatically. The files alone do not give you a live website or live cross-device sync.
- Avoid placing sensitive employer/customer data in project names or notes without permission.
