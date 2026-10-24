# Yiyang He

A minimal personal website for **Art, Music, Yoyo, and Math**. Pure white background, Josefin Sans for large text paired with Alegreya for smaller text, and a full-proportion artwork viewer. Static HTML, CSS, and JavaScript; no build step.

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

## Publishing studio

A private local app lets you write posts, upload photos, preview, and publish without editing the website's HTML. It matches the website's typography and white layout.

### Start the app

Requires **Python 3.9+** and **Git**, with no packages to install. From this folder:

```sh
python3 studio/server.py
```

The browser opens at **http://127.0.0.1:8765**. Keep the terminal open while using the studio; press Ctrl+C to stop. If the port is busy, run `STUDIO_PORT=8766 python3 studio/server.py`.

1. Choose **Art**, **Music**, **Yoyo**, or **Math**, then write a title and post.
2. Add photos and a description for each. JPEG, PNG, and WebP are supported (10 MB each, up to 30 per post); images retain their original proportions.
3. Click **+ Add MP4 video** to select a video from your computer (one per post, up to **50 MB**). Check the attached player, then save or publish as usual. You can replace it by selecting another video, or click **Remove video**. For larger videos, use a YouTube/Vimeo link or a direct HTTPS media URL instead.
4. Click **Save draft** to keep it on this computer, or **Preview** to see the public rendering.
5. Click **Publish to website**. The app writes the post, commits its content and selected photos/video, then pushes the current branch to `origin`. GitHub Pages normally updates within a few minutes.

### MP4 videos

Uploaded videos play inline in Studio preview and on the public website, with playback controls and no autoplay. Use **H.264 video with AAC audio** for broad browser support; Studio checks the MP4 container but does not convert codecs. If a video does not play, export it using those settings. Local playback supports seeking.

Videos are stored in `uploads/` and only the attached video is included when publishing a post. Saving a draft keeps the attachment on this computer; publishing commits and pushes the video to your public GitHub repository. Removing or replacing an attachment does not erase the old file or its Git history. Avoid private footage, and use external hosting for long videos to keep the repository small.

After updating Studio, restart `python3 studio/server.py` and reload the browser. Commit and deploy the changed website/Studio code before publishing posts with uploaded videos; Studio protects against publishing with uncommitted renderer changes.

Published posts appear beneath existing artwork or in their corresponding Music, Yoyo, and Math pages. Select a published entry in the sidebar to edit and republish it. Discarding a local draft does not delete a published post. Original art collections are preserved; uploaded art appears as new posts, not as edits to the original gallery.

### Markdown and LaTeX

The studio preview and public posts share the same Markdown renderer (locally bundled markdown-it; no build step or internet needed for Markdown):

- `#` through `######` headings, `**bold**`, `*italic*`, and `~~strikethrough~~`.
- Bulleted and numbered lists, including nested lists (indent nested items).
- `> blockquotes`, `---` horizontal rules, `[links](https://example.com)`, and `![description](https://example.com/image.jpg)`.
- Inline code with backticks, fenced code blocks with triple backticks, and pipe tables.
- Blank lines separate paragraphs; two trailing spaces or a backslash before a newline makes a hard line break.
- HTML is displayed as text, never executed; unsafe link protocols are rejected.

Use `\(x^2\)` or `$x^2$` for inline math, and `\[...\]` or `$$...$$` for display math. Display delimiters can sit on their own lines; multiline equations, blank lines inside display blocks, fractions, matrices, and aligned equations are supported. Math is kept untouched by Markdown, and delimiters in code stay literal. Escape a literal dollar as `\$`; single-dollar math must not have whitespace immediately inside its delimiters.

```tex
An inline identity: \(e^{i\pi} + 1 = 0\).

\[
\begin{aligned}
f(x) &= \frac{x^2}{2} \\
f'(x) &= x
\end{aligned}
\]
```

### Mathematical environments

Use `\begin{name}` and `\end{name}` on their own lines for `definition`, `proof`, `theorem`, `problem`, `lemma`, `corollary`, and `conjecture`. An optional `[Title]` follows the opening delimiter. (The spelling `corolloary` is also accepted and displayed as “Corollary”.)

```tex
\begin{theorem}[Pythagoras]
For a right triangle with legs $a$, $b$ and hypotenuse $c$:
\[
a^2 + b^2 = c^2.
\]
\end{theorem}

\begin{proof}
Write your **argument** here. Lists, paragraphs, and equations work normally.
\end{proof}
```

These blocks have labeled headings and subtle borders; proofs end with □. Environments may be nested, are not automatically numbered, and render identically in Studio preview and public posts. Delimiters inside code stay literal. Unclosed or mismatched environments are left as ordinary text.

MathJax loads from jsDelivr only for posts containing math; offline, the original TeX stays visible. Media embeds need an internet connection and host permission to embed.

### One-time GitHub setup

The new renderer and studio files must be committed once before content publishing can work. Review these changes, then commit and push them on the branch configured for GitHub Pages:

```sh
git add .gitignore README.md index.html styles.css posts.js assets/vendor/ content/posts.json studio/
git commit -m "feat: add local publishing studio"
git push origin HEAD
```

This initial code deployment is separate from the studio's content-only commits. The studio refuses to publish while the public integration is uncommitted or unrelated changes are staged. Your Git author name/email and GitHub authentication must already work in the terminal. If needed, authenticate with `gh auth login` followed by `gh auth setup-git`, or configure an SSH remote. Never put a GitHub password/token in the app or repository. Publishing pushes **all existing commits on your current branch**, not just the new post, so use the GitHub Pages branch and avoid mixing unrelated work into it.

If a push fails, the post remains committed locally and the draft is retained. Fix the login/network issue, then click **Retry push** (or run `git push origin HEAD` if you restarted the studio). A retained draft can then be discarded; this does not remove the published post. The app never force-pushes or automatically merges remote changes; if the remote has newer commits, reconcile them with Git first.

### Storage and privacy

- Drafts: `.studio/drafts.json` (ignored by Git). Back up this folder for drafts; drafts do not sync between computers.
- Published content: `content/posts.json`; photos and videos: `uploads/`. Only photos and the MP4 attached to the published post are automatically staged. Removed/unused media are not automatically deleted from disk or Git history.
- Photos and videos retain their original bytes, including any metadata. Remove location/private metadata before publishing. Published content and uploaded media committed to this public repository are public, including in Git history.
- The server binds only to `127.0.0.1`, checks Host/Origin and a session token, and does not serve drafts or Git metadata. Do not expose it through a proxy/tunnel. The publicly hosted studio HTML cannot publish; publishing APIs exist only on your computer.
- Public posts load via JavaScript over HTTP(S); use the local studio's **View website** link or the static preview server, not a `file://` URL. Without JavaScript, the original website content remains visible.

Run integration tests (temporary repositories only):

```sh
python3 -m unittest discover -s studio -p 'test_*.py' -v
node --test tests/*.test.js
node --check posts.js
node --check studio/studio.js
```

## Editing the original static content

- Edit the Music, Yoyo, and Math sections in `index.html` to change their empty-state copy. Published posts replace that copy.
- Add artwork by copying a complete `figure.artwork` block into the gallery and setting its `data-series` to `chain`, `light`, or `order`.
- Update static image numbering, series descriptions in `script.js`, and image width/height and alt text when changing images. The interactive counter calculates its total automatically.
- Typography and layout are in `styles.css`. Josefin Sans and Alegreya load from Google Fonts, with Trebuchet MS and Georgia as their respective offline fallbacks.

## Contact

- Email: dannyhe652@gmail.com
- GitHub: https://github.com/dannyhe652

## Publish on GitHub Pages

1. Create a public repository named `dannyhe652.github.io` for an account-root website, or use a project repository.
2. Push this repository, including `index.html`, `styles.css`, `script.js`, `posts.js`, `assets/vendor/`, `content/`, `.nojekyll`, any published `uploads/`, and **all nine JPG files from the root directory**. Keep their names unchanged. Never upload `.studio/`.
3. Under **Settings → Pages**, choose **Deploy from a branch → main → / (root)**.
4. After deployment, the account-root website will be available at https://dannyhe652.github.io. A project repository uses https://dannyhe652.github.io/REPOSITORY-NAME/ instead.

No private information was researched; the site uses only the identity and contact details supplied for publication.
