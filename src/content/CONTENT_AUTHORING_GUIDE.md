# Content Authoring Guide — Projects & Archives (Blogs)

This guide defines the conventions, schemas, and best practices for **both** content collections in this repository:

- `src/content/projects/` — portfolio projects
- `src/content/archives/` — blog posts / articles / external resources

Follow it exactly when creating or editing entries in either collection.

> ⚠️ **Note on discrepancies**: The Zod schemas in `src/content.config.ts` are the **source of truth for content validation**. The TypeScript interfaces in `src/types/project.ts` and `src/types/archive.ts` are used for component props and may differ. Where they conflict, the Zod schema wins for frontmatter — but components expect the interface shape. Known gaps are flagged below.

---

## 1. Shared Principles

| Principle | Detail |
|-----------|--------|
| **Format** | `.mdx` preferred (allows component imports); `.md` works for plain Markdown |
| **Frontmatter** | YAML, validated by Zod schemas in `src/content.config.ts` |
| **Naming** | Filename = kebab-case slug derived from the title/name field |
| **Assets** | Store images in `src/assets/projects/` or `src/assets/archives/`; reference with relative paths from the `.mdx` file |
| **Validation** | Run `npm run build` (or `npx astro sync`) before committing — catches schema errors |

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
})```
})
```

### 2.2 Field Reference

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `name` | ✅ | string | Title-cased. Used for page title, slug, card heading. |
| `category` | ❌ | `'personal' \| 'academics'` | Defaults to `'personal'`. Must be exactly one of the two. |
| `image` | ❌ | `ImageMetadata` | Relative path from this file: `../../assets/projects/your-image.png` |
| `description` | ✅ | string | One sentence, plain text. Shown on index cards & meta tags. |
| `stack` | ✅ | `string[]` | **Lowercase** keys that exist in **both** `src/data/stackIcons.ts` AND `src/data/stacksUrls.ts`. |
| `date` | ✅ | string | Free-form: `"Feb 2025"`, `"2024"`, `"Jan–Mar 2023"`, `"always ongoing"`. |
| `github` | ❌ | string (URL) | Full HTTPS GitHub repo URL. |
| `live_link` | ❌ | string (URL) | Full HTTPS live demo URL. |

> **Note**: The TypeScript interface `ProjectItem` (in `src/types/project.ts`) adds `content_link` (required) and `priority` (optional) — these are computed/injected at build time, not in frontmatter.

### 2.3 Stack Keys — Critical Constraint

Every entry in `stack` **must** be a key present in **both** data files:

- `src/data/stackIcons.ts` → `key: "iconify-icon-name"`
- `src/data/stacksUrls.ts` → `key: "https://docs.url"`

If you need a new technology, **add it to both files first**, then use the key here.

Common keys (check files for full list):

```
astro, gsap, typescript, tailwindcss, threejs, react, nextjs, nodejs, python,
arduino, flask, streamlit, yolo, gemini, mongodb, postgresql, docker, git,
github, vscode, figma, html, css, javascript, svelte, vue, nuxtjs, solidjs,
prisma, trpc, graphql, rest, supabase, firebase, vercel, netlify, cloudflare
```

### 2.4 Slug Generation

`src/lib/generateSlug.ts`:

```ts
export default function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
```

`name: "My Cool Project"` → `/projects/my-cool-project`

### 2.5 Body Content (MDX)

- Write long-form project narrative.
- Headings (`##`, `###`) → auto-extracted for on-page table of contents.
- Use `<Image src={import('../../assets/projects/img.png')} alt="..." />` for optimized local images.
- Import and use custom components as needed.
- Tone: personal, reflective — this is a portfolio, not a spec sheet.

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
})```
})
```

### 3.2 Field Reference

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `title` | ✅ | string | Article/resource title. Used for page title, card heading, slug. |
| `category` | ✅ | string | Free-form tag: `"tutorial"`, `"article"`, `"reference"`, `"showcase"`, etc. Used for grouping/filtering. |
| `image` | ❌ | `ImageMetadata` | Relative path: `../../assets/archives/your-image.png` |
| `description` | ✅ | string | One-sentence summary for cards & SEO. |
| `date` | ✅ | date | Free-form: 2026-07-30 (parsed as Date object). |

> **Note**: The TypeScript interface `ArchiveItem` (in `src/types/archive.ts`) includes a `link: string` field, but this is **computed at build time** from the `title` via `generateSlug` (in `src/pages/archives.astro`). Do **not** include `link` in frontmatter — it's injected by the page component.

### 3.3 Slug Generation

Same `generateSlug` utility is used. `title: "How I Built X"` → `/archives/how-i-built-x`

### 3.4 Body Content (MDX)

- Full article content in Markdown/MDX.
- Headings → table of contents.
- Can embed images, components, code blocks, etc.
- If `link` points to an external canonical URL, consider adding a `<link rel="canonical" />` via a layout or component (not yet implemented — future enhancement).

### 3.5 Minimal Valid Example

```mdx
---
title: "How I Built This Site with Astro"
category: "tutorial"
description: "A walkthrough of the architecture, content collections, and deployment."
date: "2026-07-30"
---
This is the article body. Write your content here.
```

---

## 5. Writing Voice & Style

This section captures **how you write** — the tone, structure, and habits that make your content sound like *you*. Follow these patterns when authoring new entries.

### 5.1 Core Voice

| Aspect | Your Style |
|--------|------------|
| **Perspective** | First-person ("I built...", "I wanted to...") — direct and personal |
| **Tone** | Conversational, slightly self-deprecating, honest — not marketing copy |
| **Sentence rhythm** | Mix of short punchy lines and longer reflective sentences |
| **Audience** | Fellow developers, future-you, curious peers — technical but accessible |
| **Vulnerability** | Open about struggles, over-engineering, things that went wrong |

### 5.2 Structural Patterns

**Open with context/motivation** — not a feature list.
```mdx
This project actually took way **longer** than it should've. (mainly because of me being too idealistic)
```

**Use casual transitions** to move the story forward:
- "So originally..."
- "That's when I thought..."
- "Ended up..."
- "Long story short..."
- "But here's the thing..."

**Address the reader directly** occasionally:
> "Let's get you guys up to speed..."
> "You can check out the **github repo** that I linked above..."

**Blockquotes for internal monologue / realizations**:
```mdx
> oh this is so cool, I want to learn more about this
```

**End with concrete takeaways** — bullet list of lessons, links to collaborators, or what you'd do differently:
```mdx
Things I learned:
- Don't over-engineer the auth system
- Tailwind + Astro is a great combo
- Next time: start with the data model

Check out the team:
- [Collaborator's LinkedIn](...)
- [Related article](...)
```

### 5.3 Formatting Habits

| Element | Usage |
|---------|-------|
| **Bold** | For emphasis on key feelings/decisions ("**way longer**", "**actually fun**") |
| *Italic* | Rare; mostly for internal thoughts in blockquotes |
| `inline code` | Tech names, commands, file paths |
| Code blocks | Config snippets, terminal output, key logic |
| Headings (`##`, `###`) | Narrative sections — auto-generate TOC |
| `<StackLink name="..." />` | Inline tech mentions with icon + doc link |
| `<Image />` | Screenshots, diagrams, team photos — optimized via Astro assets |
| Inline links | External resources, collaborators, references |

### 5.4 What to Avoid

- ❌ Marketing speak ("revolutionary", "seamless", "best-in-class")
- ❌ Pure feature lists without narrative context
- ❌ Overly academic/abstract language
- ❌ Pretending everything went smoothly
- ❌ Walls of text — break it up with headings, code, images

### 5.5 Archives-Specific Notes

- Same voice applies to blog posts / articles
- If syndicating from external source, add a brief **personal preamble** before the canonical content
- Use `category` tags consistently: `"tutorial"`, `"article"`, `"reference"`, `"showcase"`, `"note"`

---

## 6. Asset Path Conventions

| Collection | Asset Directory | Frontmatter Path Example |
|------------|-----------------|--------------------------|
| `projects` | `src/assets/projects/` | `image: "../../assets/projects/hero.png"` |
| `archives` | `src/assets/archives/` | `image: "../../assets/archives/cover.jpg"` |

In MDX body:

```mdx
import hero from '../../assets/projects/hero.png';
<Image src={hero} alt="Project hero" />
```

---

## 5. Validation Checklist (Both Collections)

Before committing, run `npm run build` and confirm:

- [ ] File is `.mdx` in correct directory
- [ ] Filename matches slugified `name`
- [ ] Frontmatter passes Zod schema (no type errors)
- [ ] `projects.stack` keys all exist in **both** `stackIcons.ts` AND `stacksUrls.ts`
- [ ] `image` paths (if present) resolve to real files
- [ ] `github`, `live_link`, `link` are valid HTTPS URLs
- [ ] Body MDX compiles without errors
- [ ] `npm run build` exits cleanly

---

## 6. Common Pitfalls

| Pitfall | Symptom | Fix |
|---------|---------|-----|
| `stack` key missing from data files | Build error: "Iconify icon not found" / broken link | Add key to **both** `stackIcons.ts` and `stacksUrls.ts` |
| `image` path wrong | Missing hero image, build warning | Use `../../assets/<collection>/filename.ext` relative to `.mdx` |
| `date` parsed as YAML date | Schema expects string, gets `Date` object | Quote it: `date: "Feb 2025"` or keep as bare string |
| `projects.category` typo | Silently defaults to `'personal'` | Use exactly `'personal'` or `'academics'` |
| `archives.title` vs `name` confusion | Slug generation uses `title`, not `name` | Use `title` in frontmatter |
| `date` parsed as YAML date | Schema expects `Date` object, gets `Date` object | Leave unquoted: `date: 2026-07-30` (YAML parses as Date) |
| Filename doesn't match slug | Confusing URLs, potential 404s | Rename file to match `generateSlug(name)` output |

---

## 7. Updating This Guide

**When you change any of the following, update this file:**

- Zod schemas in `src/content.config.ts`
- Stack keys in `src/data/stackIcons.ts` / `stacksUrls.ts`
- Slug generation logic in `src/lib/generateSlug.ts`
- Asset directory structure
- New fields, components, or conventions

This guide is the contract for AI agents and human contributors alike — keep it current.