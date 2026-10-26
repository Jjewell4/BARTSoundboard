# BART Party

A small iPhone PWA soundboard for a BART Halloween costume. No accounts, backend, framework, or runtime dependencies.

## Preview

Requires Node.js 22 or newer:

```sh
npm run build
npm start
```

Open http://localhost:4173. The build uses the recordings in `audio/`, creates three original train effect recreations, generates PNG app icons, and writes the website to `dist/`.

## Deploy on Vercel

Push this folder to a GitHub repository, including the `.wav.b64` files in `audio/`. Import that repository into Vercel. The included `vercel.json` sets the build command to `npm run build` and output directory to `dist`. No environment variables are needed. Choose **Other** if asked for a framework preset. Alternatively, run the Vercel CLI from this folder.

The deployed HTTPS URL is needed to install the PWA on an iPhone. A local HTTP address on another computer does not provide full PWA support.

## Add to her iPhone

1. Open the deployed link in Safari.
2. Tap Share → Add to Home Screen → Add. Keep “Open as Web App” enabled if offered.
3. Open the new icon while online and wait for **Saved for offline**.
4. Turn on airplane mode and test a sound before heading out.

Tap a sound to play; tap it again to stop. A different button replaces the current sound. **Stop** silences playback and **Loop** repeats. Adjust volume with the phone’s buttons. Playback stops when the app is hidden. For a Bluetooth speaker, pair it in iPhone settings first.

The guide inside the app lets you replace any button with a file from the phone. Custom audio is saved in IndexedDB on that device, not uploaded. Import it inside the installed app: Safari and a Home Screen app may have separate storage. Browser data removal or storage eviction can remove offline files and personal recordings.

## Recordings

Six user-selected WAV files from [FOIA.fm’s BART archive](https://foia.fm/bayarea/BART/) are included. The repository stores exact base64 copies (`.wav.b64`) because the GitHub publishing connection supports text files. The build decodes them to normal WAV files with no quality change. Local `.wav` files take precedence and are ignored by Git:

| File | Button |
| --- | --- |
| Next_Station_AF.wav | Next station |
| Richmond_AF.wav | Richmond |
| SFO_AF.wav | SFO Airport |
| EndofLine.wav | End of the line |
| red_line.wav | Red line intro (an intentionally incomplete destination phrase) |
| OutofService.wav | Out of service |

The long `ALD_AF.wav` recording was removed at the user’s request and is not included. The archive is a third-party collection of BART agency audio and does not state a reuse license. No affiliation with or endorsement by BART is implied.

Door beeps, horn, and tunnel noise are original synthesized approximations, not authentic BART recordings. They are labeled **Recreated effect** in the app. Source generation is in `scripts/effects.mjs`.

For authentic train effects, [“BART ride” by elemkr](https://freesound.org/people/elemkr/sounds/258155/) includes announcements, arrivals, departures, and doors. It is [CC BY-NC 3.0](https://creativecommons.org/licenses/by-nc/3.0/), requires attribution for reuse, and requires a free Freesound login to download. It is not bundled here. A short edited excerpt can be imported in the app; retain the author credit if sharing it.

To change the bundled buttons, edit `scripts/catalog.mjs` and add the matching files in `audio/`. The production build attempts to download missing catalog recordings from the archive and fails explicitly if unavailable. `npm run build:demo` substitutes labeled browser speech for missing recordings; demo voices are not guaranteed offline. The current production build has no demo voices.

## Verification

```sh
npm run build
npm test
```

The tests check the real audio inventory and service worker byte-range responses used by Safari. Optional `node scripts/smoke.mjs` browser checks require Playwright and Chrome (or set `PLAYWRIGHT_MODULE` to an existing Playwright installation). Start the preview server first. These cover playback, switching, stop, loop, custom file persistence, restoring originals, offline reload and playback, and mobile overflow. Screenshots go in `test-results/`.

Desktop Chromium checks are automated; a real iPhone/Safari check is still needed for hardware volume, speaker routing, installation, and audio behavior on the target phone.

Service worker caches are versioned using the app’s content hash. After an update, close all open instances of the app and reopen it online to activate the new cache.
