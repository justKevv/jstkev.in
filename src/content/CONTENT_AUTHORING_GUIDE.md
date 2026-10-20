# Content Authoring Guide — Projects & Archives (Blogs)

This guide defines the conventions, schemas, and best practices for **both** content collections in this repository:

- `src/content/projects/` — portfolio projects
- `src/content/archives/` — blog posts / articles / external resources

Follow it when creating or editing entries in either collection.

> ⚠️ **Note on discrepancies**: The Zod schemas in `src/content.config.ts` are the **source of truth for content validation**. The TypeScript interfaces in `src/types/project.ts` and `src/types/archive.ts` are used for component props and may differ. Where they conflict, the Zod schema wins for frontmatter, but components expect the interface shape.

---

## 1. Shared Principles

| Principle | Detail |
|-----------|--------|
| **Format** | `.mdx` preferred (allows component imports); `.md` works for plain Markdown |
| **Frontmatter** | YAML, validated by Zod schemas in `src/content.config.ts` |
| **Naming** | Filename = kebab-case slug derived from the title/name field |
| **Assets** | Store images in `src/assets/projects/` or `src/assets/archives/`; reference with relative paths from the `.mdx` file |
| **Links** | Use normal markdown links for external resources, e.g. `[Astro](https://astro.build)` |
| **Validation** | Run `npm run build` (or `npx astro sync`) before committing to catch schema errors |

---

## 2. Projects Collection (`src/content/projects/`)

### 2.1 Zod Schema (source of truth)

```ts
// src/content.config.ts
const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) => z.object({
    name: z.string(),

    category: z.enum(['personal', 'academics']).default('personal'),
    image: image().optional(),
    description: z.string(),
    stack: z.array(z.string()),
    date: z.string(),
    github: z.string().optional(),
    live_link: z.string().optional(),
  })
})
```

### 2.2 Field Reference

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `name` | ✅ | string | Title-cased. Used for page title, slug, card heading. |

| `category` | ❌ | `'personal' \| 'academics'` | Defaults to `'personal'`. Must be exactly one of the two. |
| `image` | ❌ | `ImageMetadata` | Relative path from this file: `../../assets/projects/your-image.png` |
| `description` | ✅ | string | One sentence, plain text. Shown on index cards & meta tags. |
| `stack` | ✅ | `string[]` | Keys from `src/data/stacks.ts` (see 2.3). |
| `date` | ✅ | string | Free-form and quoted: `"Feb 2025"`, `"2024"`, `"Jan–Mar 2023"`, `"always ongoing"`. |
| `github` | ❌ | string (URL) | Full HTTPS GitHub repo URL. |
| `live_link` | ❌ | string (URL) | Full HTTPS live demo URL. |

> **Note**: The TypeScript interface `ProjectItem` (in `src/types/project.ts`) adds `content_link` (required) and `priority` (optional). These are computed or injected at build time, so do **not** put them in frontmatter.

### 2.3 Stack Keys — Critical Constraint

Every entry in `stack` **should** be a key in `src/data/stacks.ts`:

```ts
// src/data/stacks.ts
key: { url: "https://docs.url", icon: "iconify-icon-name" },
```

Lookup is case-insensitive. Unknown keys don't break the build, but they render as plain text with a fallback icon and no link.

Current keys (check `src/data/stacks.ts` for the authoritative list):

```
astro, typescript, gsap, tailwindcss, next.js, sanity.io, python, arduino,
flask, streamlit, yolo, gemini, php, laravel, alpinejs, prelineui, mysql,
imagekit, slim, sqlserver, golang, flow launcher, notion api, fastapi, docker,
huggingspaces, fastcron, nestjs, socket.io, supabase, langchain, react, vite,
mongodb, hono, bun, cloudflare kv, threejs, scikit-learn, pandas, tf-idf, numpy
```

If you need a new technology, **add one entry to `stacks.ts` first**, then use its key. Note that the key is `next.js`, not `nextjs`.

### 2.4 Slug Generation

`src/lib/generateSlug.ts` lowercases the title, strips special characters, and joins words with hyphens.

`name: "My Cool Project"` → `/projects/my-cool-project`

### 2.5 Body Content (MDX)

- Write the long-form project narrative.
- Headings (`##`, `###`) are auto-extracted for the on-page table of contents.
- Use a static import for local images (see section 5).
- Tone: personal and reflective. This is a portfolio, not a spec sheet.

### 2.6 Minimal Valid Example

```mdx
---
name: "Example Project"
description: "A short one-line description of the project."
stack: ["astro", "typescript", "tailwindcss"]
date: "2024"
github: "https://github.com/yourname/example-project"
---
This is the project body. Write whatever you want here.
```

---

## 3. Archives Collection (`src/content/archives/`) — Blogs / Articles / Resources

### 3.1 Zod Schema

```ts
// src/content.config.ts
const archives = defineCollection({
  loader: glob({ base: './src/content/archives', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    category: z.string(),
    image: image().optional(),
    description: z.string(),
    date: z.date(),
  })
})
```

### 3.2 Field Reference

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `title` | ✅ | string | Article/resource title. Used for page title, card heading, slug. |
| `category` | ✅ | string | Free-form tag: `"tutorial"`, `"article"`, `"reference"`, `"showcase"`, `"note"`. Used for grouping. |
| `image` | ❌ | `ImageMetadata` | Relative path: `../../assets/archives/your-image.png` |
| `description` | ✅ | string | One-sentence summary for cards & SEO. |
| `date` | ✅ | date | Unquoted ISO date, e.g. `2026-07-30`. YAML parses it into a `Date` object, which the schema requires. |

> **Note**: The TypeScript interface `ArchiveItem` (in `src/types/archive.ts`) includes a `link: string` field. It is computed at build time from `title` (in `src/pages/archives.astro`). Do **not** put `link` in frontmatter.

### 3.3 Slug Generation

Same `generateSlug` utility as projects, but based on `title`: `title: "How I Built X"` → `/archives/how-i-built-x`

### 3.4 Body Content (MDX)

- Full article content in Markdown/MDX.
- Headings are used for the table of contents.
- Can embed images, components, code blocks, etc.
- If the post is syndicated from an external canonical URL, consider adding a `<link rel="canonical" />` via a layout or component (not yet implemented, future enhancement).

### 3.5 Minimal Valid Example

```mdx
---
title: "How I Built This Site with Astro"
category: "tutorial"
description: "A walkthrough of the architecture, content collections, and deployment."
date: 2026-07-30
---
This is the article body. Write your content here.
```

---

## 4. Writing Voice & Style

This section captures **how you write**: the tone and habits that make your content sound like *you*. The structure is up to you. Nothing here is a required opening or ending.

### 4.1 Core Voice

| Aspect | Your Style |
|--------|------------|
| **Perspective** | First-person ("I built...", "I wanted to...") — direct and personal |
| **Tone** | Conversational, slightly self-deprecating, honest — not marketing copy |
| **Sentence rhythm** | Mix of short punchy lines and longer reflective sentences |
| **Audience** | Fellow developers, future-you, curious peers — technical but accessible |
| **Vulnerability** | Open about struggles, over-engineering, things that went wrong |
| **Informality** | Casual asides and shorthand are fine: "tbh", "kinda", "idk", "--" as a dash, the occasional `:|` |

### 4.2 Structure Is Flexible

Pick whatever fits the story. These are moves that show up across your existing posts, not steps to follow in order:

- **Opening**: jump straight into the point, or start with some backstory. Both work: "This is the first time I've used slim framework..." and "Honestly this project started as me just wanting to learn..."
- **Imagined reader or inner monologue**: a short blockquote works well, e.g. `> why not use laravel instead?` Use it when it adds something, not in every post.
- **Connectors**: "So originally...", "But then...", "Ended up...", "And you know..."
- **Headings**: short, lowercase headings are fine in longer posts (`## why astro?`). Short projects may have none.
- **Lists**: use them when the content is a list (stack, links, collaborators). Don't turn a list into a moral.
- **Ending**: any of these work, or none:
  - A short verdict: "Would I do it again? Yeah, probably."
  - A pointer to the repo: "you can check out the **github repo** that I linked above"
  - A credit list of collaborators
  - A casual sign-off: "Sorry for the yapping :|"

### 4.3 Formatting Habits

| Element | Usage |
|---------|-------|
| **Bold** | For emphasis on key feelings/decisions ("**way longer**", "**actually fun**"), or labels like "**Disclaimer**:" |
| *Italic* | Rare; mostly for internal thoughts in blockquotes |
| `inline code` | Commands, file paths, code identifiers |
| Code blocks | Config snippets, terminal output, key logic |
| Headings (`##`, `###`) | Narrative sections; auto-generate the TOC |
| Inline links | Tech names with docs, external resources, collaborators, references: `[React](https://react.dev)` |
| `<Image />` | Screenshots, diagrams, team photos, optimized via Astro assets |

### 4.4 What to Avoid

- ❌ Marketing speak ("revolutionary", "seamless", "best-in-class")
- ❌ Pure feature lists without narrative context
- ❌ Overly academic/abstract language
- ❌ Pretending everything went smoothly
- ❌ Walls of text. Break it up with headings, code, images
- ❌ Forcing a "things I learned" list or a moral at the end

### 4.5 Archives-Specific Notes

- The same voice applies to blog posts and articles.
- If syndicating from an external source, add a brief **personal preamble** before the canonical content.
- Use `category` tags consistently: `"tutorial"`, `"article"`, `"reference"`, `"showcase"`, `"note"`.

---

## 5. Asset Path Conventions

| Collection | Asset Directory | Frontmatter Path Example |
|------------|-----------------|--------------------------|
| `projects` | `src/assets/projects/` | `image: "../../assets/projects/hero.png"` |
| `archives` | `src/assets/archives/` | `image: "../../assets/archives/cover.jpg"` |

In the MDX body, use a static import (dynamic `import()` doesn't work with Astro's `Image`):

```mdx
import hero from '../../assets/projects/hero.png';
<Image src={hero} alt="Project hero" />
```

---

## 6. Validation Checklist (Both Collections)

Before committing, run `npm run build` and confirm:

- [ ] File is `.mdx` (or `.md`) in the correct directory
- [ ] Filename matches the slugified `name` (projects) or `title` (archives)
- [ ] Frontmatter passes the Zod schema (all required fields present, correct types)
- [ ] `projects.stack` keys exist in `src/data/stacks.ts`
- [ ] `image` paths (if present) resolve to real files
- [ ] `github`, `live_link` are valid HTTPS URLs
- [ ] Body MDX compiles without errors
- [ ] `npm run build` exits cleanly

---

## 7. Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| `stack` key missing from `stacks.ts` | Plain-text pill, no icon or link (no build error) | Add one entry to `src/data/stacks.ts` |
| `stack` uses `nextjs` | Plain text, no link | Use the key `next.js` |
| `image` path wrong | Missing hero image, build warning | Use `../../assets/<collection>/filename.ext` relative to the `.mdx` file |
| `date` quoted on archives | Schema expects `Date`, gets a string, build fails | Leave unquoted: `date: 2026-07-30` |
| `date` unquoted on projects | YAML parses it as a `Date`, schema expects a string | Quote it: `date: "Feb 2025"` |

| `projects.category` typo | Silently defaults to `'personal'` | Use exactly `'personal'` or `'academics'` |
| `archives.title` vs `name` confusion | Slug comes from `title`, not `name` | Use `title` in archive frontmatter |
| Filename doesn't match slug | Confusing file names, harder to find posts | Rename the file to match `generateSlug(name or title)` |

---

## 8. Updating This Guide

**When you change any of the following, update this file:**

- Zod schemas in `src/content.config.ts`
- Stack keys in `src/data/stacks.ts`
- Slug generation logic in `src/lib/generateSlug.ts`
- Asset directory structure
- New fields, components, or conventions

This guide is the contract for AI agents and human contributors alike. Keep it current.
