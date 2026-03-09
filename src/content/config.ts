import { defineCollection, z } from "astro:content";

const projects = defineCollection({
  type: 'content',
    schema: z.object({
      name: z.string(),
      image: z.string().optional(),
      description: z.string(),
      stack: z.array(z.string()),
      date: z.string(),
      github: z.string().optional(),
      live_link: z.string().optional(),
    })
})

export const collections = { projects }