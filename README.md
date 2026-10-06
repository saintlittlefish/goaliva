# Goaliva

Cross-platform soccer practice tracking for Android and iPhone. Train Bright. Play Right.

## Run the development app

1. Install dependencies with `npm install`.
2. With a compatible Goaliva development build installed, run `npx expo start --dev-client -c`.
3. Press `a` for a running Android emulator, or connect the development build on your phone to the displayed server.
4. To create the Android development build, use `npx expo run:android` with a connected phone/emulator. iOS native builds require macOS and Xcode.

An installed standalone release does not load source changes from Metro; build a new signed release in Android Studio to test those changes in an APK/AAB.

## Training experience

- Fixed, large Miss/Success controls; every success counts as one attempt.
- Exact Undo for an individual tap or an entire recorded set.
- Optional set-result entry, expandable instructions/scoring, and confirmed skill-only reset.
- Compact skill completion sheets; no automatic advance without player action.
- Session notes at final completion or through More during practice.
- Automatic local draft checkpoints, explicit Save & exit/Discard, and Resume on Home.
- A measured session timer that continues through normal phone locking/backgrounding and stops with explicit Pause. Recovery after a force-quit resumes from the last saved checkpoint; time while the process was dead is not fabricated.
- Completion saves history before removing the recovery draft. Stored run IDs prevent a stale draft from creating a duplicate completed session.

## Templates, skills, and preferences

- Searchable personal and suggested templates, ordered by position relevance.
- Template option menus for edit, copy, and confirmed deletion; history is retained.
- Reorder drills with accessible earlier/later controls; targets and scoring stay attached to skills.
- A single fixed Save action and unsaved-change prompts.
- Direct custom-skill creation with optional description; shared create/edit form in the skill library.
- Scoring range previews and a sample-result calculator. Original scoring bands are unchanged.
- Optional onboarding starts with position; profile changes are saved explicitly. Theme changes are explicitly instant-save.
- Five theme options, with Alpine Green as default, using the chosen color palette/gradient roles throughout.

## Reports and data

- 7/30/90-day and all-time history; undated legacy history remains available in All time.
- Accuracy uses recorded attempt counts when available; legacy session averages are clearly identified.
- Actual measured time is kept separately from planned template duration. Legacy planned minutes are not presented as measured training.
- Skill charts default to Accuracy, with Points and template filters available below the chart.
- Practice suggestions use recorded results and eligible position skills; sparse data produces an explained position-based suggestion, not an invented weakness.

Profiles, templates, skills, completed sessions, and unfinished practice are stored locally using AsyncStorage. This is not cloud backup; uninstalling/clearing app data can remove it.

## Verification

Run `npm run typecheck` and `npm test`. The suite includes pure scoring/report tests and React screen-interaction tests with mocked native/storage interfaces, so it does not change any phone's training history. The development-only React renderer emits its known deprecation warning; it is not included in the app bundle.

Device acceptance checks: verify fixed logging controls on a small screen, rapid taps, Undo, set entry with the keyboard open, phone lock/unlock, pause/resume, exit/restart recovery, completion summaries, template reorder/save/cancel, profile save/cancel, all five themes, and chart dragging versus vertical scrolling. Automated component checks do not replace device layout/gesture testing.

Known tooling caveat: npm audit currently reports 24 dependency advisories (17 high, 7 moderate), largely in the Expo/toolchain dependency graph. No automatic SDK downgrade or `npm audit fix --force` was applied as part of the UX work; review compatible dependency updates separately.

## GitHub backup and restore

The repository backs up source, native Android project files, package lockfile, design/store assets, tests, and privacy-site documents. It intentionally excludes dependencies, Metro/IDE caches, build outputs, local configuration, environment files, and all signing keystores. No app-installed training data is uploaded by a Git source backup.

After cloning, run `npm install`. Restore Android SDK configuration locally in Android Studio. The ignored `android/app/debug.keystore` must also be restored or recreated for debug builds. One development-only example, using Android's standard public debug credentials, is:

```sh
keytool -genkeypair -keystore android/app/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
```

Do not use this debug key for production. Keep a separate secure/encrypted backup of `keys/goaliva-upload.jks`, its alias, and passwords; they are not recoverable from GitHub. Release signing should use your upload key through Android Studio's signed-bundle workflow, not the generated project's default debug signing configuration.
