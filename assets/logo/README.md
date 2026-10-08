# Ripple primary logo

The main Ripple identity is **Original 1** from the approved comparison: the
rounded-square cyan, blue and purple ripple with an angular white R.

`ripple-original-1.svg` is the vector master; `ripple-original-1.png` is the
transparent native/web image used by `RippleLogo`. The original artwork paths
are preserved. Its white source canvas and metadata are removed, and the
viewBox is fitted to the mark with a little clear space.

The other drawings in this folder remain historical design alternatives.

`scripts/build-brand-assets.cjs` rebuilds the PNGs and checked-in Android
launcher and splash resources from the master. It requires `sharp`; in the
Codex desktop environment, use the bundled Node package directory as
`NODE_PATH`, then run `node scripts/build-brand-assets.cjs` from the project
root. No app runtime image dependency is needed.

Expo uses `assets/icon.png`, `assets/adaptive-icon.png`, and
`assets/favicon.png`. The transparent adaptive foreground includes extra
space for Android's launcher masks. Launcher icons use a white plate; the
in-app mark and splash artwork have transparent backgrounds.

Launcher and native splash changes take effect in a rebuilt app. Expo Go uses
its own launcher icon. The app header and startup logo update with the JS bundle.
