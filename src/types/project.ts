import type { ImageMetadata } from 'astro';

export interface ProjectItem {
  name: string;
  image?: ImageMetadata;
  description: string;
  stack: string[];
  date: string;
  github?: string;
  live_link?: string;
  content_link: string;
}