# Wedge Lab personal cloud sync

This feature adds encrypted HTTPS transport and a private per-user Supabase database. The table `public.wedge_personal_sessions` was created on the Wedge Lab Supabase project `mlurlyhgfzdcqbpezeiw`. Row-level security permits only authenticated owners to select, insert, or update their rows; clients cannot delete rows.

## First-time activation: organizer

1. Supabase dashboard → Authentication → Email Templates.
2. In **Magic Link**, replace the default email template with a code template using `{{ .Token }}`, e.g.:
   `<h2>Your Wedge Lab code</h2><p>Enter this code in Wedge Lab: {{ .Token }}</p>`
3. Also set **Confirm Signup** to include `{{ .Token }}`, so first-time users can verify without needing an external browser.
4. Keep the Email authentication provider enabled.
5. In Wedge Lab, go to Settings → Personal cloud sync, enter your email, verify the code.
6. **On the iPhone containing your historic combines:** verify you have a JSON backup, then choose **Enable sync on this device**. Confirm the number of combines to upload. Wait for a nonzero uploaded count or use Sync now.
7. On desktop and iPad, open the same site, sign in with **the exact same email**. Their copy of Wedge Lab downloads completed combines. Select Enable sync on those devices if you want future edits/uploads to sync both ways.

## Data handling and safety

- Old local storage key `wedge-lab-data-v1` is unchanged.
- Never auto-upload historical combines before explicit confirmation on the first device.
- Sync only 20-shot completed combines, not unfinished drafts.
- Existing local data is never deleted by sync, and cloud deletes are not available.
- If edits have diverged on two devices, the client stops and warns rather than overwriting either version.
- First-time same-ID collisions with mismatched data are reported as conflicts instead of silently resolved.
- The original JSON export remains your recovery backup; take another before and after first sync.
- Team Mode is independent: its access-controlled leaderboard requires its own team tables and invitation roster. Do NOT send historical private combines to the team table.

## Troubleshooting

If the email contains a link instead of a numeric OTP, the **Magic Link/Confirm Signup** template needs `{{ .Token }}`. Supabase's free email delivery may be limited; adjust sending settings only if necessary.

After updates, the Home Screen app may cache an older script. Quit the app from the iPhone app switcher and reopen without uninstalling. Do not clear website data or remove the Home Screen app without a fresh JSON export.

Only publishable credentials appear in `cloud-config.js`. NEVER paste a service-role or secret key into a public GitHub file.

The project itself was quoted at **$0/month** for creation. Limits and future pricing can change.
