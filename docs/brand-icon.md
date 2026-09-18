# Read with JEV icon

The icon extends the existing reader palette: an open paper-colored book on an ink-colored rounded square, with three separate bookmarks. The bookmarks echo the reader’s independent character tracks; they do not imply relationships or physical co-presence. The simple silhouette remains recognizable at favicon sizes.

The background uses ink (`#24303b`) and the pages use the existing panel paper (`#f7f5f1`). The bookmarks use rose (`#b64c68`), slate (`#536a85`), and green (`#578477`). These colors belong to the existing interface; this asset does not establish a new visual system.

## Assets and provenance

| Asset | Purpose |
| --- | --- |
| `app/icon.svg` | Authored vector source, with a 64 × 64 view box. |
| `app/favicon.ico` | Browser favicon containing PNG frames at 16, 32, and 48 pixels. |
| `app/apple-icon.png` | Opaque 180 × 180 touch icon. |
| `public/brand/read-with-jev-icon.png` | 512 × 512 reusable brand export. |

All raster assets are deterministic Sharp rasterizations of `app/icon.svg`, not AI-generated bitmap artwork. Keep the SVG as the source of truth and regenerate the raster exports after changing it.

## Metadata wiring and verification

Next.js automatically discovers the three files in `app/` and emits the favicon, SVG icon, and Apple touch icon links in the page head. The public brand export is available at `/brand/read-with-jev-icon.png` for explicit reuse.

The icon routes and public export returned HTTP 200, the generated head links were verified, and `npm run typecheck` passed. Final visual review found no material issues for shipping.
