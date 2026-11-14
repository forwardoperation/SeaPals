# SeaRealm for iPhone and iPad

First standalone preview, built with Capacitor and Vite around the existing SeaRealm simulator. The iOS project bundles the game and artwork and does not load searealm.com. Website and app share the same rules, opponent, cards, and lesson components.

## Included

- A touch-friendly home screen, full computer-opponent simulator, and five guided lessons.
- All 206 canonical card images bundled for offline play.
- Local match checkpoints, lesson progress, settings, and a card collection.
- The Coral Garden starter collection, one welcome pack, and one discovery pack per newly completed lesson. Each pack contains three distinct cards and guarantees an unowned card when possible. Replaying a lesson cannot award another copy of its reward.
- A collection browser, card inspection, pack reveal, reduced-motion preference, and reading-speed setting.
- An iPhone/iPad Xcode project, app icon, launch artwork, and required-reason privacy declaration for Preferences.

Play opens directly without an account or parental gate. This preview has no purchases, ads, analytics transmission, online chat, or external website destinations. Parent involvement can be introduced around accounts and purchases when those features exist. This is a preview implementation, not an App Store privacy/legal approval.

## Development

Use Node 22.12+ (Node 24 is tested). From the repository root:

```sh
npm ci
npm --prefix apps/mobile ci
npm run mobile:dev
```

Build the actual offline bundle and check that every canonical card image is present:

```sh
npm run mobile:build
npm run mobile:test
npm run test:simulator
```

For automated browser checks, start `npm --prefix apps/mobile run preview -- --port 4173 --strictPort` after building, then run `npm --prefix apps/mobile run test:browser`. These tests launch an isolated headless Chrome profile at phone and tablet sizes; they do not use an existing user browser session. Google Chrome must be installed. The tests prohibit external network hosts and check for accidental API calls. Browser QA does not replace testing WKWebView and the native persistence bridge on real Apple devices.

## Build on a Mac

1. Install Xcode 26 or newer and its command-line tools. The app's deployment target is iOS/iPadOS **16.4**, matching the shared Tailwind 4 interface's browser requirements.
2. Clone/copy this whole repository, install both sets of dependencies as above, and run `npm run mobile:ios` from the root. This rebuilds the bundle and syncs it into the checked-in Xcode project and its Swift Package Manager dependencies.
3. Run `npm --prefix apps/mobile run ios:open`. In Xcode select the App target and your development Team under Signing & Capabilities. The initial bundle identifier is `com.searealm.simulator`; change it in both `capacitor.config.json` and the target if your Apple account needs a different identifier, then sync again.
4. Run on an iPhone/iPad simulator and physical devices. Check rotation, card gestures, app switching/locking, force-quit and resume, native-save failure recovery, and a fresh launch in airplane mode.
5. With Apple Developer membership, archive a Release build and upload it to your App Store Connect app. Complete the export-compliance answers, age rating, screenshots, support/privacy URLs, and TestFlight review information there.

Signing identities, provisioning profiles, and developer credentials are not stored in this repository. Windows can build/test the web bundle and generate/sync native project files, but cannot compile or sign the iOS binary.

## Cloud Mac build

The `iOS Simulator Build` GitHub Actions workflow uses a standard `macos-26` hosted Mac with Xcode. It installs the locked dependencies, runs the app and simulator checks, bundles the offline game, compiles the shared `App` scheme, and launches the native app on an iPhone and an iPad simulator. Local Apple Vision text recognition waits for the actual home screen to render and rejects captures that still show the loading message. One artifact contains the simulator `.app` as a ZIP and the Xcode build log; a smaller preview artifact contains screenshots, recognized text, and launch details. Artifacts expire after three days. Fresh hosted simulators can spend several minutes on initial iOS data migration.

It runs on relevant pushes to `main` and the initial `codex/searealm-ios-cloud` branch, or manually once the workflow is present on the default branch. Standard Mac runner compute is free while this repository is public; the workflow skips private repositories pending a billing review. Artifact storage has separate account allowances. No Apple credentials or application secrets are used by this job.

The simulator artifact cannot be installed on a physical phone or uploaded to TestFlight. The next distribution step is a signed Release archive using an Apple Developer team, provisioning, and App Store Connect access. Keep those credentials in protected CI secrets, never in source. The two launch checks and screenshots establish native startup; they do not replace full touch/gameplay, save/recovery, or physical-device testing.

References: [GitHub Mac runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

## Persistence and rewards

`src/native.mjs` hydrates a synchronous game-storage adapter before mounting React. On iOS it persists serialized writes through Capacitor Preferences (UserDefaults); the browser preview uses its own namespaced localStorage entry. Writes are serialized, coalesced when unchanged, and retained for retry on failure. The game continually saves at its existing stable checkpoints. A force-quit during an animation can resume from the previous stable checkpoint. Lessons save their completion; an interrupted lesson restarts.

This preview's collection belongs to this device. Removing the app removes the save. Cloud sync, player accounts, collection-based custom deck building, and purchases are not included. All existing practice decks remain available regardless of collected cards.

Free rewards are local game progress, **not verified purchase entitlements**. Before paid packs or physical-product redemptions, add server-validated eligibility, transaction verification, atomic/idempotent pack opening, ownership records, and account recovery. Do not import editable local inventory as paid ownership. Review the exact Apple purchase/redemption model before printing physical redemption codes.

The app's Xcode privacy manifest declares no app data collection and the UserDefaults required-reason API. Revisit that declaration, App Store disclosures, age/consent flows, and parental purchase controls whenever adding network services or SDKs. Pokémon's own controls differ across Pocket, Live, and child account types; the intended product principle is direct access to play with account/purchase controls where needed, not a blanket claim of identical compliance.

## Shared-source boundary

`SimulatorV2Experience` and `Simulator` accept an optional `appRuntime` containing storage, home navigation, accessibility preferences, and a lesson-completion callback. The website's default behavior remains intact. The app disables simulator telemetry and bug reporting, and substitutes small Vite adapters for Next's image/link APIs. Its content security policy permits local resources only. The app does not import the website layout or its Google Analytics component.

`scripts/mobile-assets.mjs` includes game images and portraits while excluding site-only pages and videos. `scripts/check-bundle.mjs` checks offline completeness and obvious analytics/server-secret leakage. The original logo is exported into native catalogs by `node apps/mobile/scripts/native-assets.mjs` (uses the repository's installed Sharp dependency).

References: [Capacitor iOS](https://capacitorjs.com/docs/ios), [Preferences and its privacy manifest](https://capacitorjs.com/docs/apis/preferences), [Tailwind browser compatibility](https://tailwindcss.com/docs/compatibility), [Pokémon Pocket account linking](https://support.pokemon.com/hc/en-us/articles/30331783530644-Pok%C3%A9mon-TCG-Pocket-Account-Link-and-Data-Transfer-FAQ), [Pokémon Live child accounts](https://support.pokemon.com/hc/en-us/articles/31174463607060-Pok%C3%A9mon-TCG-Live-Child-Account-FAQ).
