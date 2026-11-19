# LIU Wedge Lab · Team Mode activation

Team Mode includes invite-only email-code sign-in, a team leaderboard, per-player analysis, and upload of finished combines.

STATUS: This interface is not a live shared leaderboard until the Supabase database, roster, and public connection settings are configured.

## Setup (organizer only)

1. Create a Supabase project. Keep your database password and all service-role/secret keys private.
2. Run the complete SQL file at supabase/team_mode.sql in the Supabase SQL Editor.
3. Add each LIU teammate, including the organizer, to the approved roster in Supabase SQL Editor. Do NOT commit real teammate emails to this public repository.

Example (run privately in Supabase, with actual values):

    insert into public.wedge_team_members(email,display_name)
    values ('player@example.edu','Player Name')
    on conflict (email) do update set display_name=excluded.display_name, active=true;

Removing access: update that roster row and set active=false.

4. Enable Supabase Email authentication. Configure Magic Link AND Confirm Signup email templates to show the OTP using the Supabase template variable {{ .Token }}. This supports code entry inside an iPhone Home Screen app instead of opening a magic link in another browser.
5. Set the Auth Site URL and allowed redirect URL to https://mateokern.github.io/wedge-lab/
6. Edit team-config.js with the Supabase Project URL and PUBLISHABLE/ANON key only. Never put a service-role, secret, or admin key in GitHub.

Example client configuration:

    window.WEDGE_TEAM_CONFIG={
      url:'https://YOUR-PROJECT-REF.supabase.co',
      publishableKey:'YOUR_PUBLIC_KEY'
    };

7. Commit the config. GitHub Pages redeploys. Test with an allowlisted email, then a non-roster email.

## Must-pass checks before inviting teammates

- An approved LIU player receives and verifies a code, sees the right player name, and can load the shared leaderboard.
- A non-roster email must NOT see any roster or score data, even after authenticating.
- Two different approved devices must see the same scores.
- A Team-started combine uploads after shot 20. A personal combine never uploads.
- An offline Team combine remains local and can sync after reconnecting.
- Editing or deleting your own team session updates the remote score; a user cannot modify another player's result.
- Historical solo combines and the current local storage key are unchanged.

## Rules and limitations

The server calculates the DECADE-style score from 20 submitted shots (best 17 radial misses); users cannot send an arbitrary score. Shots are manually input and remain on the honor system. Presets 30–75, 50–90, and 90–135 are ranked separately; custom-range sessions are not ranked.

Do not delete/overwrite local records or change scoring without talking to the site owner. A full code backup branch exists: backup/pre-team-mode-2026-11-19. Your golf sessions live in local browser storage and are NOT backed up by a GitHub branch. Export JSON backups from each device regularly.

Supabase email delivery has rate limits and may require SMTP configuration as the team grows.
