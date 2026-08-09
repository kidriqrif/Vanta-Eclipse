# Testing Guide — Vanta Eclipse

What must be **proven**, staged from "does it compile at all" to "a stranger
played it". `RELEASE-CHECKLIST.md` lists what must *exist*; this lists what must
be *shown to work*. Start here.

**Where the project actually stands:** stages 0 and 1 pass. Stage 2 has never
been run — the game has never executed on Android hardware. Everything below
stage 2 is therefore unverified, and no amount of stage 1 substitutes for it.

---

## Stage 0 — the sweep

```
bash tools/validate_all.sh
```

Eight stages, every one a hard gate, and it runs all of them even after a
failure so one break cannot hide the next five. Stages 1 and 7 need Unity and
skip cleanly if `$UNITY` does not resolve; the rest are Python and always run.

| | |
|---|---|
| 1 | C# compiles — a real `Unity -batchmode` compile, not a parser |
| 2 | project invariants: palette closure, 9px glyph grid, scene/prefab/sprite names |
| 3 | font coverage — every character the UI renders exists in the face |
| 4 | generated art is on the 16-colour palette, every pixel of every PNG |
| 5 | shipped assets are byte-identical to what their generators produce |
| 6 | README and the published site match the code |
| 7 | runtime logic — 49 assertions against the real managers |
| 8 | **every screen rendered at 10 Android shapes** |

Stage 8 is the only one that looks at pixels. Everything above it compares
files to other files.

## Stage 1 — screens, headless

```
bash tools/screenshots.sh                     all 11 screens x 10 shapes
bash tools/screenshots.sh MainMenu,Gameplay   named screens only
SHAPES=1080x1920_9-16 bash tools/screenshots.sh Gear
```

Renders each screen in **play mode** — so `Awake`/`Start` run, the managers
boot, and the screens populate themselves — into a RenderTexture at each shape,
then measures four things: a blank frame, content outside the frame, layout rows
collapsed to zero height or overlapping, and glyph box / device pixels. PNGs and
`report.csv` land in `build/screenshots/`.

**Open the images.** The exit code is a gate, not a verdict: every piece of art
and text this project got wrong looked correct in source, and three separate
checks once passed a main-menu tagline that had silently lost both its periods.

Two flags are deliberately absent from the Unity invocation inside that script
and both get "helpfully" added back — `-nographics` gives a null graphics device
and every capture comes back empty, and `-quit` closes the editor before play
mode has started.

**What it cannot see:** a real GPU driver, touch, audio hardware, memory
pressure, frame pacing, or install. `Screen.safeArea` on desktop is the whole
screen, so the display-cutout inset that `SafeAreaFitter` exists for is not
exercised.

## Stage 2 — first run on hardware  ⟵ **never done**

```
bash tools/build_android.sh debug
adb install -r build/vanta-eclipse.apk
adb logcat -c && adb logcat -s Unity
```

The build script verifies the artifact rather than trusting the exit code:
`apksigner` confirms the signature scheme, `aapt2 dump badging` prints the
package, SDK levels, permissions and native code, and the run **fails** if there
is no launchable activity. That last check exists because an APK once shipped
with no launcher activity at all — it installed and could not be started.

What to establish, in order:

1. It launches, and the main menu draws.
2. Every screen opens and comes back. Eleven screens, one tap each.
3. Text is legible at arm's length on a real panel, not a monitor.
4. Taps land where they look like they land. The tap targets are 72px on the
   9px grid for a reason (`accessibility-requirements.md` §4B).
5. Haptics fire. `AndroidHaptics` goes through the Vibrator service directly,
   which is why `VIBRATE` is declared by hand in
   `Assets/Plugins/Android/AndroidManifest.xml` — Unity cannot see an
   `AndroidJavaObject` call and will not inject the permission for one.
6. Audio plays, and does not clip or pop on a phone speaker.
7. A shader that compiles on desktop can still fail on a mobile GPU. Look at
   the enemy rim light and the ground glow specifically.
8. Frame pacing and battery over a ten-minute session.

**Save file on device:** `/sdcard/Android/data/com.kidriqrif.vantaeclipse/files/`
— `savegame.json` and `savegame.backup.json`.

> **Resetting a save means deleting BOTH files.** `SaveManager` writes
> atomically through the backup slot and falls back to it when the main file is
> missing, so removing only `savegame.json` restores the backup on next launch —
> a "reset" that comes back at level 60 with 20 boss cards.

## Stage 3 — the run that matters

One uninterrupted session from a fresh save, on the device, without touching
the editor:

- Reach level 15 and unlock the auto-attacker.
- Lose a boss fight on the timer, farm the gate, win it.
- Equip something, salvage something, forge something.
- Play all four arcade boards to a win and a loss.
- Trigger an Eclipse and spend Void Crystals.
- Close the app for an hour. Come back. Check the offline reward against what
  the idle rate says it should be.

Then kill the app mid-write (`adb shell am force-stop`) during an autosave and
confirm the next launch loads rather than starting over.

## Stage 4 — internal testing

Upload the AAB to Play's Internal Testing track and install it **from Play**,
not from `adb`. That is the first time the artifact is exercised as Play
delivers it: split by ABI, re-signed with the app signing key, and installed by
the store rather than sideloaded.

Check that the store listing's screenshots match what the app actually looks
like on the device it was installed on.

## Stage 5 — closed testing

If the developer account is a personal one created after 2023-11-13, Play
requires **12 testers for 14 continuous days** before production access is
granted. That is a two-week gate rather than a form, and it belongs on the
calendar before a launch date is chosen.

---

## What has no test yet

- **Localisation.** Every string is inline English.
- **Analytics.** Every economy number was tuned by simulation against a *model*
  of a player, never against a real one.
- **Cloud saves.** `SaveManager.GetFullSaveText()` already returns exactly the
  document a provider would upload; nothing uploads it.
- **Landscape.** The app is portrait-locked with no landscape layout, and
  Android 16 ignores `screenOrientation` on displays 600dp and wider. A tablet,
  an unfolded foldable, or any phone in split-screen will show it in landscape
  regardless. Nothing is cropped — content strands, and the width cap in
  `SafeAreaFitter` is what stops it.
