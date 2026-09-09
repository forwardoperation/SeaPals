# Simulator V2 analytics

The public report lives at `/simulator-v2/analytics`. It is linked from the v2 match setup and the site footer. Human and AI views select opposite participants from the same completed matches; difficulty always describes the AI. Filters cover the selected participant's deck, AI difficulty, and completion date. CSV exports contain aggregate data.

## Enable collection

1. Apply `supabase/simulator-analytics.sql` to the site's existing Supabase project. This adds two server-only tables and the `submit_simulator_analytics` function. The migration is transactional and can be run again.
2. Use the existing server configuration: `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Optionally set `SIMULATOR_ANALYTICS_RATE_LIMIT_SECRET` to a separate server secret; the service-role key is the fallback for HMAC quota hashes. Never expose either secret with a `NEXT_PUBLIC_` prefix.
3. Build and deploy through the site's normal release process. A missing migration or unavailable database produces an explicit unavailable state, not an empty report claiming zero games.
4. Finish a new standard Simulator V2 match and verify the report appears in both tabs with complementary results. Changing difficulty should move the same game into the matching AI difficulty filter.

No migration or deployment is performed by adding these files. Historical games cannot be reconstructed because earlier versions did not retain these counters. Resumed games from before instrumentation are excluded rather than reported as complete games with missing first-half data.

## Data flow

`Simulator.jsx` instruments the shared gameplay component only when `previewExperience` is enabled and neither story nor tutorial mode is active. Card/ability/damage hooks record committed effects rather than interpreting display logs or counting render passes. Numeric metadata travels through AI preview results and is counted when the result commits. The collector retains its match ID and counters in the existing resume checkpoint.

On completion, the browser queues an anonymous summary and sends it to `POST /api/simulator/analytics`. The database enforces one report per match UUID; repeated uploads do not change wins or consume another quota slot. Temporary failures remain queued for later retry. Browser-storage failures must never interrupt gameplay.

The API validates and reconstructs a canonical report from allowlisted fields. Reports contain catalog card/deck IDs, source ability names, difficulty, timing, outcome, rounds, starting deck inventory, counters, and metric coverage. Names, account IDs, replay logs, arbitrary ability text, and custom deck names are not retained. Local continuation state is removed before upload.

`GET /api/simulator/analytics` returns combined statistics only. Database tables are denied to anonymous and authenticated browser roles. The submission function is callable only by the service role. Origin and payload-size checks run before storage. Hourly submission limits use separate daily rotating HMAC hashes, without a match join key or raw IP storage. Expired quota rows are removed during subsequent submissions.

## Interpretation

| Metric | Definition |
| --- | --- |
| Games / wins / win rate | One selected participant per completed match. Win rate is wins divided by games, including draws. |
| Card plays | Committed plays, including setup foundations, upgrades, supports, and habitats. Drawing or inspecting a card is not a play. |
| Per game | Uses divided by selected games with that counter tracked, including zero-use games. |
| Per deck game | Uses divided by games containing an eligible source card in the starting deck or recording a use. Eligibility does not mean the card was drawn or playable. |
| Share | Percentage of all recorded uses in the corresponding card/action/on-play/passive group. Local table filters do not recalculate shares. |
| Card type | Both broad card kinds and detailed categories (fish, predator, apex, etc.) are available. |
| Abilities | Combined ability-name totals and source-card breakdowns. Combined denominators count each eligible game once. Continuous passive bonuses do not have a discrete activation count. |
| RP collected | Positive RP gains after accounting for tracked committed spending. Starting RP is excluded; this is not the ending bank balance. |
| Eco Boost gained | Positive observed changes in the Eco Boost contribution to RP bank capacity, not income. |
| School Density gained | Positive observed changes in foundation density capacity, not available density or density spent. |
| Final VP | End-of-game VP, including games that the selected side lost. |
| VP lead changes | Changes between outright leaders. The first lead and temporary ties do not increment the count; a different leader after a tie does. |
| Stun applications | Successful stun applications incurred by the selected side's coral; repeated applications can count again. |
| Coral / school HP damage | HP damage incurred by that side at committed effects, limited to HP remaining before the hit. Healing and moving existing damage counters are not new damage. |
| Game duration | Elapsed time from match start to completion; includes pauses and resumed sessions. |

Every metric has `complete`, `partial`, or `unavailable` coverage. The page labels partial measurements and excludes unavailable ones from metric denominators. A dash means unknown, while zero means no observed use. Card zero-use candidates must belong to a sampled deck. Partial ability counts are observed activity, not proof that an unrecorded ability was never used. Initial ability/passive instrumentation does not cover every rules family; capacity and VP-leader observations may miss intermediate changes within a batched update.

Recorded passive families include legal per-source Photosynthesis, Eco Foundation, and Biosynthesis turn collection; resolved Toxic consumption; successful Regenerate choices; interactive healing; Jointed Structure; and Neural Network. Continuous combat modifiers and some conditional passive families remain outside the trigger counts. These rankings therefore retain partial coverage even when the tracked families are measured at their committed effects.

Reports are browser-submitted observations, not independently verified match records. Deck selection, player experience, victory targets, and AI difficulty affect comparisons. The report warns about small samples. The initial read path caps reports at the newest 10,000 matching games or 8 MiB of report data, whichever is reached first. It fetches 100 reports at a time, applies filters before the cap, and explicitly marks a truncated window with the included report count. Successful public responses can be cached for 60 seconds; errors are not cached. A database-side incremental rollup should replace this bounded scan as volume grows.

## Checks

```powershell
node --test src/lib/simulatorAnalytics.test.mjs src/app/api/simulator/analytics/route.test.mjs
node --test src/app/simulator/simulatorAnalytics*.test.mjs src/app/simulator/simulatorResumeState.test.mjs
npm.cmd run test:simulator
npm.cmd run build -- --webpack
```

Behavioral tests cover aggregation denominators, legacy catalog formats, zero-use exposure, filters, anonymous validation, API limits and failures, pagination, repeated completion, resume continuation, retry recovery, lethal/overkill damage, repeated attacks, stuns, and capacity snapshots. Visual QA can use isolated synthetic reports; never insert sample data into the production match table.
