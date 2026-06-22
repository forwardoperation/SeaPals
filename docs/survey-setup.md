# SeaPals Survey Setup

The survey form lives at `/surveys`.

## Database

Run this file in the Supabase SQL editor:

```text
supabase/survey-responses.sql
```

This creates `public.survey_responses` with private row-level security. The public
website does not read respondent names directly; server routes use the service
role key to save responses, generate aggregate summaries, and power the admin
reward tracker.

## Environment Variables

Add these to local and deployed environments:

```text
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SURVEY_ADMIN_TOKEN=choose-a-private-admin-password
```

`SURVEY_ADMIN_TOKEN` is entered on `/admin/surveys` before names and reward
statuses are shown.

## Pages

- `/surveys` - public multi-step survey with progress bar.
- `/surveys/results` - public aggregate results without respondent names.
- `/admin/surveys` - private reward tracker and CSV export.

