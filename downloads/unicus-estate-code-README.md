# Unicus Estate — Igatpuri (full source)

A single-page concept site for an eighteen-acre hill estate above Igatpuri, Nashik.
Hand-written HTML, CSS and vanilla JavaScript. No framework, no build step, no dependencies
to install. Open `index.html` and it runs.

Live: https://swarajpatil-tech.github.io/unicus-estate/
Reel (same project, separate folder in the `motion` repo): https://swarajpatil-tech.github.io/motion/unicus-estate/

---

## What is in this folder

```
index.html          the entire site — markup, CSS and JS in one file (~84 KB, 914 lines)
assets/
  hero.jpg          hero, layered Sahyadri ridges at golden hour
  land.jpg          "the estate" split section
  valley.jpg        the enquiry section backdrop
  ridge.jpg         gallery — ridge lines, first light
  monsoon.jpg       gallery — monsoon arriving
  ghat.jpg          gallery — the road up the ghat
  forest.jpg        gallery — forest country
  falls.jpg         gallery — falls, after the rains
  village.jpg       unused spare, not referenced by the page
social-post/
  cover.jpg         the 1080x1080 Instagram cover made from this site
  preview.jpg       feed mockup of that post
```

Everything is relative-path, so the folder can be dropped anywhere: a repo, Netlify,
a plain web host, or a USB stick.

## How the page is built

- **No framework.** One `<style>` block (line ~18 to ~300), one `<script>` block at the end (line 792).
- **Fonts** load from Google Fonts (`Fraunces` for display, `Inter` for text). To go fully offline,
  download the woff2 files and swap the `<link>` for `@font-face` rules.
- **Masterplan** is inline SVG inside the HTML, not an image. 101 `<polygon class="plot">`
  elements, each carrying `data-id`, `data-size` and `data-status`.
- **Plot interaction**: hovering or tapping a plot fills the card, and the CTA builds a WhatsApp
  message with that plot number and size already written into it.
- **Reveals** are `IntersectionObserver` on `.rv` elements. No scroll libraries.
- **Lightbox** for the gallery images, keyboard-navigable (arrow keys, Escape).

## Editing it

**Colours** — top of the `<style>` block:

```css
:root{
  --ink:#0A100D;      /* page background */
  --ink-2:#0F1A15;
  --ink-3:#16241D;
  --paper:#F4F1E9;    /* text */
  --paper-2:#E8E3D7;
  --brass:#C39A5C;    /* accent, links, plot highlights */
  --sage:#9FB0A4;     /* secondary text, sold plots */
}
```

**Plots** — each one is a line like this:

```html
<polygon class="plot" data-id="A-01" data-size="2500" data-status="available"
         points="78.0,446.0 114.2,444.2 117.3,478.1 78.3,480.0">
  <title>A-01 · 2,500 sq ft · available</title>
</polygon>
```

- `data-status` accepts `available`, `reserved` or `sold`. Each has its own fill and stroke
  in the CSS at lines 150 to 154, so changing a status changes the colour and the tooltip with no
  other edit.
- Current spread: 82 available, 15 reserved, 8 sold.
- To move a plot, edit the `points` (SVG coordinates in a 1200x560 viewBox). To remove one,
  delete its `<polygon>`.

**Contact points** — search for these and replace:

- `wa.me/919529100733` — every Enquire button and the plot CTA (appears as one number, in several
  places with different prefilled text).
- `tel:+919529100733` and `tel:+919860641911` — the two numbers in the enquiry column.
- The prefilled WhatsApp text lives in each `href`, URL-encoded.

**Copy** — all of it is plain text in `index.html`: hero line, the numbers block
(18 acres / 101 plots / sizes), the four plot-size cards, the region blurbs, the enquiry form labels.

**Photos** — the eight JPEGs in `assets/` that the page uses. Same filenames, same folder, and they swap in with no
code change. These are stock images standing in for the real project; replace them with actual
site photography before this goes to the client.

## Running it locally

```bash
cd unicus-estate-code
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly by double-click also works, but a local server is closer to
production and avoids font-loading quirks in some browsers.

## Publishing it

- **GitHub Pages**: push these files to a repo, Settings → Pages → deploy from `main` / root.
  Add an empty `.nojekyll` file so folders starting with an underscore are served.
- **Netlify / Vercel**: drag the folder in. No build command, no output directory settings.
- **Your own domain**: point it at the host above; nothing in the code assumes the GitHub URL
  except the `og:image` and `og:url` meta tags at the top, which you should update.

## Before you hand this to a client

1. Replace the stock photography with the project's own images.
2. Update `og:image` and `og:url` to the final domain, or shared links preview broken.
3. Confirm the plot statuses are current, and that the phone numbers and enquiry form still point
   at the right person.
4. The enquiry form posts to WhatsApp rather than a server, so nothing is stored. If they want a CRM
   copy or an email alert, that is a small backend addition.

## Notes

- Two files in the original repo, `pages.json` and `plan.svg`, are leftovers from setup and are not
  used by the page. `pages.json` is a saved GitHub Pages API response, and the masterplan ended up
  inline in the HTML rather than as `plan.svg`. Both are left out of this folder.
- Everything here is yours. No licence, no attribution, no third-party code to satisfy.
