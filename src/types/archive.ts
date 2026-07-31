import type { ImageMetadata } from 'astro';

export interface ArchiveItem {
  title: string;
  image?: ImageMetadata;
  description: string;
  category: string;
  date: Date;
  link: string;
}