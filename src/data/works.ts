import type { WorkItem } from "../types/work";

export const works: WorkItem[] = [
  {
    company: "sekolah alam indonesia",
    role: "full stack developer",
    stack: ['next.js', 'react', 'tailwindcss', 'sanity.io', 'lenis', 'framer-motion'],
    type: "freelance",
    date: "oct 2025 - mar 2026",
    location: "indonesia",
    highlights: [
      "built a multi-page school profile website using Next.js 15 and Sanity CMS for content management",
      "implemented scroll-driven parallax animations with Framer Motion and custom spring physics hooks.",
      "integrated Lenis smooth scroll with custom easing and a manual animation frame loop",
      "collaborated closely with a designer to translate Figma designs into pixel-accurate, responsive components across multiple pages",
    ]
  },
  {
    company: "independent",
    role: "full stack developer",
    stack: ['php', 'laravel', 'filament', 'livewire', 'tailwindcss', 'mysql'],
    type: "freelance",
    date: "dec 2025 - feb 2026",
    location: "indonesia",
    highlights: [
      "tasked to continue an existing laravel app — a nursing workload calculator for hospitals",
      "started clean but hit a wall when requirements grew to support multiple hospitals",
      "recognized it was becoming tech debt, so i reworked the database from scratch",
      "migrated the admin panel from bootstrap to filament for a more maintainable and efficient setup",
    ]
  },
]
