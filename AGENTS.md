# AGENTS.md

## What This Repo Is

A personal portfolio and blog for **Digitalus Maximus**, hosted on **GitHub Pages** at https://digitalus.github.io. It is a **Jekyll** site styled with **Tailwind CSS v4** (compiled with the Tailwind CLI) and vanilla JavaScript. Repo: `Digitalus/digitalus.github.io`, branch `main`.

## Structure at a Glance

| Path | Purpose |
|---|---|
| `_config.yml` | Site title, author, description, email, URL, permalink, excludes |
| `index.html` | Homepage (hero, 6 latest posts, projects, about, contact form) |
| `blog.html` | Blog listing at `/blog/` |
| `_layouts/default.html` | Base layout: head, theme init script, animated background lines, header, footer, back-to-top tab |
| `_layouts/post.html` | Blog post layout |
| `_includes/` | `header.html` (sticky nav, theme toggle), `footer.html`, `post-card.html` |
| `_data/projects.yml` | Project cards on the homepage (title, description, image, tech tags, link) |
| `_posts/` | Blog posts, `YYYY-MM-DD-title.md` |
| `src/css/styles.css` | **Readable source** for `css/styles.css` (minified output). Theme CSS variables (light/dark), animated background lines, prose colors |
| `css/tailwind.input.css` | Tailwind v4 input: `@theme` color mapping, typography plugin |
| `css/tailwind.css` | **Compiled** Tailwind output, committed to the repo |
| `js/scripts.js` | Theme toggle (saved in `localStorage`) and mobile menu |
| `js/main.js` | Empty placeholder |
| `images/` | WebP project screenshots and `favicon.svg` |
| `apps/calc/` | Standalone calculator (own HTML, CSS; `script.js` is **minified output**) |
| `apps/frogger/` | Standalone Frogger game (own HTML, CSS; `script.js` is **minified output**) |
| `apps/snake/` | Standalone Snake game (own HTML, CSS; `script.js` and `style.css` are **minified output**) |
| `src/apps/*/script.js`, `src/apps/*/style.css` | **Readable source** for the app scripts and styles. Edit these, not the minified `apps/*/` files. Excluded from the published site |
| `sitemap.xml` | Liquid-generated sitemap (see below) |
| `robots.txt` | Allows all crawlers and points to the sitemap |
| `package.json` | Build scripts for the Tailwind CLI and Terser (dev dependencies only) |

## Commands

Ruby 3.3 is installed at `C:\Ruby33-x64\bin`. A new shell may need it on `PATH`:

```powershell
$env:Path = "C:\Ruby33-x64\bin;" + $env:Path
bundle install              # first time only
bundle exec jekyll serve    # preview at http://localhost:4000
npm install                 # first time only
npm run build:css           # compile css/tailwind.css (minified)
npm run build:js            # minify src/apps/*/script.js into apps/*/script.js with Terser
npm run build:css:min       # minify src CSS into css/styles.css and apps/*/style.css (clean-css)
npm run build               # all of the above
npm run watch:css           # rebuild on change while editing
```

- The shell is PowerShell on Windows. `&&` is not supported; use `;` or separate commands.
- There is no test or lint step.

## Key Facts for Agents

- **Rebuild Tailwind after changing classes.** GitHub Pages does not run npm. After adding or changing Tailwind classes in any HTML, run `npm run build:css` and **commit `css/tailwind.css`**.
- **Theme colors live in CSS variables** in `css/styles.css` (`:root` for light, `[data-theme="dark"]` for dark), as space-separated RGB values. `css/tailwind.input.css` maps them to Tailwind color names (`brand`, `accent`, `navy`, `sky`, `ink`, `muted`, `line`, `surface`, `canvas`, `title-end`, and the `gray-*` scale). Brand colors are navy and light blue, with an orange accent.
- **Restart Jekyll after editing `_config.yml`.** It is only read at startup.
- **Quote YAML front matter titles that contain a colon**, for example `title: "Learning in Public: What I Wish I Knew"`. Unquoted colons break the build and the post silently loses its front matter.
- **Liquid:** assign a split string to a variable before looping over it. `{% for x in "a,b" | split: "," %}` fails.
- **`node_modules`, `package*.json`, and `css/tailwind.input.css` are excluded** from the built site in `_config.yml`.
- **Contact email** is set once in `_config.yml` (`email`) and is used by the homepage contact text and the footer. The old placeholders (title, years of experience, email) have all been filled in.
- **The contact form is not functional.** It posts to `submit.php`, which does not exist, and GitHub Pages cannot run PHP. A mailto link is the fallback. The URL was left as is on purpose.
- **Edit app JavaScript in `src/apps/<name>/script.js`**, then run `npm run build:js` and **commit the generated `apps/<name>/script.js`**. Never hand-edit the minified output, because the next build overwrites it. When adding a new app script, add it to the `build:js` script in `package.json`. The source files carry a `/*! Copyright ... */` header that Terser preserves.
- **License:** all rights reserved, see `LICENSE`. The repo was previously GPL v3 and was changed to all rights reserved. `package.json` is marked `"license": "UNLICENSED"` and `"private": true`. Do not add open-source license text or headers to new files.

## Adding or Modifying Content

- **Blog post:** add `_posts/YYYY-MM-DD-title.md` with front matter `layout: post`, `title`, `date`, `description`, and `tags`. The homepage shows the 6 newest, the blog page shows all, and the sitemap picks them up automatically. Do not use future dates, since Jekyll skips them.
- **Project card:** add an entry to `_data/projects.yml`. Put the screenshot in `images/` as WebP.
- **Images:** use WebP and keep them small. Screenshots are 12 to 90 KB.
- **New app:** create `apps/<name>/` with its own `index.html` and `style.css`, and put the script source in `src/apps/<name>/script.js` (minified to `apps/<name>/script.js` by `npm run build:js`). Apps do not use the Jekyll layout, so copy these from the existing apps: the `<meta name="robots" content="index, follow">` tag, the favicon and manifest `<link>` tags, the animated `.lines` background markup and CSS, and a Home link to `https://digitalus.github.io/`. Then add the app to `sitemap.xml` by hand and add a card to `_data/projects.yml`.

## SEO

- `sitemap.xml` lists the homepage, `/blog/`, the apps, and every post. The homepage, blog page, and posts are generated from Liquid, but the **apps are listed manually**.
- Contact is a section of the homepage (`/#contact`), not a separate page, so it has no sitemap entry.
- Pages in the site layout and both apps carry `<meta name="robots" content="index, follow">`.
- During local preview, sitemap URLs show `localhost:4000`. On GitHub Pages they use `site.url` from `_config.yml`.

## Apps

**Calculator (`apps/calc/`)**
- Uses an IIFE, `data-action` and `data-num`/`data-op` attributes for event delegation, and supports click and keyboard input (Enter for equals, Esc to clear, Backspace to delete).
- Operator symbols are Unicode (`÷`, `×`, `−`), mapped from `/`, `*`, `-`, `+` on the keyboard.
- Max 12 digits, with exponential notation on overflow. CSS variables under `:root` control the theme.

**Frogger (`apps/frogger/`)**
- HTML5 canvas game with neon styling and the same animated background as the homepage.
- Controls: arrow keys or WASD, on-screen arrow pad, and swipe or tap on the board.
- Sound is synthesized with Web Audio (no audio files), with a Sound on/off toggle saved in `localStorage`. The best score is saved under `frogger-best`.
- Difficulty rises each time the frog reaches the top: faster lanes, more cars, and narrower logs at higher levels.
- Reaching the top strip triggers fireworks and flashes the word HOME.

**Snake (`apps/snake/`)**
- HTML5 canvas game with the same neon styling, animated background, and controls layout as Frogger (it reuses Frogger's stylesheet).
- The snake wraps around the edges and dies only when it hits itself. Speed increases every 5 foods.
- Controls: arrow keys or WASD, Space or P to pause, on-screen arrow pad, and swipe on the board. Sound is synthesized with Web Audio and saved under `snake-muted`. The best score is saved under `snake-best`.
