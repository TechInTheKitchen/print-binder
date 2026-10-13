# Print Binder

Arrange PDF and OpenDocument Text (ODT) pages into printable grids and folded booklets, entirely in your browser. Download the arranged sheets and print one output page per side at actual size.

Print Binder runs on static hosting, including GitHub Pages. It needs no backend, account, API key, or document upload service.

## Features

- **PDF and ODT input** with PDF or ODT downloads.
- **Full-sheet covers:** separate PDF/ODT or image uploads with printer margins, bleed, and trim marks for ink to the finished edge.
- **Custom grids:** 1–16 rows and columns, row/column/zigzag ordering, reversal, alignment, rotation, and page scaling.
- **Folded booklets:** two columns with configurable rows, front/back ordering, and blank-page padding.
- **Passport booklets:** landscape inner pages paired vertically, with a horizontal fold and a separate portrait cover.
- **Paper sizes:** Letter, Legal, Tabloid, A4, A3, or custom dimensions.
- **Margin detection:** optional trimming of blank source-page edges, adjustable padding, and shared crops for consistent sizing.
- **Text-size estimates:** warnings below a configurable threshold, defaulting to 6 pt.
- **Print guides:** optional cutting boundaries and staple marks on either grid-page edge or the booklet fold seam.
- **Edge-to-edge tiles:** joins neighboring pages without gaps, even at reduced size, for embedded cover artwork.
- **Responsive preview:** fits the desktop window and stays visible while scrolling settings; stacked layout on mobile.
- Light and dark themes, page-range selection, and an eight-page sample.

## Run locally

Use Node.js 22.12 or newer. Vite also supports Node.js 20.19 or newer.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite, usually `http://127.0.0.1:5173/`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm test` | Check page ordering, layout geometry, margins, readability, and staple positions |
| `npm run build` | Build the static site into `dist/` |
| `npm run preview` | Serve the production build locally |

Browser integration checks are in `tests/browser.mjs`, `tests/odt-browser.mjs`, and `tests/margins-browser.mjs`. Run them with `node` while the development server is running. They currently use the Windows Chrome installation path; adjust `executablePath` for a different system. Generated documents and screenshots go into ignored `tmp/` folders.

## Publish on GitHub Pages

1. Push the source files, including `.github/workflows/pages.yml`, to `main`.
2. Open the repository **Settings → Pages**. Under **Build and deployment → Source**, select **GitHub Actions**. Do not select **Deploy from a branch**: that publishes the source HTML without building the JavaScript and CSS.
3. Keep the custom domain set to `print-binder.the-kitchen.dev` in Pages settings. `public/CNAME` is copied into the build; it does not configure the repository domain setting itself.
4. Open **Actions → Deploy static app → Run workflow**, choose `main`, and run it after switching the publishing source. Future pushes to `main` build and deploy automatically.

The workflow installs dependencies, runs the unit tests, builds with Vite, and publishes only `dist/`. Relative asset URLs work both on the custom domain and under a GitHub Pages repository path. For other static hosts, run `npm ci` and `npm run build`, then upload the contents of `dist/`.

If the page looks like plain HTML, inspect the deployed page source: a working deployment links to `./assets/index-....js` and `./assets/index-....css`. A `/src/app.js` script means the unbuilt repository root was published. Switch Pages to GitHub Actions and rerun **Deploy static app**; avoid competing branch-based Pages deployments.

## Use the app

1. Choose a `.pdf` or `.odt` file, or open the sample.
2. Choose **Grid** or **Booklet**, paper size, orientation, rows, columns, margins, and gaps.
3. Optionally select pages with ranges such as `1-8, 12, 15-20`. Ranges retain their entered order; repeated pages are allowed.
4. Review the preview, margin trimming, and text-size warnings. Optional staple marks and cutting boundaries are printed in the output.
5. Download PDF or ODT. In the print dialog, use the matching physical paper size, **100% / actual size**, and one output page per printed side.

The app arranges the file's pages; the printer still controls paper trays, hardware margins, duplex support, and print-dialog scaling.

### Grid and booklet ordering

**Grid** fills cells across rows by default. Customize placement to fill down columns or in a zigzag, reverse the source order, align pages, rotate them, or adjust their scale. This is suitable for cutting mini-pages apart or binding them along an edge.

**Booklet** uses two columns. The default two-row, eight-page layout is:

| Position | Front | Back |
| --- | --- | --- |
| Top left | 8 | 2 |
| Top right | 1 | 7 |
| Bottom left | 6 | 4 |
| Bottom right | 3 | 5 |

Cut the rows apart, fold each pair, and nest the pairs in reading order. Use one row for an uncut center-fold booklet. Blank cells complete whole duplex sheets: four source pages per row.

For this booklet layout, use a long-edge duplex flip on portrait paper or a short-edge flip on landscape paper. Test one sheet first because printer feed direction varies. Large folded stacks may be too thick; separate booklet signatures are not currently supported.

### Passport booklets

Choose **Passport booklet** for two landscape inner pages on each portrait sheet. Both pages retain their original orientation on every side. Passport only arranges pages in booklet order; it does not invert or rotate the artwork. Bind or staple along the horizontal seam between the two pages. For eight source pages, the sheets are front 8/1, back 2/7, then front 6/3, back 4/5 (top/bottom). Print duplex with a short-edge flip on portrait paper, fold the sheets, and nest them. Multiple columns create separate pairs; cut columns apart before folding. Staple marks follow the horizontal seam.

Passport forms one signature from the selected pages, with the first and last pages on the outside. It does not pad an even page count with bound blank pages: an extra pair becomes a single double-sided center leaf. Cut away the unused half of that column, and any completely empty columns on the final sheet. An odd page count necessarily leaves one blank reverse in the signature. **Keep original page size (shrink only)** preserves landscape A6 artwork size when it fits. A separately uploaded cover remains a portrait sheet with its own trim marks and bleed; trim and bind it separately. **Cover sheet orientation** can also be changed independently in other layouts. PDF and ODT downloads preserve each output sheet's dimensions when cover and body orientations differ. The passport layout changes page arrangement and orientation; it does not reflow the source document into a new page shape.

### Source margins and readability

**Join pages edge to edge · no gaps** packs the page tiles together and centers the group on the paper. It overrides row/column gaps and per-page alignment, keeping unused space outside the group rather than at the seams. Matching source pages keep their proportions and selected scale; Passport can retain original A6 size. Different page shapes are cropped around the center to fill matching tiles, with a warning. Source artwork containing white margins still needs source-margin trimming if those margins should be removed. Outer printer margins and the separate uploaded-cover settings are retained. Cutting guides and staple marks follow the packed tiles.

Margin trimming is enabled by default. It detects near-white outer edges, keeps visible content, and adds 0.06 in of padding. Selected pages of the same size share a crop by default, maintaining consistent text scaling. Disable the shared crop to fit each page independently, or turn trimming off to preserve original margins. Blank pages stay full size.

Scan noise, colored backgrounds, or marks near the edges can prevent trimming. Very faint marks may be missed. Trimming removes outer blank space; it does not remove gaps within the content. Review the preview before printing.

The text-size check estimates font sizes after placement and warns below **6 pt** by default; the threshold is adjustable from 4–24 pt. It does not perform OCR or guarantee readability. Scans, outlined text, and image-only pages cannot be checked. Image text within otherwise measurable pages is also not analyzed.

### Staple marks

Grid pages can have left- or right-edge marks, 0.125 in inside the displayed mini-page edge. Booklets place marks along each row's inside fold seam, matching on front and back. Two small crosses sit at one-third and two-thirds of the page or row height. Preview, PDF, and ODT output use the same marks.

### Full-sheet cover

Expand **Optional cover · print and trim** to upload a one- or two-page PDF/ODT or a PNG, JPEG, or WebP image. Cover sides appear before the body pages. Artwork fills an inset printable area with trim marks outside it. The default printer margin is 0.25 in and bleed is 0.125 in beyond each cut. Another 0.125 in inside the printer margin holds the cut marks. Both settings are adjustable in the current units, independently of the body margins. Different proportions crop the artwork evenly around its center. No body grid or staple marks appear on the cover.

A two-page document supplies the cover front and reverse. A single page receives a blank reverse by default. Booklet mode always reserves that reverse so the body retains its front/back sequence; Grid mode allows disabling it. PDF cover content stays vector-based in PDF downloads. Image covers and ODT output use raster images. Cover uploads have a 50 MB limit; images are limited to 40 megapixels.

Print at actual size (100%), then cut along the trim marks to remove the white border and bleed. Artwork continues beyond the cuts, so the finished edges contain ink on a printer without borderless support. Keep essential text inside the cuts. Letter paper with the defaults produces a 7.50 × 10.00 in finished cover. Use larger paper if the finished size needs to match a larger body, and increase the printer margin if your printer clips the artwork or marks. Body pages are not resized by these cover settings.

## Formats and limitations

| Format | Behavior |
| --- | --- |
| PDF input → PDF output | Preserves vector page content, including text and lines; respects crop boxes, page rotations, and mixed page sizes |
| ODT input | Reads OpenDocument XML directly, including basic styles, tables, embedded images, page sizes, saved page breaks, and headers/footers; renders pages at 144 dpi |
| ODT output | Contains fixed sheet images at 144 dpi; text is not editable |
| ODT input → PDF output | Uses the rendered page images rather than vector text |

- ODT fonts and advanced office features may render differently from LibreOffice. Embedded objects, notes, text boxes, and unsupported images can be omitted or reflowed, with warnings. Use a PDF export when exact office rendering is essential.
- PDF output does not transfer interactive annotations, links, form widgets, signatures, or bookmarks. Flatten required annotation and form appearances in the source first.
- Password-protected documents are not supported. DOCX input and output are not supported.
- Limits: 50 MB input, 500 rendered ODT pages, 10,000 selected page occurrences, 1–16 grid rows/columns, and paper dimensions from 1–48 inches. Browser memory may impose lower practical limits.
- Sheet coverage measures placed page rectangles, including their internal white space; it does not measure ink coverage.

## Privacy

Documents are processed in memory on your device. The app does not upload document data, load external document images, or execute document scripts. Dependencies are bundled with the site rather than fetched from a runtime CDN. The hosting provider receives ordinary requests for site assets.

## Project layout

- `src/app.js`: controls and preview coordination.
- `src/layout.js`: page selection, grid placement, and booklet order.
- `src/pdf.js`: PDF reading, preview rendering, and PDF export.
- `src/odt.js` and `src/document-pages.js`: ODT reading, pagination, and ODT export.
- `src/margins.js`, `src/readability.js`, and `src/staples.js`: margin detection, text estimates, and print marks.
- `public/`: the matching book favicon.
- `tests/`: unit and browser checks.

## License and acknowledgments

Print Binder is available under the [MIT License](LICENSE).

Dependencies retain their own licenses: [pdf-lib](https://github.com/Hopding/pdf-lib), [PDF.js](https://github.com/mozilla/pdf.js), [html-to-image](https://github.com/bubkoo/html-to-image), and [JSZip](https://github.com/Stuk/jszip). See their distributed license files. ODT support uses the [OASIS OpenDocument schema](https://docs.oasis-open.org/office/OpenDocument/v1.3/OpenDocument-v1.3-part3-schema.html).

The parchment and dusk palette and serif styling were inspired by Stars, Stones & Salt Tarot.
