# Wedge Lab personal cloud sync

The app has a private personal-session Supabase database. Local completed combines can be synced across the athlete's devices after a user explicitly enables upload.

## Sign in on Supabase Free — no custom SMTP required for the project owner

New Supabase Free projects using the default email provider cannot edit email templates. This is normal; leave the **Magic Link or OTP** and **Confirm Signup** templates unchanged.

Supabase's default emails send one-time **links**, not numerical codes. Wedge Lab accepts those links through a secure paste-and-verify step.

### iPhone Home Screen app (important)

1. Keep your existing Wedge Lab install and its JSON backup; never remove it or clear site data.
2. Open Wedge Lab using the **Home Screen icon containing your recorded sessions**, then Settings → Personal cloud sync.
3. Enter the email associated with your Supabase project, and request a link.
4. Open the message in Mail or Gmail. **Long-press the sign-in link and use Copy Link — do not tap it yet.** Opening it may sign Safari in instead of the Home Screen installation, which has different local storage.
5. Return to the Home Screen app, paste the copied complete https://...supabase.co/auth/v1/verify?... link in its sign-in field, and select **Sign in with copied link**.
6. Check the signed-in email, confirm your local sessions are still present, then select **Enable sync on this device**. This asks before uploading existing history.
7. Use the same email on the laptop or iPad. Copy/paste the emailed sign-in link there (or click directly after configuring redirect URLs). Your sessions are pulled into each device.

### Desktop clickable sign-in links (optional)

To make clicking email links return directly to the app, open Supabase Dashboard → Authentication → URL Configuration.

- Set **Site URL** to `https://mateokern.github.io/wedge-lab/`.
- Add `https://mateokern.github.io/wedge-lab/` to **Redirect URLs** if needed.

Wedge Lab handles the Supabase URL fragment, verifies the bearer token through the Auth endpoint, signs the current browser in, then removes the sensitive fragment from its address bar.

If you receive a six-digit numeric code because you configured SMTP templates later, the fallback code form remains under **Have a numeric code instead?**.

Note: the default Supabase mail sender has recipient restrictions (often only addresses belonging to the project's team). For your personal account, use the email attached to the Supabase project. Team-wide email invitations may require custom SMTP later.

## Data protection

- Existing `wedge-lab-data-v1` localStorage key, scores, completed sessions, and drafts are untouched by this login change.
- Successful sign-in downloads existing cloud sessions. **Uploads of existing local sessions require a separate explicit confirmation.**
- Cloud session rows are protected with owner-only row-level security.
- Divergent local/remote edits are flagged as conflicts instead of silently overwritten.
- Offline practice and JSON export remain available.
- Continue saving JSON backups before first sync and weekly afterward.

This is personal cloud sync, not LIU Team Mode. Team Mode requires its own roster/backend activation.
