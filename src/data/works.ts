import type { WorkItem } from "../types/work";

export const works: WorkItem[] = [
  {
    company: "sekolah alam indonesia",
    role: "freelance full stack developer",
    stack: [
      "next.js",
      "react",
      "tailwindcss",
      "sanity.io",
      "lenis",
      "framer-motion",
    ],
    type: "freelance",
    date: "oct 2025 - mar 2026",
    location: "indonesia",
    highlights: [
      "built a multi-page school profile website using next.js 15 and sanity cms for content management",
      "implemented scroll-driven parallax animations with framer motion and custom spring physics hooks",
      "integrated lenis smooth scroll with custom easing and a manual animation frame loop",
      "collaborated closely with a designer to translate figma designs into pixel-accurate, responsive components across multiple pages",
    ],
  },
  {
    company: "independent",
    role: "freelance full stack developer",
    stack: [
      "php",
      "laravel",
      "filament",
      "livewire",
      "tailwindcss",
      "mysql",
    ],
    type: "freelance",
    date: "dec 2025 - feb 2026",
    location: "indonesia",
    highlights: [
      "continued development of an existing laravel application for hospital nursing workload calculations",
      "identified growing technical debt as requirements expanded to support multiple hospitals and redesigned the database schema from scratch",
      "migrated the admin panel from bootstrap to filament, improving maintainability and development efficiency",
    ],
  },
  {
    company: "dicoding indonesia",
    role: "asah capstone leader",
    stack: [
      "typescript",
      "nestjs",
      "supabase",
      "postgresql",
      "linear",
      "agile",
      "machine learning",
    ],
    type: "volunteer",
    date: "oct 2025 - dec 2025",
    location: "remote",
    highlights: [
      "led a cross-functional team of 5 engineers across ml, backend, and frontend to deliver a predictive maintenance system within 3 months",
      "established agile workflows using linear and weekly checkpoints, delivering all project milestones on schedule",
      "coordinated integration of machine learning models into production-ready applications, enabling end-to-end ai feature delivery",
    ],
  },
  {
    company: "code in place, stanford university",
    role: "section leader",
    stack: [
      "python",
      "teaching",
      "mentoring",
    ],
    type: "volunteer",
    date: "apr 2025 - jun 2025",
    location: "remote",
    highlights: [
      "mentored 10+ students weekly in python fundamentals, improving assessment scores by 40%",
      "designed lesson plans and collaborative projects, increasing student engagement and course completion rates",
    ],
  },
];