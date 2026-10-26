# BART Party

A small iPhone PWA soundboard for a BART Halloween costume. Eleven buttons fit on one screen, with Stop and Loop always visible. Help, installation instructions, personal recordings, and credits are behind the **?** button.

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

For the first update from the older layout, open online to download the update, then close all instances and reopen. Later updates offer an **Update app** button. Custom recordings are stored only on the device in IndexedDB; import them inside the installed app. Removing browser data can remove them.

## Audio inventory and credits

Only user-supplied recordings and two excerpts from the supplied demo are included. No generated effects or demo speech remains.

| Button | Source |
| --- | --- |
| 10-car train — In 8 minutes | DSSAudioDemo.wav, 17.58–20.88 seconds |
| 6-car train — Platform 1 | DSSAudioDemo.wav, 20.98–24.36 seconds |
| Next station | Next_Station_AF.wav |
| North Berkeley | NorthBerkeley.wav |
| Richmond | Richmond_AF.wav |
| SFO Airport | SFO_AF.wav |
| Red line | red_line.wav |
| End of the line | EndofLine.wav |
| Loud wheels | 241915__alexbird__loud_wheels.wav |
| Train departing | 38732__shimsewn__bart-departure.wav |
| Out of service | OutofService.wav |

The seven standalone station/onboard announcements were supplied from [FOIA.fm’s BART archive](https://foia.fm/bayarea/BART/), which does not specify a reuse license. The two DSS excerpts retain the original PCM samples and have been trimmed at pauses; the source file in Downloads was left untouched. Reproduce a cut with `node scripts/trim-wav.mjs input.wav output.wav startSeconds endSeconds`.

“bart departure.wav” by **shimsewn**, [Freesound](https://freesound.org/people/shimsewn/sounds/38732/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Original recording, unchanged.

“loud_wheels.wav” by **alexbird**, [Freesound](https://freesound.org/people/alexbird/sounds/241915/). Original recording supplied by the owner, unchanged; the source license could not be verified during this update.

This is an unofficial personal costume project, with no BART affiliation or endorsement.

## File storage

GitHub stores exact base64 copies (`audio/*.wav.b64`) because the publishing connection supports text. The build decodes these to normal WAV files without a quality change. Local `.wav` files take precedence and are ignored by Git. To change a recording, update its `.b64` too. `scripts/catalog.mjs` defines the buttons. Missing audio causes a build error rather than a synthesized substitute.

The service worker caches every bundled recording and supports Safari byte-range requests offline. Browser tests cover 320×568 through 430×932 portrait screens and two landscape sizes, checking that every button is visible without scrolling and has a minimum 44-pixel touch target. Real-device iPhone installation and speaker routing should also be checked after deployment.
