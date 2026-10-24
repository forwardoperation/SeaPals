# SeaPals bug reporting

Reefbound and the standalone Simulator share one private bug-report queue. Players can open **Report a bug** from Reefbound's pause menu or the Simulator menu. A report contains the player's description and a bounded game-state snapshot; it does not intentionally include an account ID, email, profile name, or Reefbound save file.

## One-time setup

1. Run `supabase/bug-reports.sql` in the Supabase SQL editor for the existing SeaPals project.
2. Generate a separate high-entropy owner token and set `BUG_REPORT_ADMIN_TOKEN` in local and hosted server environments. Do not expose it with a `NEXT_PUBLIC_` name.
3. Keep `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured on the server as they are for the existing private data routes.
4. Add a Cloudflare rate-limit rule for `POST /api/bug-reports`. Same-origin checks prevent cross-site submissions but are not a substitute for public-endpoint abuse controls.

The SQL enables row-level security, denies browser roles direct access, and leaves reads/writes to server routes using the service role.

### Verify storage before releasing the reporter

Run `npm run bugs:list -- --surface=simulator --status=all --sort=newest` against the intended server environment. An empty list is a successful check; `Could not find the table 'public.bug_reports' in the schema cache` is not. Apply `supabase/bug-reports.sql` to that Supabase project and repeat the read-only check. The SQL is safe to rerun and preserves existing reports.

On October 23, 2026, the production project's read-only queue check returned that missing-table error while investigating a player's failed simulator report. The table setup must be applied before hosted submissions can succeed; deploying the form alone does not create it. Local database integration tests exercise the migration, server-role access, private browser roles, and repeat submissions without sending real reports.

The report form bounds diagnostics before sending, times out stalled requests after 30 seconds, and keeps the player's text and report identifier for retry. A success message requires a saved report reference from the server.

## Retention maintenance

Bug reports are retained for up to 24 months. At least monthly, an owner should run this maintenance statement in the Supabase SQL editor (or schedule the equivalent with Supabase Cron):

```sql
delete from public.bug_reports
where submitted_at < now() - interval '24 months';
```

The admin page and read-only CLI each load at most the newest 500 reports. Export or close older work regularly so the review queue stays manageable.

## Owner review

Open `/admin/bugs` and enter the bug-report admin token. The review workspace can:

- sort by priority, newest, oldest, or recent update;
- filter by product, status, and code approval;
- update priority and workflow status;
- keep private owner notes;
- explicitly approve or withdraw permission for a proposed code change;
- copy the approved queue in a Codex-ready format or download the visible list as JSON.

Priority/status changes do not approve code work. **Approve for a code change** is a separate confirmed action. Approval adds a report to the work queue; it does not edit, commit, deploy, or publish anything.

## Codex review

With the Supabase values available in `.env.local`, Codex can read the sanitized queue without an admin token:

```powershell
npm run bugs:list -- --status=open --sort=priority --format=markdown
```

To read only reports the owner approved for a proposed change:

```powershell
npm run bugs:list -- --approved --status=open --sort=priority --format=markdown
```

Useful filters include `--surface=reefbound`, `--surface=simulator`, and `--format=json`. The command is read-only. A future Codex task should summarize the approved report and intended fix before changing code, then return the change for owner review before publishing.
