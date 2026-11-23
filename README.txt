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

LARGE CLUB PICKER (IPHONE FRIENDLY)
- New sessions show a large grey touch-friendly club chooser rather than the native iPhone dropdown.
- The five standard practice options are 58°, 54°, 50°, 46° PW, and 9 iron.
- Existing saved starter bags are presented as these five choices without changing the underlying saved bag or historical shot records.
- If you have customized your bag, your saved custom choices remain available. Settings > My bag controls future practice choices; saving a new bag does not alter previous shot records.
- Existing incomplete combines keep their selected club when resumed; the new selector does not discard their values.

EDIT ALL SHOTS LOGGED WITH THE WRONG CLUB
- From Sessions, tap Report on a completed combine and select Change clubs for this session.
- Choose the original club (for example 54°) and the correct club (58°), then confirm.
- Only shots originally logged with the selected club change; other clubs, coordinates, targets, scoring and saved combines are untouched.
- Historical shot data remains on the device where it was recorded; updating the website does not directly edit a device's local session.
- Previous one-shot Edit controls are still available. Team combines will resync their corrected records when a private team backend is configured and online.

SPREAD-OUT RANDOM TARGETS (NOV 2026)
- Standard 20-shot combines now use 20 different whole-yard targets, balanced across five equal-distance bands (four targets per band).
- Consecutive shots are at least 10 yards apart, so a 60 yd shot cannot immediately be followed by 61, 63, or 69 yd.
- Custom ranges narrower than 30 yards relax the minimum gap. Custom ranges containing fewer than 20 whole-yard values necessarily repeat yardages.
- This only affects newly started combines. Existing finished sessions, shot coordinates, scores, and unfinished target sequences are never regenerated.
- Different target ordering/coverage can affect difficulty. Compare long-term scores with that training-protocol change in mind.

PERSONAL CROSS-DEVICE CLOUD SYNC (OPTIONAL)
- Open Settings > Personal cloud sync. One email account syncs completed combines across iPhone, iPad, and desktop.
- Verify email code, then explicitly enable uploads on the device with existing saved rounds. Other devices download that history safely.
- Completed sessions sync; drafts remain local. LocalStorage storage key/scoring unchanged. Cloud conflict detection prevents blind overwrites.
- The cloud database uses owner-only RLS. Supabase email OTP templates need {{ .Token }}. See PERSONAL_CLOUD_SETUP.md.
- Export JSON backups before and after first sync; do not delete iPhone app data.
