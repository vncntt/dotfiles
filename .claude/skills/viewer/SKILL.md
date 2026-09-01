---
name: viewer
description: Build a static data-viewer / explainer web app (Bun + Vite + Vue 3 + strict TS, no backend) following Vincent's design standards. Use for viewing datasets, run results, transcripts, or explaining concepts and work.
disable-model-invocation: true
---

# Viewer

Build a fully static, client-side web app for viewing/explaining data: agent runs, experiment results, transcripts, benchmark outputs, write-ups. No backend, ever. Data lives in JSON files exported by a preprocess script, so new data means re-running the export — zero app changes.

Transcript viewing is one common use case; if the data is agent/Claude Code transcripts, ALSO read `transcript-viewer/README.md` in this skill folder for the proven parsing rules and components.

## Workflow — design questions first, then build

The user makes ALL design decisions; you do all the implementation. Never guess on a design fork.

1. **Explore the data first.** Read the actual input files: schemas, field names, sizes, row counts, worst-case item (largest transcript / most entries). Ground every question you ask in what you found. Note anything that will need a decision (missing timestamps, huge blobs, multiple formats).
2. **Ask batched design questions** with AskUserQuestion, multiple rounds (the original build used 4 rounds / 16 questions) BEFORE writing any code. Cover: data pipeline shape, landing page, per-item pages and tabs, rendering choices (collapse/expand, markdown or plain), navigation (router vs single-view), search/sort/filter, what metadata to surface. Recommend an option in each.
3. **Scaffold**: `bun create vite <name> --template vue-ts`. Enable strict TS (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`).
4. **Write the export/preprocess script** (`scripts/preprocess.ts`, run with `bun run`): raw data → compact typed JSON in `public/data/`. Duplicate the output types in `src/types.ts`.
5. **Build the UI** (structure below).
6. **Verify**: `bunx vue-tsc -b` after every change; then run the headless smoke test (see Verification).
7. **Tell the user how to run it** (`bun install`, `bun run preprocess`, `bun run dev`) without being asked, and write a short README with the same.
8. **Iterate.** When mid-build forks appear (e.g. "what should this panel show?"), ask — small scoped AskUserQuestion rounds worked well.

## Default stack (hard rules — the user dictated these)

- **Bun** for package management and scripts. Not npm. (If bun is missing: install script only updates zsh; on fish run `fish_add_path ~/.bun/bin`.)
- **Vite** + **Vue 3 Composition API** with `<script setup lang="ts">` + **TypeScript strict**.
- **Plain CSS**: scoped styles per component + one global `style.css` with CSS custom properties. **Light mode.** No UI framework, no Tailwind, no React — never swap these in from habit.
- **Charts are hand-rolled SVG in Vue templates.** No chart library.
- **shiki** for syntax highlighting code, **katex** for math, **rough.js** for diagrams — but ONLY when the content actually contains code/math/diagrams. Do not add them speculatively; plain `<pre style="white-space: pre-wrap">` is correct for prose transcripts.
- **markdown-it** when markdown rendering is needed (`html: false`, `linkify: true`, `breaks: false` — note `breaks: false` means hand-written single newlines collapse; warn the user if they'll author content).
- Add any other dependency only when it clearly earns its cost.
- **Routing**: `vue-router` with `createWebHashHistory()` when there are multiple pages / deep-linkable items (hash routing works on any static host with zero config). For a single-view selector app, skip the router entirely and persist selection in `localStorage` (`viewer.<key>` names). Ask the user which shape they want.
- `scrollBehavior(to, from)`: return `false` when `to.path === from.path` so tab/query changes don't jump to top; keep tab/selection state in the route (`/run/:id/:tab`, `?exp=N`) so links share.

## Data pipeline

- Export script reads raw inputs, writes `public/data/index.json` (summary rows for the landing page) plus per-item files (`public/data/runs/<id>/*.json`). Copy image assets alongside and rewrite relative srcs at render time.
- **Keep full content in the JSON — never truncate at preprocess time.** Truncation is a UI concern (preview + "show all (N kB)" button).
- Tolerant parsing: per-line try/catch for JSONL, skip garbage lines. **JSON-parse content instead of string-grepping raw files** — escaped quotes (`\"key\"`) silently break text filters.
- Runtime loading: tiny `data.ts` with `fetch` + in-memory Promise cache; load per-item JSON lazily when the item is opened.
- Multi-dataset case: a `datasets.json` manifest + per-dataset dirs absorbed new datasets and multi-judge score variants cleanly (`scores: Record<variantId, …>`); prefer that over hardcoding.
- If data lacks timestamps on some records, carry the last known timestamp forward and mark it approximate (`tsApprox`), rendered with a `~` suffix — never pretend precision.
- **Timestamps always display in PST/PDT (`America/Los_Angeles`)** — never UTC, never the browser local zone; pass `timeZone: "America/Los_Angeles"` to every `Intl.DateTimeFormat` / `toLocale*` call.

## Design rules (distilled from the user's edit requests — apply preemptively)

- **Terse, domain-meaningful labels. Strip technical noise everywhere it appears** — repeated ID prefixes (`run-`, `geo_`, date+counter prefixes), internal sample labels (`s0, s1`), raw addresses. Apply the shortening to sidebar AND headers AND tables in the same pass (a rename applied only to the sidebar had to be re-requested). Keep the full ID as a hover tooltip.
- **Metadata appears once, at the right level.** Model name goes in the transcript header bar, not on every message.
- **Analytically meaningful defaults, fewer options.** Sort worst-first / hardest-first by default when that's what the user will scan for; don't offer a neutral "in order" toggle nobody wants. Every extra toggle must earn its place.
- **Side-by-side beats switching**: for comparing variants (judges, models), use multi-select toggle pills rendering chips side by side, not a dropdown that swaps the view.
- **At-a-glance summary panels next to detail views** (e.g. sticky aside with a count-sorted distribution of answers).
- Numbers: `font-variant-numeric: tabular-nums`; show `—` for missing values, never a misleading 0.
- Collapse anything big: tool calls/attachments collapsed to one summary line (≤120 chars, first meaningful field), click to expand; long results get a 4,000-char preview with "show all (N kB)", `max-height` + scroll.
- Sticky topbar; per-view sticky toolbar under it (search, filters).
- Search (per-collection, not global): case-insensitive substring over a precomputed lowercase corpus, min 2 chars, hit counter `3/17`, ↑/↓ prev-next (Enter = next), "only matches" filter, jump-to-# box. Highlight hits with an amber left border, current hit with an amber outline. Give every item an `#anchor` id and a clickable `#index` link.
- Theme: white bg, system font stack, 14px base, `ui-monospace` stack for code/tool IO, CSS vars for all colors. Grays from the Tailwind-ish ramp (`#1a1d21` fg, `#6b7280` muted, `#9ca3af` faint, `#e5e7eb` border, `#f9fafb` subtle bg), accent blue `#2563eb`, error red `#dc2626`, ok green `#059669`. Distinct accent color per role/source (e.g. purple/cyan) used as 3px left borders and badges. See `references/style.css` for the proven base + markdown body styles.
- Assign colors to dynamic categories (models) from a fixed 8-color palette by first-seen order (`references/format.ts` `modelColor`).
- Favicon: simple solid-black SVG glyph, no gradients.

## Performance (large collections — proven to ~4,700 messages, ~0.5s load)

Prefer these over a virtual-scroll library — they keep anchors, search, and ctrl-F working:

- `content-visibility: auto; contain-intrinsic-size: auto <est>px;` on every card/row.
- **Lazy expensive rendering** (markdown/shiki) via a single shared one-shot IntersectionObserver with `rootMargin: 600px` — render a plain `<pre>` until the element nears the viewport, then swap in rendered markdown. Copy `references/useVisible.ts`.
- Shiki: use the fine-grained core, NOT the full bundle (`createHighlighter` from `"shiki"` pulls every grammar + wasm — hundreds of chunks). Use `createHighlighterCore` from `shiki/core` + `createJavaScriptRegexEngine({ forgiving: true })` + explicit `@shikijs/langs/*` imports + `@shikijs/themes/github-light`. Warm it before app mount so first paint is highlighted. Copy `references/markdown.ts` (also has the markdown-it image-`assetBase` rewrite and target=_blank link rules, and the `RuleArgs` tuple trick that satisfies vue-tsc strict on renderer overrides).
- Fetch per-item JSON lazily; cache promises.

## Verification (required before declaring done)

- `bunx vue-tsc -b` clean.
- Headless smoke test with playwright-core against the real dev server: load every page type, capture console errors (fail on any), screenshot each, and ALWAYS include the worst-case/largest dataset item. Use `scripts/smoke.ts` in this skill folder as the template. Review the screenshots yourself — visual review caught real issues (ordering nuances, missing images) that console checks did not.
- Report load time of the worst-case page.

## Hosting notes (when asked)

`bun run build` (`vue-tsc -b && vite build`) → self-contained `dist/` with data included; servable by any static host (`bunx serve dist`, Netlify Drop, Cloudflare Pages — check per-file size limits, ~20MB+ files can be an issue). Static hosts are public by default; free Netlify has no password — for access control suggest Cloudflare Access or Tailscale. Don't publish user data without asking.

## Reference files

- `references/style.css` — global theme, CSS vars, markdown body styles
- `references/markdown.ts` — markdown-it + shiki fine-grained setup
- `references/useVisible.ts` — lazy-render composable
- `references/format.ts` — fmtTokens/fmtDuration/fmtTime/shortModel/modelColor helpers
- `scripts/smoke.ts` — headless smoke-test template
- `transcript-viewer/` — full transcript-viewer use case: parsing rules + proven preprocess script and components (read its README when viewing agent transcripts)
