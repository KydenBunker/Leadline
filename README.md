# Leadline V5.4 — Mobile First

This builds on V5.3, preserving all workspaces and their data formats. The mobile navigation, large lead entry field, seven accent colors, sound unlock controls and three-series income graph have been added. **No liquid-glass styling.**

## Saving and syncing
- Appointments and saved Designer sessions are stored locally immediately. When connected to Supabase and signed in, they attempt to upload automatically after changes, on app open/resume, when internet reconnects, and periodically while open. The status line in Settings distinguishes local changes from successfully synced changes.
- Offline edits remain on the device and are retried later. Avoid editing the same entry on both devices before syncing; timestamp-based conflict behavior is last-write-wins.
- **Do not rely on this as an unattended guarantee.** Confirm the 'All changes synced' indicator after important entries; export a backup before updating and after significant changes. Actual Supabase sync has not been verified using your account and Android notifications have not been tested on a physical Pixel.

## Preview
Open the separate `Leadline-V5.4-Interactive-Preview.html` to try fictional data only. Preview intentionally does not connect to Supabase.

## Install over existing GitHub Pages app
1. In your current live app, sync on BOTH devices and download JSON backup in Settings. Check hours and appointment counts and save the backup privately.
2. You have not published versions 4–5 yet. Confirm the Supabase `leadline_sales` table exists; if not, run `supabase-v4_6-upgrade.sql` ONCE in the Supabase SQL Editor, checking the query before executing.
3. Upload the contents of this folder to the ROOT of your existing `Leadline` GitHub repository (not the enclosing folder), REPLACING previous files of the same name and adding the new `mobile-v54.css`, `mobile-v54.js`, and other new files. Do not upload real customer records or Supabase secret keys.
4. Wait for GitHub Pages to deploy. Reopen the website and installed PWA; if it still shows an old version, close and reopen or refresh its cached files. Log in to Supabase if necessary, then verify sync on both devices and compare counts.

## Limitations
- Sales Wins remain manual imports, unmatched sales do not count as yours.
- The formatter is local, rule-based, and needs review before posting to the company chat.
- Android timer notifications are best-effort snapshots, not an always-running native timer notification.
- Earnings and overtime are estimates and may depend on both roles at the same employer.
- Store customer data only with your company's approval.
