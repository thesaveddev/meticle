# Brand assets

Every Meticle Care image is generated from the client's own artwork in
`Store assets/`. Nothing here redraws the identity.

```
npm run brand:build    # rescale the supplied kit into brand/png/
npm run brand:check    # validate the two Play assets against Google's rules
npm run brand:test     # encoder round-trip tests
npm run brand:install  # copy the results into apps/mobile, apps/web, store-assets
npm run brand:review   # render the app assets under Android's real masks
```

Run them in that order. `brand:install` is what makes "the artwork in the apps
came from the supplied kit" a checkable claim rather than a memory.

## Why there is no generator drawing the logo

This directory used to contain `build.mjs`, `build-mark.mjs` and `mark.mjs`,
which rebuilt the mark as vector geometry from an old reference. They were
retired on 3 October 2026: the owner supplied the final artwork, and every
reinterpretation they produced was rejected. Keeping them meant `npm run
brand:build` could silently revert the logo to artwork nobody wanted.

The pipeline is now three files:

| File | Role |
| --- | --- |
| `build-from-supplied.mjs` | Rescales `Store assets/` into `brand/png/` |
| `install-assets.mjs` | Copies `brand/png/` into the apps and writes the SVG wrappers |
| `check-play-assets.mjs` | Validates the two Play assets against Google's published rules |

## Which source feeds which target

| Source | Targets |
| --- | --- |
| `play icon square.png` | Play icon, app icon, favicon, web icons |
| `Feature graphic.png` | Play feature graphic, social card |
| `Horizontal logo.png` | Web nav lockup |
| `Android adaptive foreground.png` | Adaptive icon, themed icon, notification glyph, web mark |
| `MeticleCare Google Play Badge.png` | Marketing, at Google's published 2:1 |

`Monochrome logo.png` and `Silhouette logo.png` are deliberately unused. Each is
a presentation sheet carrying four lockups — colour and black, horizontal and
stacked — side by side on one 1774×887 canvas. Using one would mean guessing
which quadrant to crop.

## The two rules that are easy to get backwards

**The app icon wants an alpha channel; the feature graphic must not have one.**
Play asks for "32-bit PNG (with alpha)" for the icon and "JPEG or 24-bit PNG" for
the feature graphic. A 32-bit feature graphic is a rejection. Both come out of
the same resvg render and are then re-encoded by `png.mjs`, which is the only
thing here that can emit colour type 2 — so the flattening is deliberate and
testable, not an accident of the renderer.

**An icon must carry an alpha channel but contain no transparency.** The
supplied `play icon square.png` exports fully opaque, which is correct; the
older `Meticle Care Play Icon.png` sat at alpha 252 with transparent corners and
a baked-in corner radius, none of which Play accepts. `brand:check` decodes the
file and asserts the property rather than trusting the header.

## Corner radius and the adaptive icon

Play masks and shadows icons itself, so artwork must be a full square with no
baked-in radius. Android's adaptive icon is a different constraint again: the
launcher masks a 108dp canvas down to a circle of diameter 72dp, and anything
outside that circle can be clipped away.

`build-from-supplied.mjs` scales the adaptive foreground by the furthest
*visible pixel* from the centre rather than by the content's bounding box. That
matters here because the mark is a pin — its bounding-box corners are empty
space, and scaling by the box would shrink the mark roughly a third more than
necessary. The supplied file overshoots the safe radius by 13% of the canvas.

## png.mjs

A small PNG encoder, because resvg can only write 32-bit RGBA and the two
headline Play assets need different colour types.

Scanlines are filtered adaptively, choosing per row whichever of the five
filters has the smallest sum of absolute deviations. Storing rows literally
costs about six times the file size on smooth gradients, which is most of this
brand: the app icon drops from 1305 KB to 812 KB.

`png.test.mjs` round-trips encode→decode and compares bytes, which is the only
assertion that catches a mis-indexed predictor or an aliased previous-row
buffer — both of which produce a file that still decodes, just wrongly.