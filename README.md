# Yiyang He

A minimal personal website for **Art, Music, Yoyo, and Math**. Pure white background, Alegreya typography, and a full-proportion artwork viewer. Static HTML, CSS, and JavaScript; no build step.

## Preview

Open `index.html` directly, or run:

```sh
python3 -m http.server 8000
```

Visit http://localhost:8000.

## Art collections

All nine supplied images are used without cropping or changing the original files.

### Chain — 2023 · Oil painting

1. `26e20b285936433fc5c369ce31684cf2.jpg` — layered warm-coloured pentagons
2. `f559a74a88fd973ae65cc162e2b4dc96.jpg` — pentagons against horizontal colour fields
3. `c6db8a89c85645cc137d5b6b18bcd259.jpg` — blue looping line and geometric forms

### Light and Shadows — 2024 · Suzhou garden photography

1. `26d4023bc6ccc03e11168e89adf25cbb.jpg` — moon gate
2. `3b5eeac472011392854bc8b5d920d439.jpg` — bamboo shadows
3. `5e5f2b10308a973f9f79c23dd4f8e119.jpg` — branches and weathered wall
4. `c5d8d38e017adfb57ce546a6f23165b5.jpg` — trellis and garden path
5. `ff3666bb23279f08b901d65d9339c6df.jpg` — shadows on paving

### Between Order and Chaos — 2025 · Digital painting

- `f10f0858f9e37d93774d595889825f97.jpg`

Select a collection above the viewer. Use the arrow buttons or left/right keyboard arrows to browse. Click an image to open the original in a new tab. The single-work collection disables the arrow buttons.

Collections can be linked directly: `#art/chain`, `#art/light`, and `#art/order`. Other pages use `#music`, `#yoyo`, and `#math`.

Without JavaScript, all artwork and all four sections remain visible. The original `assets/` sample images are no longer used and need not be uploaded.

## Adding content

- Edit the Music, Yoyo, and Math sections in `index.html` to add recordings, videos, and mathematical notes. They intentionally contain no invented projects or achievements.
- Add artwork by copying a complete `figure.artwork` block into the gallery and setting its `data-series` to `chain`, `light`, or `order`.
- Update static image numbering, series descriptions in `script.js`, and image width/height and alt text when changing images. The interactive counter calculates its total automatically.
- Typography and layout are in `styles.css`. Alegreya loads from Google Fonts; Georgia is the offline fallback.

## Contact

- Email: dannyhe652@gmail.com
- GitHub: https://github.com/dannyhe652

## Publish on GitHub Pages

1. Create a public repository named `dannyhe652.github.io` for an account-root website, or use a project repository.
2. Upload `index.html`, `styles.css`, `script.js`, `.nojekyll`, and **all nine JPG files from the root directory**. Keep their names unchanged.
3. Under **Settings → Pages**, choose **Deploy from a branch → main → / (root)**.
4. After deployment, the account-root website will be available at https://dannyhe652.github.io. A project repository uses https://dannyhe652.github.io/REPOSITORY-NAME/ instead.

No private information was researched; the site uses only the identity and contact details supplied for publication.
