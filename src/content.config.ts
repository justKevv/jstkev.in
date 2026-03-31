import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) => z.object({
    name: z.string(),
    featured: z.boolean().default(false),
    category: z.enum(['personal', 'academics']).default('personal'),
    order: z.number().default(99),
    image: image().optional(),
    description: z.string(),
    stack: z.array(z.string()),
    date: z.string(),
    github: z.string().optional(),
    live_link: z.string().optional(),
  })
})

export const collections = { projects }
