# BART Party

A small iPhone PWA soundboard for a BART Halloween costume. Eight buttons fit in two columns and four rows on one screen, with Stop and Loop always visible. Help, installation instructions, personal recordings, and credits are behind the **i** button.

The interface takes inspiration from BART station signage: navy panels, bold white transport pictograms, square route badges, and restrained red, yellow, and sky-blue accents. Route letters distinguish the red and yellow announcements; the approaching train shows its platform number.

## Run locally

Node.js 22 or newer; no dependencies or environment variables required.

```sh
npm run build
npm start
```

Open http://localhost:4173. `npm test` checks the bundled recordings and offline audio byte ranges. The optional `scripts/smoke.mjs` uses Playwright and Chrome for playback, persistence, offline, and viewport tests.

## Deploy and install

Import this repository into Vercel with framework **Other**. `vercel.json` sets build command `npm run build` and output directory `dist`.

On iPhone, open the HTTPS link in Safari → Share → Add to Home Screen. Keep **Open as Web App** enabled if shown. Open the new icon while online and wait for **Saved for offline**, then test a sound in airplane mode. Use the phone volume buttons or pair a Bluetooth speaker. Keep the app visible while playing.

Updates automatically activate after the entire new release has been cached, then reload existing app tabs. This also migrates the original cache-first release, which could otherwise keep showing the old UI indefinitely. If a browser is still stuck, open `/refresh.html` while online. It refreshes this app's service worker and offline cache without deleting personal recordings. Custom recordings are stored only on the device in IndexedDB; import them inside the installed app. Removing browser data can remove them.

The bottom row contains **Loud wheels** and **Train departing**. The standalone Richmond and End of the line buttons have been removed.

## Audio inventory and credits

Only user-supplied recordings and two excerpts from the supplied demo are included. No generated effects or demo speech remains.

| Button | Source |
| --- | --- |
| 10 car Milbrae — In 8 minutes | DSSAudioDemo.wav, 17.58–20.88 seconds |
| Richmond train — Platform 1 | DSSAudioDemo.wav, 20.98–24.36 seconds |
| Next station | Next_Station_AF.wav |
| SFO Airport | SFO_AF.wav |
| Red line — North Berkeley | red_line.wav followed by NorthBerkeley.wav, joined into RedLineNorthBerkeley.wav |
| Loud wheels | 241915__alexbird__loud_wheels.wav |
| Train departing | 38732__shimsewn__bart-departure.wav |
| Out of service | OutofService.wav |

The original standalone station/onboard announcements were supplied from [FOIA.fm’s BART archive](https://foia.fm/bayarea/BART/), which does not specify a reuse license. The two DSS announcement clips are from the BART.gov blog (source attribution supplied by the owner). The two DSS source excerpts retain the original PCM samples and have been trimmed at pauses; the source file in Downloads was left untouched. Reproduce a cut with `node scripts/trim-wav.mjs input.wav output.wav startSeconds endSeconds`.

The red-line/North Berkeley button concatenates the original PCM recordings, removing excess silence only at the join. It is 3.262 seconds long. Reproduce it with `node scripts/combine-wav.mjs audio/red_line.wav audio/NorthBerkeley.wav audio/RedLineNorthBerkeley.wav`.

“bart departure.wav” by **shimsewn**, [Freesound](https://freesound.org/people/shimsewn/sounds/38732/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Original source preserved; playback copy volume balanced.

“loud_wheels.wav” by **alexbird**, [Freesound](https://freesound.org/people/alexbird/sounds/241915/). Original recording supplied by the owner, unchanged; the source license could not be verified during this update.

This is an unofficial personal costume project, with no BART affiliation or endorsement.

## File storage

GitHub stores exact base64 copies (`audio/*.wav.b64`) because the publishing connection supports text. The build decodes these to normal WAV files without a quality change. Local `.wav` files take precedence and are ignored by Git. To change a recording, update its `.b64` too. `scripts/catalog.mjs` defines the buttons. Missing audio causes a build error rather than a synthesized substitute.

The service worker caches every bundled recording and supports Safari byte-range requests offline. Browser tests cover 320×568 through 430×932 portrait screens and two landscape sizes, checking that every button is visible without scrolling and has a minimum 44-pixel touch target. `scripts/upgrade-smoke.mjs` reproduces a stale Chrome page with the original caching behavior, verifies automatic migration to the new app, then checks recovery preserves personal recordings and offline playback. Real-device iPhone installation and speaker routing should also be checked after deployment.

## Volume balancing

The build adjusts each bundled recording with constant gain toward -18 dBFS active RMS, leaving at least 1 dB of sample-peak headroom. Measurement uses 50 ms windows and excludes windows more than 20 dB below the loudest window so silence does not cause over-amplification. Original WAV/base64 files stay untouched; exported playback copies retain their format and dynamics. The first second of leading silence is removed from Next station and SFO Airport, leaving approximately 34 ms before speech starts. This reduces level differences but is not a guarantee of identical perceived loudness between speech and train noise. Custom recordings are played as imported.
