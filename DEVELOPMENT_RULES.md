# Wedge Lab — Development safety rules

These are standing requirements for all future Wedge Lab updates.

1. Never delete, overwrite, migrate, reset, or discard existing golf data without discussing the exact impact with the owner first.
2. Preserve existing features, functionality, scoring, saved sessions, club lists, and draft combines unless the owner explicitly requests a change.
3. For major changes, create a backup branch, work on a separate branch, test the changes, and review before merging to the live site.
4. Treat localStorage key `wedge-lab-data-v1` and its session format as user data: do not rename/change them casually. Any needed migration must preserve existing records and offer a verified backup and rollback plan.
5. Cosmetic updates must not alter scoring, database structure, or shot-entry behavior.
6. Do not promise that changing GitHub code backs up local user data. Current sessions live in each browser/device; remind the owner to export JSON backups regularly. GitHub does not hold those private shots.
7. Verify the published site on phone/tablet as well as desktop after major changes. Keep a rollback route.

Owner preference: LIU-inspired baby blue and gold visual design with clear navy text.


Team Mode additional safeguards:
- Never bulk-upload historical personal sessions into the team database.
- Never treat a teammate-name dropdown as sufficient access control. Keep verified-email allowlisting and server row-level security.
- Never expose service-role credentials, roster emails, or personal auth tokens in this public repository.
- Test team uploads, score edits, removal, denied access, and offline recovery before inviting the team.
