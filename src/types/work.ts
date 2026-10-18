import type { ImageMetadata } from 'astro';

export interface WorkItem {
  id: string;
  company: string;
  role: string;
  stack: string[];
  type: string;
  date: string;
  location: string;
  highlights: string;
  images: ImageMetadata[];
}
