WEDGE LAB — FIRST WORKING VERSION

QUICK TEST
- Open index.html in a desktop browser.
- Select Practice > 30–75 yd (or 50–90, 90–135, 120–155, Custom) > Start 20 shots.
- Enter each FlightScope result manually (left/right/long/short or carry and offline).
- Open Analysis and Sessions when you finish.
- Settings > Import screenshot combine imports your supplied 90–135 yard round (71.0).
- Settings > Full backup exports all current data as JSON. Save this file regularly.

MAKE IT A FREE IPHONE HOME-SCREEN WEB APP (GITHUB PAGES)
1. Create a free GitHub account if needed.
2. Create a new PUBLIC repository, e.g. wedge-lab. Note: the website source code will be public; your shot data remains in your browser rather than GitHub.
3. Upload these files directly into the repository root, keeping their names intact: index.html, manifest.webmanifest, sw.js, icon.svg, icon-192.png, icon-512.png, .nojekyll.
4. GitHub repository > Settings > Pages > Build and deployment > Deploy from a branch > main > /(root) > Save.
5. Open the published HTTPS link on your iPhone using Safari, then Share > Add to Home Screen.
6. Before entering important data, use the home-screen app as your permanent entry point, and export a JSON backup regularly.

IMPORTANT LIMITATIONS
- New practice sessions record ball model as Mixed premium automatically; the dropdown was removed. Existing ball data in saved sessions and JSON/CSV backups remains intact.
- No multi-player cloud leaderboard yet: different browsers/devices cannot see each other's results. A future team mode would need a shared database.
- First version has manual FlightScope entry; no direct FlightScope integration.
- No cloud sync. Data is saved separately in each browser/app installation using local storage.
- Clearing app/site data, private browsing, or removing the app may erase local data.
- Export/Import JSON allows manual transfer to another device.
- The score is a screenshot-reconstructed DECADE-style metric: sum of 17 smallest 2D radial errors from 20 shots. It is not an official DECADE product or independently documented formula.
- The data is not uploaded to GitHub Pages or to any server by this app.


LIU TEAM MODE (INVITE-ONLY)
- Team tab: email one-time-code sign-in, team leaderboard, selected player analytics, and team combine upload.
- Team combines are opt-in, started from Team -> Start LIU team combine. Your existing personal sessions stay local and never auto-upload.
- Live shared scores require a Supabase project. Read TEAM_MODE_SETUP.md. Until configured, the Team tab shows an honest setup message, not fake scores.
- Approved golfers are managed in a PRIVATE Supabase allowlist; never put roster emails or database secrets into this public GitHub repository.
- Server RLS lets approved players view team data, and each player modify only their own combines.
- Team score calculation is performed server-side, but manually entered results remain honor-system based.
