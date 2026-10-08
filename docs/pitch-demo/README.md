# Ripple pitch demo kit

Created 3 October 2026.

## Deliverables

- **Ripple-Pitch-Demo-1080p.mp4** — 52.1-second widescreen feature film, 1920 × 1080, 30 fps, H.264 video with an original ambient stereo soundtrack.
- **Ripple-Pitch-Demo-Silent-1080p.mp4** — the same picture edit without audio, for live pitch narration.
- **feature-images/** — four matching landscape promotional PNGs: unified signals, disclosed trades, shared timeline, and personal watchlist. Native generated resolution is 1672 × 941; use proportionally without stretching.
- **index.html** — local video player and feature-image gallery.
- **source/** — editable render script, scene manifest, creative brief, and screenshot-edit prompts.

## Presentation guidance

Insert the MP4 as a local video into a 16:9 slide and fit it to the slide. Use the silent version while speaking. Keep the image proportions intact when placing feature graphics on slides. The video uses generous title sizes and dark backgrounds for a controlled, premium presentation environment.

The soundtrack is an original, procedurally synthesized ambient composition created for this demo. There is no third-party music sample or stock music track. There is no voice-over; the story is communicated through on-screen copy.

## Feature sequence

| Approximate start | Sequence | What it demonstrates |
| --- | --- | --- |
| 00:00 | Brand opening | Public disclosures and market context |
| 00:05 | Unified signals | Congress, insiders, policy, and stocks in one feed |
| 00:14 | Disclosed trades | Transaction details, price reaction, source links |
| 00:22 | Shared timeline | Source activity on a common time axis |
| 00:31 | Follow flow | Choose a source, then add a subject |
| 00:38 | Personal watchlist | People, companies, and policy topics |
| 00:47 | Brand close | Public records, a clearer perspective |

## Content provenance

The video is an animated feature walkthrough assembled from the project's existing app screenshots, rather than a live screen recording. Original screenshot pixels are scaled/cropped in the video; UI labels and data are not rewritten. The follow-flow transition sequences two captured app states. Camera motion and transitions are presentation effects.

The four separate feature graphics were created with the built-in image-generation editor, using those screenshots and the approved Ripple logo as references. They are styled promotional mockups; use the original captures or the video when exact pixel fidelity matters. Generated layouts can differ in small UI details.

Source captures: `docs/demo-screenshots/06-feed-personal.png`, `08-trades-table.png`, `11-timeline-90d.png`, `02-add-choose-source.png`, `04-add-member-added.png`, and `13-watchlist.png`. Logo: `assets/logo/ripple-original-1.png`.

The captured data is illustrative of the interface at capture time, not a current quote feed. The video showcases existing product screens and does not claim predictive performance, verified provider entitlements, or production readiness.

## Rebuilding

The render script requires Node.js, Sharp, and FFmpeg. Set `NODE_PATH` to a package directory containing Sharp if it is not installed locally, then run `node docs/pitch-demo/source/render-demo.cjs` from the repository root. The script uses FFmpeg 9's `-/filter_complex` file syntax. It does not change app code or configuration.

Intermediates and original generated soundtrack are retained in `work/` for future edits. The shareable ZIP excludes these intermediates.
