import type { ImageMetadata } from 'astro';

export interface ProjectItem {
  name: string;
  image?: ImageMetadata;
  about: string;
  description: string;
  stack: string[];
  date: string;
  github?: string;
  live_link?: string;
  content_link: string;
  priority?: boolean;
}