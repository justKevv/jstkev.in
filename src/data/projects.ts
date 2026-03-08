import type { ProjectItem } from "../types/project";
import { SITE_URL } from "../config";

export const projects: ProjectItem[] = [
  {
    name: "jsta.dev",
    description: "my personal website, built with astro. it's a work in progress, but it's a great way to showcase my skills and projects.",
    stack: ['astro', 'gsap', 'typescript', 'tailwindcss'],
    date: "2026",
    github: "https://github.com/justKevv",
    link: SITE_URL
  },
]