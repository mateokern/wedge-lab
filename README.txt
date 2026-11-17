WEDGE LAB — FIRST WORKING VERSION

QUICK TEST
- Open index.html in a desktop browser.
- Select Practice > 90–135 yd > Start 20 shots.
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
- First version has manual FlightScope entry; no direct FlightScope integration.
- No cloud sync. Data is saved separately in each browser/app installation using local storage.
- Clearing app/site data, private browsing, or removing the app may erase local data.
- Export/Import JSON allows manual transfer to another device.
- The score is a screenshot-reconstructed DECADE-style metric: sum of 17 smallest 2D radial errors from 20 shots. It is not an official DECADE product or independently documented formula.
- The data is not uploaded to GitHub Pages or to any server by this app.
